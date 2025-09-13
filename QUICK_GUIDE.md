# Claude Code Quick Start ⚡

*Get productive in 2 minutes*

## 📦 Installation

```bash
npx claude-code-quickstart init
```
*Installs MCP servers, creates CLAUDE.md, configures everything*

## 🚀 Essential Commands

**Start Building**
```
claude          # Start Claude Code
qnew            # Set context for new feature  
qplan           # Plan implementation
qcode           # Write the code
```

**Quality & Deploy**  
```
qcheck          # Review code quality
qgit            # Commit to Git
```

## 🎯 First Project

1. **Setup** (30 seconds)
   ```bash
   mkdir my-app && cd my-app
   npx claude-code-quickstart init
   claude
   ```

2. **Build** (60 seconds)
   ```
   qnew
   "I want to build a simple todo app"
   qplan
   qcode
   ```

3. **Ship** (30 seconds)
   ```  
   qcheck
   qgit
   ```

## 🔐 One-Time Setup

**Cloudflare Authentication** (if using)
```
/mcp cloudflare-bindings
/mcp cloudflare-builds
```
*Follow prompts in Claude Code*

## ✅ You're Ready!

- ✓ AI writes tests first, then code
- ✓ Principal Engineer code reviews  
- ✓ Automatic documentation updates
- ✓ Smart Git commits

**Try it**: `qnew` → "Add user login" → `qplan` → `qcode`

---
*Need help? Check USER_GUIDE.md for complete instructions*