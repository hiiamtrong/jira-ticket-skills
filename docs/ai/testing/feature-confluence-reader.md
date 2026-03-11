---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
feature: confluence-reader
---

# Testing Strategy — Confluence Reader Skill

## Test Coverage Goals

- Unit test coverage: 100% of new/modified functions in `mcp-writer.mjs`, `skill-writer.mjs`, `detect-tool.mjs`, `prompts.mjs`
- Integration test: full installer run with Confluence enabled (dry-run / fixture-based)
- Manual testing: Skill invocation in Claude Code against a real Confluence instance
- Regression: existing Jira-only install flow must be unaffected

## Unit Tests

> **Status: ✅ All 45 unit tests passing** (`npm test` — 2026-03-11)
> Test files: [`test/detect-tool.test.mjs`](../../../test/detect-tool.test.mjs), [`test/mcp-writer.test.mjs`](../../../test/mcp-writer.test.mjs), [`test/skill-writer.test.mjs`](../../../test/skill-writer.test.mjs), [`test/prompts.test.mjs`](../../../test/prompts.test.mjs)

### `src/writers/mcp-writer.mjs` → [`test/mcp-writer.test.mjs`](../../../test/mcp-writer.test.mjs)

- [x] `buildMcpServers` — `confluenceEnabled: false` → no `confluence` key in result
- [x] `buildMcpServers` — `confluenceEnabled: true`, `api_token` auth → includes `CONFLUENCE_API_TOKEN` + `CONFLUENCE_USERNAME`
- [x] `buildMcpServers` — `confluenceEnabled: true`, `personal_token` auth → includes `CONFLUENCE_PERSONAL_TOKEN` only
- [x] `buildMcpServers` — `jiraRunner: 'uv'` → confluence server uses `uv tool run` args
- [x] `uninstallMcp` — removes `'confluence'` key from existing config
- [x] `uninstallMcp` — handles missing `confluence` key gracefully (no error)
- [x] `installMcp(cursor)` — writes to `.cursor/mcp.json` (correct tool-specific path)
- [x] Jira and confluence servers coexist after install

### `src/writers/skill-writer.mjs` → [`test/skill-writer.test.mjs`](../../../test/skill-writer.test.mjs)

- [x] `installConfluenceSkill` — copies `templates/read-confluence-docs/SKILL.md` to correct tool path
- [x] `installConfluenceSkill` — file content matches template byte-for-byte
- [x] `installConfluenceSkill` — logs warning if file already exists, then overwrites
- [x] `installConfluenceSkill` — works for all three tools: `claude`, `cursor`, `antigravity`
- [x] `installConfluenceSkill` — throws on unknown tool key
- [x] `uninstallConfluenceSkill` — removes file and cleans up empty dir
- [x] `uninstallConfluenceSkill` — handles non-existent file gracefully (idempotent)
- [x] `uninstallConfluenceSkill` — unknown tool is silently ignored

### `src/detect-tool.mjs` → [`test/detect-tool.test.mjs`](../../../test/detect-tool.test.mjs)

- [x] `TOOL_CONFIGS.claude.confluenceSkillDir(root)` → `{root}/.claude/skills/read-confluence-docs`
- [x] `TOOL_CONFIGS.cursor.confluenceSkillDir(root)` → `{root}/.cursor/skills/read-confluence-docs`
- [x] `TOOL_CONFIGS.antigravity.confluenceSkillDir(root)` → `{root}/.agent/skills/read-confluence-docs`
- [x] All tools have `confluenceSkillDir` (function) and `confluenceSkillFile` (string)
- [x] Confluence skill dirs are sibling to Jira skill dirs (same parent)

### `src/prompts.mjs` → [`test/prompts.test.mjs`](../../../test/prompts.test.mjs)

- [x] `runNonInteractive` — both `CONFLUENCE_URL` + `CONFLUENCE_TOKEN` set → `confluenceEnabled: true`, all fields populated
- [x] `runNonInteractive` — `CONFLUENCE_URL` not set → `confluenceEnabled: false`
- [x] `runNonInteractive` — `CONFLUENCE_TOKEN` not set → `confluenceEnabled: false`
- [x] `runNonInteractive` — `CONFLUENCE_EMAIL` set → `confluenceAuthMethod: 'api_token'`
- [x] `runNonInteractive` — `CONFLUENCE_EMAIL` not set → `confluenceAuthMethod: 'personal_token'`
- [x] `runNonInteractive` — URL without scheme gets `https://` prepended
- [x] `runNonInteractive` — whitespace trimmed from URL and token
- [x] Existing Jira required-field errors unaffected

## Integration Tests

- [ ] Full install with `confluenceEnabled: true` (fixture-based): verify MCP config has `confluence` entry, skill file written to correct path
- [ ] Full install with `confluenceEnabled: false`: verify no `confluence` MCP entry, no skill file written
- [ ] Uninstall: verify `confluence` MCP entry removed, skill file deleted
- [ ] Re-install (idempotent): running install twice overwrites config without errors
- [ ] Existing Jira-only project: adding Confluence via re-run doesn't corrupt existing Jira MCP entry

## End-to-End Tests (Manual)

- [ ] **Skill: search by query** — Invoke `read-confluence-docs` in Claude Code with "search for authentication docs in TEAM space" → verify CQL search executes and returns results
- [ ] **Skill: fetch by URL** — Provide a real Confluence page URL → verify page content is fetched and summarized
- [ ] **Skill: fetch by page ID** — Provide a numeric page ID → verify `confluence_get_page` is called correctly
- [ ] **Skill: child pages** — After fetching a parent page, ask for child pages → verify `confluence_get_page_children` is used
- [ ] **Skill: not found** — Provide a non-existent page ID → verify graceful error message
- [ ] **Jira integration** — Open a Jira ticket containing a Confluence link → verify `resolve-jira-ticket` skill detects the link and invokes `read-confluence-docs`
- [ ] **Installer: Cloud** — Run `npx jira-ticket-skills` with Atlassian Cloud credentials → Confluence URL pre-filled with `/wiki` suffix, api_token auth, MCP config written correctly
- [ ] **Installer: Server/DC** — Run with personal token auth → `CONFLUENCE_PERSONAL_TOKEN` in MCP config

## Test Data

- Mock Confluence API responses for unit tests (page object, search results, children list)
- Fixtures: sample `.mcp.json` before and after Confluence install
- Real Confluence instance credentials stored in `.env.test` (gitignored) for manual E2E tests

## Test Reporting & Coverage

- Run: `npm test` → executes `node --test test/**/*.test.mjs`
- **Result: 45 tests / 45 pass / 0 fail** (2026-03-11)
- Coverage gaps rationale: `prompts.mjs` interactive prompts are hard to unit test — covered by integration test using `runNonInteractive()`

## Manual Testing

- [ ] Verify skill triggers in Claude Code when user types "read the Confluence page about X"
- [ ] Verify skill does NOT trigger for general questions unrelated to Confluence
- [ ] Verify Confluence MCP server starts correctly (`uvx mcp-atlassian` with Confluence env vars)
- [ ] Test on macOS and confirm `uvx` is detected correctly via `checkPrerequisites()`

## Bug Tracking

- File issues at the project repo with label `confluence-reader`
- Severity: P0 = broken install, P1 = skill fails to fetch pages, P2 = cosmetic/UX issues
