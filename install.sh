#!/usr/bin/env bash
# Install the house SDLC skills as LOCAL Claude Code skills — no plugin, no marketplace.
# Symlinks each skills/<name> into ~/.claude/skills/<name> so `git pull` updates them live.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO_DIR/skills"
SKILLS_DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
MODE="${1:-symlink}"   # symlink (default) | copy

mkdir -p "$SKILLS_DST"

for dir in "$SKILLS_SRC"/*/; do
  name="$(basename "$dir")"
  target="$SKILLS_DST/$name"
  # Back up an existing non-symlink install once.
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mv "$target" "$target.bak.$(date +%s)"
    echo "backed up existing $target"
  fi
  rm -f "$target"
  if [ "$MODE" = "copy" ]; then
    cp -R "$dir" "$target"
    echo "copied  $name -> $target"
  else
    ln -s "${dir%/}" "$target"
    echo "linked  $name -> ${dir%/}"
  fi
done

echo
echo "Installed: $(ls -1 "$SKILLS_SRC" | tr '\n' ' ')"
echo "The workflow scriptPaths in house-orchestrator/SKILL.md assume the install dir is"
echo "  $SKILLS_DST/house-orchestrator/workflows/"
echo "If you installed elsewhere, update those two scriptPath lines (or symlink-install, which keeps them valid)."
echo "Run /reload-skills (or restart Claude Code) to pick up the changes."
