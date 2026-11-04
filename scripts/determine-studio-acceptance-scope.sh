#!/usr/bin/env bash
set -euo pipefail

base_sha="${1:?Expected the pull request base SHA.}"
head_sha="${2:?Expected the pull request head SHA.}"
required=true
reason='The changed-path scope could not be proven safe.'

if git diff --quiet "$base_sha" "$head_sha"; then
  reason='No changed paths were found, so the complete suite remains required.'
else
  diff_status=$?

  if [[ "$diff_status" -ne 1 ]]; then
    reason='The changed-path scope could not be read, so the complete suite remains required.'
  elif ! change_summary="$(git diff --summary "$base_sha" "$head_sha")"; then
    reason='The changed-path scope could not be read, so the complete suite remains required.'
  elif grep -q 'mode change' <<< "$change_summary"; then
    reason='A file mode changed, so the complete suite is required.'
  elif ! change_list="$(git diff --name-status --find-renames --find-copies "$base_sha" "$head_sha")"; then
    reason='The changed-path scope could not be read, so the complete suite remains required.'
  else
    required=false
    reason='Only explicitly safe documentation, Changeset, or Agent guidance paths changed.'

    while IFS=$'\t' read -r status path additional_path; do
      [[ -z "$status" ]] && continue

      case "$status" in
        A|M)
          case "$path" in
            .agents/**/*.md|.changeset/*.md|.github/ISSUE_TEMPLATE/*.md|AGENTS.md|README.md|docs/*|paradox/*)
              ;;
            *)
              required=true
              reason='An unknown or executable path changed, so the complete suite is required.'
              break
              ;;
          esac
          ;;
        *)
          required=true
          reason='A path was deleted, renamed, copied, or changed with an unknown status, so the complete suite is required.'
          break
          ;;
      esac
    done <<< "$change_list"
  fi
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "required=$required"
    echo "reason=$reason"
  } >> "$GITHUB_OUTPUT"
else
  printf 'required=%s\nreason=%s\n' "$required" "$reason"
fi
