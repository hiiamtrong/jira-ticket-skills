# jira-ticket-skills

Install Jira ticket resolution skills for AI coding tools — **Claude Code**, **Cursor**, and **Antigravity**.

One command sets up everything: skill files, Jira MCP server, optional Figma integration, and environment config.

## Quick Start

```bash
npx jira-ticket-skills
```

The installer will prompt for:
- Your Jira instance URL
- Authentication credentials (Personal Token or API Token)
- Default project key (e.g., `PRJ`)
- Whether to enable Figma design integration

## What Gets Installed

| File | Purpose |
|------|---------|
| `.claude/skills/resolve-jira-ticket/SKILL.md` | The skill definition (Claude Code) |
| `.cursor/skills/resolve-jira-ticket/SKILL.md` | The skill definition (Cursor) |
| `.agent/skills/resolve-jira-ticket/SKILL.md` | The skill definition (Antigravity) |
| `.mcp.json` / `.cursor/mcp.json` | MCP server configs (Jira + Figma) |
| `.claude/settings.json` | Environment variables (`JIRA_PROJECT_KEY`) |

Only files for your selected tool(s) are created.

## Usage

After installation, invoke the skill in your AI tool:

```
/resolve-jira-ticket           # List your assigned tickets
/resolve-jira-ticket PRJ-123   # Work on a specific ticket
```

The skill orchestrates a 6-phase workflow:

1. **Fetch** — Search Jira for assigned tickets or use a provided ID
2. **Analyze** — Deep-read ticket details, ALL comments, linked issues, Figma links
3. **Design** — Extract Figma specs and create ASCII wireframes (if Figma links found)
4. **Map** — Find relevant code paths in the codebase
5. **Debug/Implement** — Root cause analysis → fix (using systematic-debugging)
6. **Verify** — Run tests, lint, confirm with evidence

## Prerequisites

- **Node.js** >= 18
- **uvx** (for Jira MCP server) — Install: `pip install uv`
- **Figma desktop app** (optional, for Figma Bridge integration)

## Superpowers (Recommended)

The skill chains three [superpowers](https://github.com/obra/superpowers) skills for a rigorous workflow. Install them for your tool:

**Claude Code:**
```bash
claude plugins install superpowers
```

**Cursor:**
```bash
npm install -g prpm && prpm install collections/superpowers
# or
bun add -g openskills && openskills install obra/superpowers --universal --global && openskills sync
```

**Antigravity:**
```bash
# Clone and copy skills into .agent/skills/
git clone https://github.com/anthonylee991/gemini-superpowers-antigravity
```

## CLI Options

```
npx jira-ticket-skills              # Interactive install
npx jira-ticket-skills --uninstall  # Remove skill + configs
npx jira-ticket-skills --yes        # Non-interactive (env vars)
npx jira-ticket-skills --tool claude # Force specific tool
npx jira-ticket-skills --no-figma   # Skip Figma integration
```

### Non-Interactive Mode

For CI or scripted setups, use `--yes` with environment variables:

```bash
JIRA_URL=https://jira.example.com \
JIRA_TOKEN=your-token \
JIRA_PROJECT_KEY=PRJ \
TOOL=claude \
npx jira-ticket-skills --yes
```

## Uninstall

```bash
npx jira-ticket-skills --uninstall
```

Removes skill files, MCP server entries, and settings we added. Does not affect other MCP servers or settings.

## License

MIT
