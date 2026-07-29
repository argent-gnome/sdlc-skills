#!/usr/bin/env bash
# Install the house SDLC skills as LOCAL Claude Code skills — no plugin, no marketplace.
# Symlinks each skills/<name> into ~/.claude/skills/<name> so `git pull` updates them live.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO_DIR/skills"
SKILLS_DST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
MODE="${1:-symlink}"   # symlink (default) | copy

mkdir -p "$SKILLS_DST"

# ---- prune stale links left by a previous layout (a rename, an archive) -----------------------
# Scope is deliberately narrow: a symlink is removed ONLY if it both (a) no longer resolves and
# (b) points into THIS repo's skills/ dir. A dangling link belonging to some other tool is another
# owner's business and is reported, not deleted; a working link and a real directory are untouched.
# Without this, renaming or archiving a skill dir leaves its old link dangling in the install dir on
# every repo on the machine, because the link loop below only ever creates, never removes.
for p in "$SKILLS_DST"/*; do
  if [ ! -L "$p" ]; then continue; fi          # real dir/file, or the unexpanded glob: leave alone
  if [ -e "$p" ]; then continue; fi            # target still resolves: still a live skill
  link_target="$(readlink "$p")"
  case "$link_target" in
    "$SKILLS_SRC"/*)
      rm -f "$p"
      echo "pruned  $(basename "$p") (dangling -> $link_target)"
      ;;
    *)
      echo "kept    $(basename "$p") (dangling, but not from this repo -> $link_target)"
      ;;
  esac
done

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

# ---- house CLI (v2 S2): deps + global bin ------------------------------------
# cli/node_modules is gitignored — a bare symlink of bin/house.js cannot resolve js-yaml.
echo
echo "Installing house CLI dependencies…"
(cd "$REPO_DIR/cli" && npm install --no-fund --no-audit --silent)
if command -v house >/dev/null 2>&1; then
  echo "house CLI already on PATH: $(command -v house)"
else
  echo "Linking house CLI (npm link)…"
  (cd "$REPO_DIR/cli" && npm link) || {
    echo "npm link failed (global prefix not writable?) — falling back to ~/.local/bin"
    mkdir -p "$HOME/.local/bin"
    ln -sf "$REPO_DIR/cli/bin/house.js" "$HOME/.local/bin/house"
    case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "NOTE: add ~/.local/bin to PATH";; esac
  }
fi

echo
echo "Installed: $(ls -1 "$SKILLS_SRC" | tr '\n' ' ')"
echo "Run /reload-skills (or restart Claude Code) to pick up the changes."
