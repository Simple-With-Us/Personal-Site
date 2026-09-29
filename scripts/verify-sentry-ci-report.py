#!/usr/bin/env python3
"""
verify-sentry-ci-report.py -- drift guard for scripts/sentry-ci-report.py.

The reporter mirrors this repo's scheduled workflows into Sentry Crons via
CRON_SCHEDULES and tags every event with APP.  Both were once copied over
from another fleet repo (APP = "socratic-trade", a CRON_SCHEDULES full of
workflow names this repo does not even have), and nothing noticed until
review: the reporter silently tagged Personal-Site failures as
socratic-trade and monitored crons for workflows that do not exist here.
This script fails CI before that class of drift can land again:

  1. APP must be this repo's fleet identity ("personal-site").
  2. Every CRON_SCHEDULES key must name a live workflow (case-insensitive).
  3. Every live workflow with a schedule trigger must have a
     CRON_SCHEDULES entry.
  4. Each mapped expression must match one of that workflow's live crons.

Deliberately stdlib-only line scanning, the same constraint the reporter
itself documents: no PyYAML dependency for a check that must run anywhere
python3 exists (CI, a clean clone, a phone).
"""
from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
EXPECTED_APP = "personal-site"


def load_reporter():
    spec = importlib.util.spec_from_file_location(
        "sentry_ci_report", REPO_ROOT / "scripts" / "sentry-ci-report.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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

    Same deliberately dumb line scan as the reporter's
    discover_workflow_names(): a top-level `name:` is always a plain
    scalar, and `- cron:` entries are always list items.
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


def main() -> int:
    reporter = load_reporter()
    app = reporter.APP
    schedules = reporter.CRON_SCHEDULES
    workflows = scan_workflows()

    failures = []

    # 1. APP identity.  fleet-infra is shared, so events tagged with
    # another repo's app collapse into that repo's Sentry issues.
    if app != EXPECTED_APP:
        failures.append(
            f"APP is {app!r}, expected {EXPECTED_APP!r} - events would be "
            "tagged and fingerprinted under the wrong repo in the shared "
            "fleet-infra project."
        )

    folded_names = {name.casefold(): name for name in workflows}
    folded_schedules = {key.casefold(): value for key, value in schedules.items()}

    # 2. No stale keys.
    for key in schedules:
        if key.casefold() not in folded_names:
            failures.append(
                f"CRON_SCHEDULES key {key!r} matches no workflow name "
                "under .github/workflows/."
            )

    # 3 + 4. Every scheduled workflow is mapped, to its live expression.
    for name, crons in workflows.items():
        if not crons:
            continue
        mapped = folded_schedules.get(name.casefold())
        if mapped is None:
            failures.append(
                f"Workflow {name!r} has schedule trigger(s) {crons} but no "
                "CRON_SCHEDULES entry."
            )
        elif mapped not in crons:
            failures.append(
                f"CRON_SCHEDULES[{name!r}] is {mapped!r} but the live "
                f"workflow declares {crons}."
            )

    if failures:
        print("::error::sentry-ci-report drift detected:")
        for failure in failures:
            print(f"::error::- {failure}")
        return 1
    print(
        f"sentry-ci-report alignment OK: APP={app!r}, "
        f"{len(schedules)} cron schedule(s) match the live workflows."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
