#!/usr/bin/env bash
# Install the universal .gitignore into a project, safely.
#
#   apply-gitignore.sh <project-dir> [...]      install (merges, never clobbers)
#   apply-gitignore.sh --check <project-dir>    report only, change nothing
#
# Three things it does that a plain `cp` does not:
#
#   1. MERGES. An existing .gitignore is preserved and only missing rules are
#      appended, so a project's own rules are never lost.
#   2. AUDITS ALREADY-TRACKED SECRETS. .gitignore has no effect on files git is
#      already tracking. A repo that committed .env before this template existed
#      stays exposed, and adding a rule creates a false sense of safety. Anything
#      found here needs the value ROTATED first, then `git rm --cached`.
#   3. PROVES IT. After installing, runs `git add -A --dry-run` and reports
#      whether any secret-shaped path would still be staged.
#
set -uo pipefail

TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/gitignore-universal"
SECRET_RE='(^|/)(\.env(\..*)?|\.dev\.vars(\..*)?|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa|id_ed25519|.*credentials.*\.json|service-account.*\.json|\.npmrc|\.netrc)$'
ALLOW_RE='\.(example|sample|template)$|\.env\.example$'

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && { CHECK_ONLY=1; shift; }
[[ $# -eq 0 ]] && { echo "usage: $(basename "$0") [--check] <project-dir> [...]" >&2; exit 2; }
[[ -f "$TEMPLATE" ]] || { echo "template not found: $TEMPLATE" >&2; exit 2; }

status=0
for dir in "$@"; do
  [[ -d "$dir" ]] || { echo "── $dir: not a directory, skipped"; continue; }
  echo "── $dir"

  # 1. already-tracked secrets (only meaningful inside a repo)
  if git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    tracked=$(git -C "$dir" ls-files | grep -E "$SECRET_RE" | grep -vE "$ALLOW_RE" || true)
    if [[ -n "$tracked" ]]; then
      echo "     !! ALREADY TRACKED — .gitignore will NOT hide these:"
      echo "$tracked" | sed 's/^/        /'
      echo "        rotate the values, then: git rm --cached <file>"
      status=1
    else
      echo "     tracked secrets: none"
    fi
  else
    echo "     no git repo yet — the template will apply from the first commit"
  fi

  # 2. install or merge
  target="$dir/.gitignore"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    echo "     (--check: nothing written)"
  elif [[ ! -f "$target" ]]; then
    cp "$TEMPLATE" "$target"
    echo "     installed .gitignore ($(wc -l < "$target" | tr -d ' ') lines)"
  else
    # Append in TEMPLATE ORDER. .gitignore is last-match-wins, so a `!`
    # re-include is only effective when it FOLLOWS the broad rule it undoes.
    # Sorting the appended block (an earlier version used `comm` on sorted
    # files) silently reorders those pairs and re-excludes .env.example.
    missing=()
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      grep -qxF -- "$line" "$target" || missing+=("$line")
    done < "$TEMPLATE"
    if [[ ${#missing[@]} -gt 0 ]]; then
      { echo ""; echo "# ── merged from the universal template, $(date +%Y-%m-%d) ──"; } >> "$target"
      printf '%s\n' "${missing[@]}" >> "$target"
      echo "     merged ${#missing[@]} new rule(s), template order preserved"
    else
      echo "     existing .gitignore already covers every rule"
    fi

    # Re-assert every `!` rule at the very end.
    #
    # Appending in template order is necessary but not sufficient: if the
    # TARGET already carried `!.env.example` and the template contributes a
    # broader `.env.*` after it, the broad rule now wins and the example file
    # is silently excluded. Observed on noesismirror-web-falseearth.
    # Re-emitting the negations last makes them unconditionally final.
    negs=$(grep -hE '^!' "$target" "$TEMPLATE" 2>/dev/null | awk '!seen[$0]++')
    if [[ -n "$negs" ]]; then
      { echo ""; echo "# ── re-includes, kept last so they win (last match wins) ──"
        echo "$negs"; } >> "$target"
    fi
  fi

  # 3. prove it
  if [[ $CHECK_ONLY -eq 0 ]] && git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    would=$(git -C "$dir" add -A --dry-run 2>/dev/null \
            | sed -E "s/^(add|remove) '//; s/'$//" \
            | grep -E "$SECRET_RE" | grep -vE "$ALLOW_RE" || true)
    if [[ -n "$would" ]]; then
      echo "     !! would STILL stage:"; echo "$would" | sed 's/^/        /'; status=1
    else
      echo "     verified: no secret-shaped path would be staged"
    fi
  fi
done
exit $status
