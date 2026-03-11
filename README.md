# jira-ticket-skills

Install Jira ticket resolution skills for AI coding tools — **Claude Code**, **Cursor**, and **Antigravity**.

One command sets up everything: skill files, Jira MCP server, optional Confluence integration, optional Figma integration, and environment config.

## Quick Start

```bash
npx jira-ticket-skills
```

The installer will prompt for:
- Your Jira instance URL
- Authentication credentials (Personal Token or API Token)
- Default project key (e.g., `PRJ`)
- Whether to enable Confluence integration (read docs from your AI tool)
- Whether to enable Figma design integration

## What Gets Installed

| File                                               | Purpose                                    |
| -------------------------------------------------- | ------------------------------------------ |
| `.claude/skills/resolve-jira-ticket/SKILL.md`      | Jira skill (Claude Code)                   |
| `.claude/skills/read-confluence-docs/SKILL.md`     | Confluence skill (Claude Code, if enabled) |
| `.cursor/skills/resolve-jira-ticket/SKILL.md`      | Jira skill (Cursor)                        |
| `.cursor/skills/read-confluence-docs/SKILL.md`     | Confluence skill (Cursor, if enabled)      |
| `.agent/skills/resolve-jira-ticket/SKILL.md`       | Jira skill (Antigravity)                   |
| `.agent/skills/read-confluence-docs/SKILL.md`      | Confluence skill (Antigravity, if enabled) |
| `.mcp.json` / `.cursor/mcp.json`                   | MCP server configs (Jira + Confluence + Figma) |
| `.claude/settings.json`                            | Environment variables (`JIRA_PROJECT_KEY`) |

Only files for your selected tool(s) are created.

## Usage

After installation, invoke the skill in your AI tool:

```
/resolve-jira-ticket           # List your assigned tickets
/resolve-jira-ticket PRJ-123   # Work on a specific ticket
```

The skill orchestrates a 6-phase workflow:

1. **Fetch** — Search Jira for assigned tickets or use a provided ID
2. **Analyze** — Deep-read ticket details, ALL comments, linked issues, Confluence + Figma links
3. **Confluence** — Auto-fetch linked Confluence docs for full documentation context (if Confluence links found)
4. **Design** — Extract Figma specs and create ASCII wireframes (if Figma links found)
5. **Map** — Find relevant code paths in the codebase
6. **Debug/Implement** — Root cause analysis → fix (using systematic-debugging)
7. **Verify** — Run tests, lint, confirm with evidence

### Confluence Integration

After installation with Confluence enabled, you can also invoke the Confluence skill directly:

```
/read-confluence-docs                                    # Search by topic
/read-confluence-docs https://company.atlassian.net/... # Fetch a specific page
```

The skill searches, fetches, and summarizes Confluence pages — and is automatically chained by `/resolve-jira-ticket` when Confluence links are detected in a ticket.

## Prerequisites

- **Node.js** >= 18
- **uvx** (for Jira MCP server) — Install: `pip install uv`
- **Figma desktop app** (optional, for Figma Bridge integration)

## Superpowers (Recommended)

The skill chains three [superpowers](https://github.com/obra/superpowers) skills for a rigorous workflow. Install them for your tool:

**Claude Code:**
```bash
claude plugin install superpowers
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

To include Confluence in non-interactive mode:

```bash
JIRA_URL=https://company.atlassian.net \
JIRA_TOKEN=your-jira-token \
JIRA_PROJECT_KEY=PRJ \
CONFLUENCE_URL=https://company.atlassian.net/wiki \
CONFLUENCE_TOKEN=your-confluence-token \
CONFLUENCE_EMAIL=you@company.com \
TOOL=claude \
npx jira-ticket-skills --yes
```

> `CONFLUENCE_EMAIL` is required for Atlassian Cloud (API token auth). Omit it for Server/DC (PAT auth).

## Uninstall

```bash
npx jira-ticket-skills --uninstall
```

Removes skill files, MCP server entries, and settings we added. Does not affect other MCP servers or settings.

## License

MIT
