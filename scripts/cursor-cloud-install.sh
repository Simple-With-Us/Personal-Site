#!/usr/bin/env bash
# Cursor Cloud install script for Personal-Site.
# Runs during Build (per docs.cursor.com/cloud-agent/setup); must be idempotent.
# Target: Ubuntu Linux only.  macOS/iOS/Xcode steps are skipped on purpose.
#
# Toolchain:
#   - site/ holds the TanStack Start / Vite app (Nitro vercel preset).
#   - site/package.json + package-lock.json pin deps.  We use `npm ci`.
#   - Infisical CLI is needed at start, so install it here if missing.
set -euo pipefail

# Resolve repo root (this script lives in scripts/, the repo is the parent).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Compose-latest images are Ubuntu; bail loud on anything else so the
# coordinator doesn't silently spend build time on macOS paths.
if [ "$(uname -s)" != "Linux" ]; then
  echo "cursor-cloud-install: expected Linux (Cursor composer-latest), got $(uname -s).  macOS / iOS / Xcode steps are out of scope here." >&2
  exit 1
fi

echo "==> Node: $(node --version 2>/dev/null || echo 'not found')  npm: $(npm --version 2>/dev/null || echo 'not found')"

# site/ is the package root; install deps with npm ci so lockfile is honored.
if [ ! -d site ]; then
  echo "cursor-cloud-install: site/ directory missing at ${REPO_ROOT}/site" >&2
  exit 1
fi

echo "==> Installing site/ dependencies (npm ci)"
(
  cd site
  # If a prior install left node_modules out of sync with the lockfile, clean.
  if [ -d node_modules ] && [ ! -f node_modules/.package-lock.json ]; then
    echo "==> Cleaning stale site/node_modules"
    rm -rf node_modules
  fi
  npm ci --include=dev
)

# Install Infisical CLI when absent.  We do NOT print or persist any
# INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET value; only NAMES.
if ! command -v infisical >/dev/null 2>&1; then
  echo "==> Installing Infisical CLI (official Linux installer)"
  curl -fsSL https://infisical.com/install.sh | sh -s -- -v latest
else
  echo "==> Infisical CLI already present: $(infisical --version 2>/dev/null || echo 'unknown')"
fi

# Sanity: the app's tooling should be reachable now.
( cd site && node -e 'console.log("site deps ok: " + Object.keys(require("./package.json").dependencies).length + " runtime deps")' )

echo "==> cursor-cloud-install complete."
echo "    Start: bash scripts/cursor-cloud-start.sh"
echo "    Dev:   cd site && npm run dev"
