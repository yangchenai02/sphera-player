#!/bin/bash
# CI sanity check: install, typecheck, unit tests, production build.
# Runs locally because the repo is built and verified on this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

npm run typecheck
npm test
npm run build
echo "ci-check: OK"
