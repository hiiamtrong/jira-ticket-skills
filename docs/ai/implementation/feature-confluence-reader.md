---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
feature: confluence-reader
---

# Implementation Guide — Confluence Reader Skill

## Development Setup
**How do we get started?**

- Prerequisites: Node.js ≥ 18, `uvx` installed (`pip install uv` or `brew install uv`)
- Clone the repo and run `npm install`
- To test the installer locally: `node bin/cli.mjs` from the project root
- To test the skill: install to a test project and invoke from Claude Code

## Code Structure
**How is the code organized?**

```
templates/
  read-confluence-docs/
    SKILL.md                  ← NEW: Confluence reader skill template

src/
  prompts.mjs                 ← MODIFY: add Confluence prompts (step 4)
  detect-tool.mjs             ← MODIFY: add confluenceSkillDir/File to TOOL_CONFIGS
  writers/
    mcp-writer.mjs            ← MODIFY: add 'confluence' MCP server entry
    skill-writer.mjs          ← MODIFY: add installConfluenceSkill() / uninstallConfluenceSkill()
    settings-writer.mjs       ← MODIFY (optional): write CONFLUENCE_URL to env if needed

src/
  installer.mjs               ← MODIFY: call installConfluenceSkill() during install/uninstall loops

templates/
  resolve-jira-ticket/
    SKILL.md                  ← MODIFY: detect Confluence links, invoke read-confluence-docs
```

## Implementation Notes

### Core Features

**Feature 1: `templates/read-confluence-docs/SKILL.md`**

Key sections to include:
- Trigger description in frontmatter: activate when user mentions Confluence pages, documentation, wiki, or provides a Confluence URL
- Phase 1: Input parsing — detect if input is a URL, page ID, or search query
  - URL pattern: `*.atlassian.net/wiki/spaces/<SPACE>/pages/<ID>/...`
  - Extract page ID from URL: the numeric segment after `/pages/`
- Phase 2: Fetch — use `confluence_get_page` for IDs/URLs, `confluence_search` with CQL for queries
  - CQL example: `text ~ "authentication" AND space = "TEAM" ORDER BY lastModified DESC`
- Phase 3: Output — structured summary with page title, space, last modified, content summary, and offer to expand
- Phase 4: Child pages — call `confluence_get_page_children` and list them

**Feature 2: `src/prompts.mjs` — Confluence prompts**

Insert after the Figma block (around line 104), before `return config`:
```js
// ── 4. Confluence configuration ──────────────────────────────────────────
if (!cliArgs.noConfluence) {
  log.step('Confluence Integration');

  const confluenceEnable = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Add Confluence integration (read docs from AI)?',
    initial: true,
  });
  config.confluenceEnabled = confluenceEnable.value ?? false;

  if (config.confluenceEnabled) {
    // URL — pre-fill with Jira URL + /wiki for Cloud
    const defaultConfluenceUrl = config.jiraUrl
      ? config.jiraUrl.replace(/\/$/, '') + '/wiki'
      : '';
    // ... ask URL, auth method, email (if api_token), token
  }
}
```

**Feature 3: `src/writers/mcp-writer.mjs` — add confluence server**

In `buildMcpServers(config)`, after the `figma-bridge` block:
```js
if (config.confluenceEnabled) {
  const confluenceEnv = { CONFLUENCE_URL: config.confluenceUrl };
  if (config.confluenceAuthMethod === 'api_token') {
    confluenceEnv.CONFLUENCE_API_TOKEN = config.confluenceToken;
    confluenceEnv.CONFLUENCE_USERNAME = config.confluenceEmail;
  } else {
    confluenceEnv.CONFLUENCE_PERSONAL_TOKEN = config.confluenceToken;
  }
  servers.confluence = {
    command: config.jiraRunner === 'uv' ? 'uv' : 'uvx',
    args: config.jiraRunner === 'uv'
      ? ['tool', 'run', 'mcp-atlassian']
      : ['mcp-atlassian'],
    env: confluenceEnv,
  };
}
```

Also update `uninstallMcp()`: add `'confluence'` to `serversToRemove`.

**Feature 4: `src/detect-tool.mjs` — tool configs**

Add to each entry in `TOOL_CONFIGS`:
```js
claude: {
  // ...existing fields...
  confluenceSkillDir: (root) => path.join(root, '.claude', 'skills', 'read-confluence-docs'),
  confluenceSkillFile: 'SKILL.md',
},
```

**Feature 5: `src/writers/skill-writer.mjs` — Confluence skill install**

Mirror `installSkill()` but point to `templates/read-confluence-docs/SKILL.md` and use `config.confluenceSkillDir`:
```js
const CONFLUENCE_TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'read-confluence-docs');

export function installConfluenceSkill(projectRoot, toolKey) {
  const config = getToolConfig(toolKey);
  if (!config) throw new Error(`Unknown tool: ${toolKey}`);

  const srcFile = path.join(CONFLUENCE_TEMPLATE_DIR, 'SKILL.md');
  const destDir = config.confluenceSkillDir(projectRoot);
  const destFile = path.join(destDir, config.confluenceSkillFile);

  if (fileExists(destFile)) {
    log.warn(`Skill already exists: ${path.relative(projectRoot, destFile)} (overwriting)`);
  }
  copyFile(srcFile, destFile);
  log.success(`Installed Confluence skill: ${path.relative(projectRoot, destFile)}`);
}
```

### Patterns & Best Practices

- Follow the exact same pattern as `installSkill()` — no new abstractions needed
- Keep Confluence prompts optional and grouped under a clear `log.step()` header
- Always check `if (config.confluenceEnabled)` before writing any Confluence files
- Pre-fill Confluence URL from Jira URL to reduce friction for Atlassian Cloud users
- Use the same `'password'` prompt type for Confluence token (same as Jira token)

## Integration Points

**`src/installer.mjs` install loop** (inside `for (const toolKey of config.tools)`):
```
installSkill(projectRoot, tool)           // existing Jira skill — unchanged
if (config.confluenceEnabled) {
  installConfluenceSkill(projectRoot, tool) // NEW
}
installMcp(projectRoot, tool, config)     // already handles confluence via updated buildMcpServers
installSettings(projectRoot, tool, config) // unchanged — no Confluence changes needed here
```

**`resolve-jira-ticket/SKILL.md` integration:**
In Phase 2 (Ticket Analysis), add Confluence link detection after Figma:
```
**Confluence link detection** — Scan description, comments, and remote links for Confluence URLs:
- Patterns: `*.atlassian.net/wiki/...`, `confluence.*/display/...`, `confluence.*/pages/...`
If found: **INVOKE** `read-confluence-docs` with each Confluence URL before proceeding to Phase 3.
```

## Error Handling

- Confluence prompts: check `undefined` return (user cancelled) same as Jira prompts
- Skill error handling: if `confluence_get_page` returns not-found, display message and ask for alternative input
- If `mcp-atlassian` is not available at runtime, the Confluence MCP server will fail to start — this is handled by the existing `checkPrerequisites()` warning about `uvx`

## Security Notes

- Confluence token is written to the MCP config `env` block — same security model as Jira token
- Never log or print the token value
- `settings-writer.mjs` is **not modified** — Confluence URL and token are fully covered by the MCP `env` block; no duplication into Claude Code settings needed
