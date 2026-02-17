#!/usr/bin/env bash
set -euo pipefail

if git grep -nE '^(<<<<<<<|=======|>>>>>>>)' -- . >/tmp/conflict_markers.txt; then
  echo "Conflict markers found:"
  cat /tmp/conflict_markers.txt
  exit 1
fi

echo "No conflict markers found."
