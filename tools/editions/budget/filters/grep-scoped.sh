#!/usr/bin/env bash
# R2 — Budget field-projection: scoped code search.
# Bounded ripgrep so a search never floods model context. Caps match count and
# line width and adds 2 lines of context. All extra args pass through to rg.
#
# Usage:
#   grep-scoped.sh <pattern> [path ...] [-- extra rg args]
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "grep-scoped.sh: usage: grep-scoped.sh <pattern> [path ...]" >&2
  exit 2
fi

# Defaults chosen to keep output token-bounded; override by appending rg flags.
exec rg --max-count=20 --max-columns=200 --color=never -n -C2 "$@"
