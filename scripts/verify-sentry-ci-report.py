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
  4. Every live workflow with a schedule trigger must have a cron map entry.
  5. Each mapped expression must match one of that workflow's live crons.

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

    # 4 + 5. Every scheduled workflow is mapped, to its live expression.
    for name, crons in workflows.items():
        if not crons:
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
