#!/usr/bin/env bash
#
# Enable branch protection on `main`: require all CI checks to pass and the
# branch to be up to date before merging. Idempotent — safe to re-run.
#
# Requires the GitHub CLI (`gh`) authenticated with admin on the repo:
#   gh auth login
#
# Usage:
#   scripts/setup-branch-protection.sh                 # infers owner/repo from origin
#   REPO=owner/name scripts/setup-branch-protection.sh # explicit
#
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) not found. Install: https://cli.github.com/" >&2
  exit 1
fi

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
BRANCH="${BRANCH:-main}"

# Must match the job `name:` values in .github/workflows/ci.yml.
CHECKS=(
  "Backend Lint"
  "Backend Tests"
  "Backend Contract Tests"
  "Backend Dependency Audit"
  "Frontend Lint"
  "Frontend Tests"
  "Frontend Build"
  "Frontend Dependency Audit"
  "Mock Server Tests"
  "Mock Server Dependency Audit"
)

# Build the JSON array of required check contexts.
contexts_json=$(printf '"%s",' "${CHECKS[@]}")
contexts_json="[${contexts_json%,}]"

echo "Enabling branch protection on ${REPO}@${BRANCH}..."
gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${contexts_json}
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
JSON

echo "Done. main now requires CI to pass (and the branch to be up to date) before merge."
