#!/usr/bin/env bash
# R2 — Budget field-projection: GitHub.
# "Think in code": never pipe a raw `gh api` payload into model context. Project
# only the fields the orchestrator actually needs.
#
# Usage:
#   gh-fields.sh issues <owner/repo> [state]   # default state: open
#   gh-fields.sh issue  <owner/repo> <number>
#   gh-fields.sh prs    <owner/repo> [state]
#   gh-fields.sh pr     <owner/repo> <number>
#   (append --raw as the LAST arg to bypass projection when a dropped field
#    would force a re-fetch)
set -euo pipefail

kind="${1:-}"; repo="${2:-}"; arg="${3:-}"
raw=0
for a in "$@"; do [ "$a" = "--raw" ] && raw=1; done

require() { [ -n "${1:-}" ] || { echo "gh-fields.sh: missing argument" >&2; exit 2; }; }
require "$kind"; require "$repo"

case "$kind" in
  issues)
    state="${arg:-open}"; [ "$state" = "--raw" ] && state=open
    if [ "$raw" = "1" ]; then gh issue list -R "$repo" --state "$state" --json number,title,state,labels,assignees; else
      gh issue list -R "$repo" --state "$state" \
        --json number,title,state,labels \
        --jq '[.[] | {number,title,state,labels:[.labels[].name]}]'; fi ;;
  issue)
    require "$arg"
    if [ "$raw" = "1" ]; then gh issue view "$arg" -R "$repo" --json number,title,state,body,labels,assignees,comments; else
      gh issue view "$arg" -R "$repo" \
        --json number,title,state,labels,body \
        --jq '{number,title,state,labels:[.labels[].name],body:(.body[0:1200])}'; fi ;;
  prs)
    state="${arg:-open}"; [ "$state" = "--raw" ] && state=open
    if [ "$raw" = "1" ]; then gh pr list -R "$repo" --state "$state" --json number,title,state,files,labels; else
      gh pr list -R "$repo" --state "$state" \
        --json number,title,state,files \
        --jq '[.[] | {number,title,state,files:[.files[].path]}]'; fi ;;
  pr)
    require "$arg"
    if [ "$raw" = "1" ]; then gh pr view "$arg" -R "$repo" --json number,title,state,body,files,reviews; else
      gh pr view "$arg" -R "$repo" \
        --json number,title,state,files \
        --jq '{number,title,state,files:[.files[].path]}'; fi ;;
  *)
    echo "gh-fields.sh: unknown kind '$kind' (issues|issue|prs|pr)" >&2; exit 2 ;;
esac
