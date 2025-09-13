# Claude Code User Guide

Welcome to Claude Code! This guide will help you get the most out of your AI-powered development environment.

## 🎁 What You Just Got

### Core Components

**✓ CLAUDE.md** - Your AI coding rules and instructions for Claude Code
- Contains your project's coding rules and TDD methodology
- Guides Claude Code on how to write, test, and review code
- Includes MCP server usage patterns and best practices
- Updated automatically as you configure new tools

**✓ Claude Code Agents** - Specialized AI assistants for different tasks:
- **Planner** - Breaks down requirements into implementation steps
- **Test Writer** - Creates comprehensive test suites following TDD principles
- **PE Reviewer** - Principal Engineer-level code reviews and quality analysis
- **Debugger** - Finds and fixes issues with minimal, targeted changes
- **Security Reviewer** - Security-focused code analysis and vulnerability detection

### MCP Server Integrations

**✓ Supabase** - Database operations and authentication
- Database schema creation and management
- Row Level Security (RLS) policy configuration
- Real-time subscriptions and triggers
- Authentication and user management
- TypeScript type generation from database schema

**✓ GitHub** - Repository management and code analysis
- Repository creation, branch management, and pull requests
- Issue tracking and project management
- Code search across repositories
- Release management and changelog generation

**✓ Brave Search** - Web search and current information
- Real-time web search for latest information
- Research support for technical questions
- Competitive analysis and market research
- Finding authoritative sources and documentation

**✓ Tavily** - Research and web content extraction  
- Advanced web crawling and site mapping
- Content extraction from multiple sources
- Comprehensive research on architectural patterns
- Deep analysis of existing systems and implementations

**✓ Context7** - Documentation and API references
- Up-to-date library documentation and code examples
- API reference materials for popular frameworks
- Integration patterns and best practices
- Version-specific documentation access

**✓ n8n** - Workflow automation and integrations
- Automated workflow creation and management
- Integration with external services and APIs
- Event-driven automation setup
- Workflow monitoring and debugging

**✓ Cloudflare SSE** - Worker bindings and build management
- Cloudflare Workers development and deployment
- KV storage, R2 buckets, and D1 database management
- Real-time server-sent events for live updates
- Build monitoring and deployment automation

## 🚀 Getting Started

### 1. Initial Setup
```bash
# Navigate to your project directory
cd your-project

# Start Claude Code
claude
```

### 2. Verify Installation
- ✓ Claude extension already installed in VS Code
- ✓ MCP servers configured and ready
- ✓ Project files scaffolded (CLAUDE.md, .claude/)

### 3. First Steps
1. Open VS Code in your project directory
2. Open terminal (Cmd+` or Ctrl+`)
3. Run: `claude`
4. You're ready to start coding with AI!

## ⚡ Claude Code Shortcuts - Your New Superpowers

### Essential Workflow Commands

**`qnew`** - Run before each new feature
- Refreshes Claude Code's context with your project rules
- Sets up proper coding standards and TDD methodology
- **Example**: Type `qnew` then "I want to add user authentication"

**`qplan`** - Creates detailed implementation plans
- Analyzes requirements and breaks them into steps
- Considers existing codebase patterns and architecture
- **Example**: `qplan - I want a new web form that collects email, first name, and last name`

**`qcode`** - Executes the plan and writes the code
- Implements features following TDD principles
- Writes tests first, then implementation code
- **Example**: After qplan, just type `qcode` to implement

**`qcheck`** - Principal Engineer code review + QA analysis
- Comprehensive code quality analysis
- Security vulnerability scanning
- Performance optimization suggestions
- **Example**: `qcheck` - If issues found, run qplan to fix them, then qcode + qcheck

**`qdoc`** - Updates all documentation
- Automatically updates README, CHANGELOG, and API docs
- Maintains user and developer documentation
- **Example**: `qdoc` after completing features

**`qgit`** - Commits your work to Git with proper messages
- Creates conventional commit messages
- Ensures all tests pass before committing
- **Example**: `qgit` when ready to save your progress

### Advanced Research Commands

**`qidea`** - Zero-code research and ideation
- Architecture brainstorming and design options
- UX recommendations and user experience patterns
- Testing strategies and quality assurance approaches
- **Example**: `qidea - What's the best architecture for a real-time chat application?`

**`qux`** - User experience testing scenarios
- Generates comprehensive UX test scenarios
- Prioritizes testing by importance and user impact
- **Example**: `qux` after implementing user-facing features

## 🔐 Authentication & Setup

### Cloudflare SSE Authentication
⚠️  **IMPORTANT**: For Cloudflare servers, you must authenticate in Claude Code:
- Open Claude Code and run: `/mcp cloudflare-bindings`
- Open Claude Code and run: `/mcp cloudflare-builds`
- Follow the authentication prompts for each
- ⚠️  Note: `npx wrangler login` does NOT work with MCP servers

### Other MCP Server Authentication
Most other MCP servers use API keys that you configure during setup:
- **Supabase**: Project URL and service role key
- **GitHub**: Personal access token with appropriate scopes
- **Brave Search**: API key from Brave Search API
- **Tavily**: API key from Tavily platform

## 🎯 Practical Examples

### Building a Todo App
```
1. qnew
2. "I want to build a simple todo app with React and Supabase"
3. qplan
4. qcode
5. qcheck (fix any issues if found)
6. qdoc
7. qgit
```

### Adding Authentication
```
1. qnew  
2. "Add user authentication with email/password login"
3. qplan
4. qcode
5. qcheck
6. Test: "/mcp supabase" to verify database setup
7. qdoc
8. qgit
```

### Research Phase
```
1. qidea
2. "What are the best practices for React state management in 2024?"
3. Use Brave Search results to inform your decisions
4. qplan with specific architecture choices
5. qcode to implement
```

## 🔍 Troubleshooting

### Common Issues

**MCP Server Connection Issues**
- Run `/mcp list` in Claude Code to check server status
- For SSE servers (Cloudflare): Ensure authentication via `/mcp <server-name>`
- For API-based servers: Verify API keys are correctly configured

**Tests Failing**
- Run `qcheck` to identify specific issues
- Use `qplan` to create a fix strategy
- Run `qcode` to implement fixes
- Repeat until `qcheck` passes

**Code Quality Issues** 
- `qcheck` will identify code quality problems
- Follow the PE review suggestions
- Use `qplan` + `qcode` to implement improvements

**Documentation Out of Date**
- Run `qdoc` after any major changes
- This updates README, CHANGELOG, and API documentation
- Happens automatically but can be run manually anytime

### Getting Help

**Check Your Setup**
```bash
# Verify Claude Code installation
claude --version

# Check MCP server status
claude mcp list

# Verify project structure
ls -la .claude/
```

**Research and Support**
- Use `qidea` for architecture and design questions
- Search for "Claude Code best practices 2024" using Brave Search integration
- Check the CLAUDE.md file for your project's specific coding rules

## 📖 Advanced Usage

### MCP Server Usage Patterns

**Database Operations (Supabase)**
- Use during `qcode` for database implementations
- Best for schema creation, RLS policies, and auth setup
- Integration with TypeScript type generation

**Repository Management (GitHub)**
- Use during `qgit` for PR creation and management
- Best for issue analysis during `qplan` phase
- Changelog generation during `qdoc`

**Research and Information (Brave Search & Tavily)**
- Use during `qidea` for research and competitive analysis
- Best for finding current best practices and documentation
- Avoid during `qcode` - focus on implementation

**Real-time Features (Cloudflare SSE)**
- Use during `qcode` for server-sent events and Workers
- Best for real-time updates and edge computing
- Integration with KV, R2, and D1 services

### Customizing Your Workflow

**Project-Specific Rules**
Edit your CLAUDE.md file to customize:
- Coding standards and style preferences
- Testing requirements and frameworks
- Architecture patterns and constraints
- MCP server usage guidelines

**Environment Configuration**
Configure `.claude/settings.json` for:
- MCP server credentials and endpoints
- Agent behavior and preferences
- Project-specific tool integrations

## 🎉 You're Ready!

Start with a simple feature using the essential workflow:
1. `qnew` - Set context
2. Describe what you want to build
3. `qplan` - Get implementation plan
4. `qcode` - Build it
5. `qcheck` - Review quality
6. `qdoc` - Update docs
7. `qgit` - Commit changes

The AI will guide you through each step, ensuring high-quality, well-tested, and properly documented code. Welcome to the future of development!