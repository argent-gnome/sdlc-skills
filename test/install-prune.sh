#!/usr/bin/env bash
# Behavioral test for install.sh's prune step (slice 0004, R-3).
#
# Hermetic: runs install.sh with CLAUDE_SKILLS_DIR pointed at a throwaway dir, so it NEVER touches
# ~/.claude/skills. Seeds the four cases that distinguish a correct prune from a plausible-wrong one:
#
#   (a) dangling symlink INTO this repo's skills/   -> must be PRUNED
#   (b) dangling symlink pointing somewhere else    -> must be KEPT   (another tool owns it)
#   (c) valid symlink into this repo's skills/      -> must SURVIVE, still resolving
#   (d) a real directory                            -> must SURVIVE untouched
#
# (b) is the discriminating case: a prune written as "remove every dangling link" passes (a), (c) and
# (d) and still silently deletes another tool's links. Then it runs a second time to prove idempotency.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$(mktemp -d)"
ELSEWHERE="$(mktemp -d)/never-created"
LOG="$DST/../install.log"
trap 'rm -rf "$DST"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

# ---- seed --------------------------------------------------------------------------------------
mkdir -p "$DST/real-dir-skill"
echo 'not a link' > "$DST/real-dir-skill/SKILL.md"
ln -s "$REPO_DIR/skills/deleted-by-a-rename" "$DST/dangling-ours"
ln -s "$ELSEWHERE"                           "$DST/dangling-theirs"
ln -s "$REPO_DIR/skills/house-builder"       "$DST/house-builder"

[ -L "$DST/dangling-ours" ] && [ ! -e "$DST/dangling-ours" ] || fail "seed (a) is not a dangling link"
[ -L "$DST/dangling-theirs" ] && [ ! -e "$DST/dangling-theirs" ] || fail "seed (b) is not a dangling link"

# ---- run ---------------------------------------------------------------------------------------
CLAUDE_SKILLS_DIR="$DST" "$REPO_DIR/install.sh" > "$LOG" 2>&1 || { cat "$LOG"; fail "install.sh exited non-zero"; }

# ---- assert ------------------------------------------------------------------------------------
[ ! -e "$DST/dangling-ours" ] && [ ! -L "$DST/dangling-ours" ] \
  || fail "(a) dangling link into this repo's skills/ was NOT pruned"
[ -L "$DST/dangling-theirs" ] \
  || fail "(b) a dangling link owned by another tool was deleted — prune is too broad"
[ -L "$DST/house-builder" ] && [ -e "$DST/house-builder" ] \
  || fail "(c) valid link did not survive as a resolving link"
[ -d "$DST/real-dir-skill" ] && [ ! -L "$DST/real-dir-skill" ] && [ -f "$DST/real-dir-skill/SKILL.md" ] \
  || fail "(d) a real directory was disturbed"

# every skills/*/ got linked, and nothing in the dst dangles
for dir in "$REPO_DIR"/skills/*/; do
  n="$(basename "$dir")"
  [ -L "$DST/$n" ] && [ -e "$DST/$n" ] || fail "skills/$n was not linked (or does not resolve)"
done
for p in "$DST"/*; do
  if [ -L "$p" ] && [ ! -e "$p" ] && [ "$(basename "$p")" != "dangling-theirs" ]; then
    fail "left a dangling link behind: $(basename "$p")"
  fi
done

grep -q 'pruned  dangling-ours' "$LOG" || fail "prune was not reported on stdout"
grep -q 'kept    dangling-theirs' "$LOG" || fail "kept-link was not reported on stdout"

# ---- idempotency: a second run is a no-op (nothing left to prune) -----------------------------
CLAUDE_SKILLS_DIR="$DST" "$REPO_DIR/install.sh" > "$LOG.2" 2>&1 || { cat "$LOG.2"; fail "second run exited non-zero"; }
grep -q 'pruned' "$LOG.2" && fail "second run pruned something — not idempotent"

[ -L "$DST/dangling-theirs" ] || fail "second run deleted the other tool's link"
[ -d "$DST/real-dir-skill" ] || fail "second run disturbed the real directory"

echo "install.sh prune: all 4 cases correct, idempotent on re-run — PASS"
