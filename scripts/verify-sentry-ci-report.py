#!/usr/bin/env python3
"""
verify-sentry-ci-report.py -- drift guard for the thin Sentry listener.

The reporter lives in the AI-Fleet-Coordinator repository now and is called
through its shared workflow_call reusable.  What this repository owns is the
caller:  `.github/workflows/sentry-ci-report.yml` names the workflows it
observes,  the cron expressions it mirrors,  and the identity it reports under.

Both of those were once copied over from another fleet repo (an app identity
belonging to another repository,  a cron map full of workflow names this repo
does not even have),  and nothing noticed until review:  the reporter silently
tagged Personal-Site failures under the wrong name and monitored crons for
workflows that do not exist here.  This script fails CI before that class of
drift can land again:

  1. The app identity must be this repo's fleet identity ("personal-site").
  2. Every observed name must name a live workflow.
  3. Every cron map key must name a live workflow.
  4. Every live workflow with a schedule trigger must have a cron map entry,
     unless that workflow self-reports its Sentry cron monitor.
  5. Each mapped expression must match one of that workflow's live crons.
  6. A self-reporting workflow stays out of this listener.  The shared reporter
     would otherwise upsert an hourly crontab and a 15-minute margin over the
     monitor the workflow itself maintains.  Its slug must be
     ``ci-personal-site-`` plus the slug of its workflow name, and that pair
     must be the pair in ``scripts/deploy/sentry-cron-checkin.mjs``.
  7. The ``workflow_run`` name list and the ``observed_workflows`` input name
     the same workflows.

Deliberately stdlib-only line scanning, the same constraint the reporter
itself documents: no PyYAML dependency for a check that must run anywhere
python3 exists (CI, a clean clone, a phone).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
CALLER = WORKFLOWS_DIR / "sentry-ci-report.yml"
EXPECTED_APP = "personal-site"


def parse_cron_expr(line):
    """Extract a cron expression from a `- cron: ...` schedule list item.

    Handles quoted scalars with trailing comments
    (`- cron: "27 6 * * *" # note`) and bare scalars.
    """
    m = re.match(r"""^\s*-\s*cron:\s*(['"])(.*?)\1""", line)
    if m:
        return m.group(2)
    m = re.match(r"^\s*-\s*cron:\s*([^#]+?)\s*(?:#.*)?$", line)
    return m.group(1) if m else None


def scan_workflows():
    """{workflow name: [cron expressions]} for every workflow file.

    Same deliberately dumb line scan as the reporter's own discovery: a
    top-level `name:` is always a plain scalar, and `- cron:` entries are
    always list items.
    """
    workflows = {}
    for path in sorted(WORKFLOWS_DIR.glob("*.y*ml")):
        text = path.read_text(encoding="utf-8", errors="replace")
        name = None
        for line in text.splitlines():
            m = re.match(r"^name:\s*(.+?)\s*$", line)
            if m:
                name = m.group(1).strip().strip("\"'")
                break
        if name is None:
            name = path.stem
        crons = []
        for line in text.splitlines():
            expr = parse_cron_expr(line)
            if expr:
                crons.append(expr)
        workflows[name] = crons
    return workflows


def caller_scalar(text, key):
    """Read one `key: value` input out of the caller's `with:` block."""
    m = re.search(rf"^\s*{re.escape(key)}:\s*(.+?)\s*$", text, re.MULTILINE)
    if not m:
        return None
    value = m.group(1).strip()
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    return value


def load_caller():
    """The caller's own inputs:  observed names, cron map and identity."""
    text = CALLER.read_text(encoding="utf-8", errors="replace")
    observed_raw = caller_scalar(text, "observed_workflows")
    cron_raw = caller_scalar(text, "cron_schedules")
    if observed_raw is None or cron_raw is None:
        raise SystemExit(
            "::error::the Sentry listener does not carry the observed_workflows "
            "and cron_schedules inputs the shared reporter needs."
        )
    try:
        observed = json.loads(observed_raw)
        schedules = json.loads(cron_raw)
    except ValueError as exc:
        raise SystemExit(f"::error::the Sentry listener's inputs are not JSON: {exc}")
    if not isinstance(observed, list) or not isinstance(schedules, dict):
        raise SystemExit(
            "::error::observed_workflows must be a JSON array and cron_schedules "
            "a JSON object."
        )
    return {
        "observed": observed,
        "schedules": schedules,
        "app": caller_scalar(text, "app"),
        "app_identity": caller_scalar(text, "app_identity"),
    }


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return re.sub(r"-+", "-", slug)


def expected_monitor_slug(name):
    return f"ci-{EXPECTED_APP}-{slugify(name)}"


def listener_workflow_names(text):
    """The ``on.workflow_run.workflows`` list, in file order."""
    names = []
    in_list = False
    for line in text.splitlines():
        if re.match(r"^\s*workflows:\s*$", line):
            in_list = True
            continue
        if not in_list:
            continue
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        item = re.match(r"^\s*-\s+(.+?)\s*$", line)
        if item:
            names.append(item.group(1).strip().strip("\"'"))
            continue
        break
    return names


def self_report_markers(workflows_dir=WORKFLOWS_DIR):
    """``{workflow name: slug}`` from ``# sentry-cron-self-report:`` lines."""
    found = {}
    marker = re.compile(r"^# sentry-cron-self-report:\s*(\S+)\s*$", re.M)
    for path in sorted(workflows_dir.glob("*.y*ml")):
        text = path.read_text(encoding="utf-8", errors="replace")
        name = None
        for line in text.splitlines():
            match = re.match(r"^name:\s*(.+?)\s*$", line)
            if match:
                name = match.group(1).strip().strip("\"'")
                break
        if name is None:
            continue
        slugs = [match.group(1) for match in marker.finditer(text)]
        if not slugs:
            continue
        found[name] = {"slug": slugs[0], "slugs": slugs, "text": text, "path": path}
    return found


def checkin_monitor_pairs(source):
    """Pairs declared by ``MONITORS`` in the check-in script."""
    block = re.search(r"export const MONITORS = \{([^}]+)\}", source)
    if not block:
        return None
    return re.findall(r"'([^']+)':\s*'([^']+)'", block.group(1))


def main() -> int:
    caller = load_caller()
    app = caller["app"]
    identity = caller["app_identity"]
    observed = caller["observed"]
    schedules = caller["schedules"]
    workflows = scan_workflows()

    failures = []

    # 1. App identity.  fleet-infra is shared, so events tagged with another
    # repo's app collapse into that repo's Sentry issues.
    for label, value in (("app", app), ("app_identity", identity)):
        if value != EXPECTED_APP:
            failures.append(
                f"{label} is {value!r}, expected {EXPECTED_APP!r} - events would be "
                "tagged and fingerprinted under the wrong repo in the shared "
                "fleet-infra project."
            )

    folded_names = {name.casefold(): name for name in workflows}
    folded_schedules = {key.casefold(): value for key, value in schedules.items()}

    # 2. No stale observed names:  an observed name that matches no workflow is
    # a silent loss of alerting for that pipeline.
    for name in observed:
        if name.casefold() not in folded_names:
            failures.append(
                f"observed_workflows names {name!r}, which matches no workflow "
                "name under .github/workflows/."
            )

    # 3. No stale cron keys.
    for key in schedules:
        if key.casefold() not in folded_names:
            failures.append(
                f"cron_schedules key {key!r} matches no workflow name "
                "under .github/workflows/."
            )

    reports = self_report_markers()
    checkin_path = REPO_ROOT / "scripts" / "deploy" / "sentry-cron-checkin.mjs"
    checkin_source = checkin_path.read_text(encoding="utf-8", errors="replace") if checkin_path.is_file() else ""
    declared_pairs = checkin_monitor_pairs(checkin_source)
    if declared_pairs is None:
        failures.append(
            "scripts/deploy/sentry-cron-checkin.mjs does not declare MONITORS, "
            "so a self-reporting workflow cannot be checked."
        )
        declared = {}
    else:
        declared = dict(declared_pairs)
        if len(declared) != len(declared_pairs):
            failures.append("MONITORS repeats a workflow name.")

    for name, slug in declared.items():
        expected = expected_monitor_slug(name)
        if slug != expected:
            failures.append(
                f"MONITORS[{name!r}] is {slug!r}, expected {expected!r}. "
                "A different slug would orphan the monitor that already has this name."
            )
        if name not in workflows:
            failures.append(
                f"MONITORS names {name!r}, which is not a workflow name under .github/workflows/."
            )

    # 4 + 5. Every scheduled workflow is mapped, to its live expression,
    # unless the workflow owns its monitor and stays out of this listener.
    for name, crons in workflows.items():
        if not crons:
            if name in reports:
                failures.append(
                    f"Workflow {name!r} declares a self-report marker but has no schedule trigger."
                )
            continue
        report = reports.get(name)
        if report is not None:
            continue
        mapped = folded_schedules.get(name.casefold())
        if mapped is None:
            failures.append(
                f"Workflow {name!r} has schedule trigger(s) {crons} but no "
                "cron_schedules entry."
            )
        elif mapped not in crons:
            failures.append(
                f"cron_schedules[{name!r}] is {mapped!r} but the live "
                f"workflow declares {crons}."
            )

    # 6. Self-reporting workflows must not be upserted by the shared reporter.
    for name, report in reports.items():
        slug = report["slug"]
        expected = expected_monitor_slug(name)
        if report["slugs"] != [slug]:
            failures.append(
                f"Workflow {name!r} declares more than one sentry-cron-self-report marker."
            )
        if slug != expected:
            failures.append(
                f"Workflow {name!r} self-reports slug {slug!r}, expected {expected!r}."
            )
        if declared.get(name) != slug:
            failures.append(
                f"Workflow {name!r} self-reports {slug!r}, but MONITORS does not."
            )
        if name in observed or name.casefold() in {item.casefold() for item in observed}:
            failures.append(
                f"Workflow {name!r} self-reports its cron monitor and is also in "
                "observed_workflows. The shared reporter would upsert the hourly monitor."
            )
        if name.casefold() in folded_schedules:
            failures.append(
                f"Workflow {name!r} self-reports its cron monitor and is also a "
                "cron_schedules key. The shared reporter would upsert the hourly monitor."
            )
        text = report["text"]
        if "scripts/deploy/sentry-cron-checkin.mjs" not in text:
            failures.append(
                f"Workflow {name!r} self-reports a monitor but does not run "
                "scripts/deploy/sentry-cron-checkin.mjs."
            )
        if "CRON_CHECKIN_PHASE: open" not in text or "CRON_CHECKIN_PHASE: close" not in text:
            failures.append(
                f"Workflow {name!r} must open and close its Sentry cron check-in."
            )

    for name in declared:
        if name not in reports:
            failures.append(
                f"MONITORS lists {name!r} but that workflow has no "
                "sentry-cron-self-report marker."
            )

    # 7. The trigger list and the observed input stay the same set.
    listener_names = listener_workflow_names(CALLER.read_text(encoding="utf-8", errors="replace"))
    if [name.casefold() for name in listener_names] != [name.casefold() for name in observed]:
        failures.append(
            "workflow_run workflows list "
            f"{listener_names!r} does not match observed_workflows {observed!r}."
        )

    if failures:
        print("::error::sentry-ci-report drift detected:")
        for failure in failures:
            print(f"::error::- {failure}")
        return 1
    print(
        f"sentry-ci-report alignment OK: app={app!r}, {len(observed)} observed "
        f"workflow(s), {len(schedules)} cron schedule(s) match the live workflows."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
