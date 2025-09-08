
## `scripts/setup-claude-mac.sh` (portable Homebrew + safer code CLI)
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Sparkry.AI — Mac bootstrap for Claude Code + VS Code"

# Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "• Installing Homebrew (you’ll be prompted)…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Node LTS
if ! command -v node >/dev/null 2>&1; then
  echo "• Installing Node.js LTS…"
  brew install node@20
  BREW_NODE_PREFIX="$(brew --prefix node@20 || true)"
  if [ -n "${BREW_NODE_PREFIX:-}" ]; then
    if ! echo "$PATH" | grep -q "$BREW_NODE_PREFIX/bin"; then
      echo "export PATH=\"$BREW_NODE_PREFIX/bin:\$PATH\"" >> "$HOME/.zprofile"
      export PATH="$BREW_NODE_PREFIX/bin:$PATH"
    fi
  fi
fi

# VS Code
if ! command -v code >/dev/null 2>&1; then
  echo "• Installing Visual Studio Code…"
  brew install --cask visual-studio-code
fi

# Claude Code CLI + VS Code extension
if ! command -v claude >/dev/null 2>&1; then
  echo "• Installing Claude Code CLI…"
  npm install -g @anthropic-ai/claude-code
fi

echo "• Ensuring VS Code extension present (best effort)…"
if command -v code >/dev/null 2>&1; then
  code --install-extension anthropic.claude-code || true
else
  echo "  (VS Code CLI 'code' not found in PATH; you can install it from VS Code: Cmd+Shift+P → 'Shell Command: Install code command')"
fi

echo "✅ Done. Open your repo in VS Code, open the terminal, run: claude"

