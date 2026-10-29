#!/usr/bin/env bash
# Vercel Ignored Build Step.  Exit 0 skips the build.  Exit 1 (or greater) builds.
#
# Automatic git deploys:
#   - skip every preview
#   - skip when this commit did not change site files (effort logs / STATUS /
#     iOS / docs-only merges must not ship the website)
#   - production at most once per 3 hours (stops agent spam even when they keep
#     touching CSS/copy)
# Manual: VERCEL_FORCE_DEPLOY=1, or Dashboard Redeploy with Ignore Build Step unchecked.
#
# Vercel runs this step with a working directory that is not always the project
# root,  so vercel.json looks for this script by repository-root path first and
# falls back to the plain name.  The script finds itself through BASH_SOURCE,
# so it watches the right folder either way.
set -euo pipefail

if [[ "${VERCEL_FORCE_DEPLOY:-}" == "1" ]]; then
  echo "force deploy"
  exit 1
fi

if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "skip preview auto-deploy"
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

# Nested scripts (site/, web/, apps/site) watch their own folder.
# A repo-root script watches the tree minus native/docs/CI.
watch_args=()
if [[ -n "${VERCEL_IGNORE_WATCH:-}" ]]; then
  # Split on whitespace with globbing off, so a "*" stays a git pathspec
  # instead of expanding against files in the working directory.
  set -f
  read -r -a watch_args <<<"${VERCEL_IGNORE_WATCH}"
  set +f
elif [[ -n "$git_root" && "$script_dir" != "$git_root" ]]; then
  rel="${script_dir#"$git_root"/}"
  # ":top" anchors to the repo root on purpose.  A bare "$rel" would resolve
  # against the working directory, which IS this folder under Vercel, so it
  # would match nothing and mislead the next reader.
  watch_args=(":(top)${rel}")
else
  watch_args=(
    ":(top)"
    ":(top,exclude)docs"
    ":(top,exclude)handbook"
    ":(top,exclude)generated"
    ":(top,exclude)scripts/handbook"
    ":(top,exclude)datadog"
    ":(top,exclude)AGENTS.md"
    ":(top,exclude)FLEET-PROTOCOL.md"
    ":(top,exclude)ATTACK-MAP.md"
    ":(top,exclude)CLAUDE.md"
    ":(top,exclude)PLAN.md"
    ":(top,exclude)PROJECT.md"
    ":(top,exclude)STATUS.md"
    ":(top,exclude).github"
    ":(top,exclude)*.md"
  )
fi

site_changed() {
  local before after rc
  after="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
  if [[ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ]]; then
    before="${VERCEL_GIT_PREVIOUS_SHA}"
  elif git rev-parse --verify --quiet HEAD^ >/dev/null; then
    before="HEAD^"
  else
    echo "no previous commit; treat as site changed"
    return 0
  fi
  set +e
  git diff --quiet "$before" "$after" -- "${watch_args[@]}"
  rc=$?
  set -e
  # 0 = identical, 1 = changed, 2 = git error (shallow clone, missing sha)
  if [[ "$rc" -eq 0 ]]; then
    return 1
  fi
  if [[ "$rc" -eq 1 ]]; then
    return 0
  fi
  echo "git diff failed (rc $rc); treat as site changed"
  return 0
}

if ! site_changed; then
  echo "skip production: no site-file changes (${watch_args[*]})"
  exit 0
fi

if [[ -n "${VERCEL_TOKEN:-}" && -n "${VERCEL_PROJECT_ID:-}" ]]; then
  team="${VERCEL_ORG_ID:-}"
  qs="projectId=${VERCEL_PROJECT_ID}&target=production&state=READY&limit=1"
  if [[ -n "$team" ]]; then
    qs="${qs}&teamId=${team}"
  fi
  # The header goes through --config on a /dev/fd path (printf is a shell
  # builtin), so the token never appears in curl's argv or in ps.
  created=$(curl -fsS --connect-timeout 5 --max-time 10 \
    --config <(printf 'header = "Authorization: Bearer %s"\n' "${VERCEL_TOKEN}") \
    "https://api.vercel.com/v6/deployments?${qs}" \
    | python3 -c "import json,sys
d=json.load(sys.stdin)
deps=d.get('deployments') or []
print(deps[0]['created'] if deps else 0)" 2>/dev/null || echo 0)
  now_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  if [[ "$created" =~ ^[0-9]+$ ]] && [[ "$created" -gt 0 ]]; then
    age=$(( (now_ms - created) / 1000 ))
    if [[ "$age" -lt 10800 ]]; then
      echo "skip production: last deploy ${age}s ago (cap: one production deploy per 3 h)"
      exit 0
    fi
  fi
fi

echo "build production"
exit 1
