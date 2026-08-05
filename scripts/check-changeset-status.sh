#!/usr/bin/env bash
set -euo pipefail

# Refresh release validation for the current pull request run.
BASE_SHA="${CHANGESET_BASE_SHA:-origin/${GITHUB_BASE_REF:-main}}"
HEAD_SHA="${CHANGESET_HEAD_SHA:-HEAD}"

changed_files="$(git diff --name-status "${BASE_SHA}" "${HEAD_SHA}")"
release_artifacts_only=true
has_consumed_changeset=false
has_changelog=false

while IFS=$'\t' read -r status path extra_path; do
  [[ -z "${status}" ]] && continue

  if [[ "${status}" == R* ]]; then
    release_artifacts_only=false
    continue
  fi

  case "${path}" in
    .changeset/*.md)
      if [[ "${status}" == "D" ]]; then
        has_consumed_changeset=true
      else
        release_artifacts_only=false
      fi
      ;;
    .changeset/pre.json)
      ;;
    package.json|*/package.json)
      ;;
    CHANGELOG.md|*/CHANGELOG.md)
      has_changelog=true
      ;;
    bun.lock|pnpm-lock.yaml|package-lock.json|yarn.lock)
      ;;
    *)
      release_artifacts_only=false
      ;;
  esac
done <<< "${changed_files}"

has_version_change=false
if git diff --unified=0 "${BASE_SHA}" "${HEAD_SHA}" -- \
  package.json ':(glob)**/package.json' | \
  grep -Eq '^[+-][[:space:]]*"version"[[:space:]]*:'; then
  has_version_change=true
fi

if [[ "${release_artifacts_only}" == "true" && \
      "${has_consumed_changeset}" == "true" && \
      "${has_changelog}" == "true" && \
      "${has_version_change}" == "true" ]]; then
  echo "Changesets versioning output detected; consumed changesets are valid release artifacts."
  exit 0
fi

bunx changeset status --since="${BASE_SHA}"
