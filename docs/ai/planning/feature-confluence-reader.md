---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
feature: confluence-reader
---

# Project Planning & Task Breakdown — Confluence Reader Skill

## Milestones

- [ ] Milestone 1: Confluence skill template created and manually testable
- [ ] Milestone 2: Installer CLI collects Confluence config and writes MCP entry
- [ ] Milestone 3: Skill files installed for all three AI tools via installer
- [ ] Milestone 4: `resolve-jira-ticket` skill updated to chain into `read-confluence-docs`
- [ ] Milestone 5: Tests passing, docs updated, version bumped

## Task Breakdown

### Phase 1: Skill Template

- [ ] **1.1** Create `templates/read-confluence-docs/SKILL.md`
  - YAML frontmatter: `name: read-confluence-docs`, trigger description
  - Phase 1: Accept input (URL, page ID, or search query)
  - Phase 2: Search or fetch via `confluence_search` / `confluence_get_page`
  - Phase 3: Summarize and present with structured output
  - Phase 4: Offer to read child pages or related pages
  - Error handling: not found, access denied, ambiguous results
  - Quick reference table of available MCP tools

- [ ] **1.2** Manually test `SKILL.md` in Claude Code with a real Confluence instance
  - Verify `confluence_search` CQL query works
  - Verify `confluence_get_page` by ID and URL works
  - Verify child page discovery works

### Phase 2: Installer — Prompts

- [ ] **2.1** Add Confluence prompts to `src/prompts.mjs`
  - After Figma step, add: "Add Confluence integration?" (confirm, default true if Jira URL set)
  - If yes: ask `CONFLUENCE_URL` (pre-fill with Jira base URL + `/wiki` for Cloud)
  - Ask auth method: `api_token` (Cloud) or `personal_token` (Server/DC)
  - If `api_token`: ask email (pre-fill from Jira email if set)
  - Ask Confluence token (password input)

- [ ] **2.2** Update `runNonInteractive()` in `src/prompts.mjs`
  - Read `CONFLUENCE_URL`, `CONFLUENCE_TOKEN`, `CONFLUENCE_EMAIL` env vars
  - Set `confluenceEnabled: true` if `CONFLUENCE_URL` is set

### Phase 3: MCP Writer

- [ ] **3.1** Update `buildMcpServers(config)` in `src/writers/mcp-writer.mjs`
  - Add `confluence` server entry when `config.confluenceEnabled === true`
  - Handle both `api_token` and `personal_token` auth

- [ ] **3.2** Update `uninstallMcp()` in `src/writers/mcp-writer.mjs`
  - Add `'confluence'` to `serversToRemove` list

### Phase 4: Tool Config & Skill Writer

- [ ] **4.1** Update `src/detect-tool.mjs`
  - Add `confluenceSkillDir` and `confluenceSkillFile` fields to each tool config in `TOOL_CONFIGS`
  - `claude`: `.claude/skills/read-confluence-docs/SKILL.md`
  - `cursor`: `.cursor/skills/read-confluence-docs/SKILL.md`
  - `antigravity`: `.agent/skills/read-confluence-docs/SKILL.md`

- [ ] **4.2** Add `installConfluenceSkill(projectRoot, toolKey)` to `src/writers/skill-writer.mjs`
  - Copy `templates/read-confluence-docs/SKILL.md` to tool-specific confluence skill dir
  - Log success/overwrite warnings (same pattern as `installSkill`)

- [ ] **4.3** Add `uninstallConfluenceSkill(projectRoot, toolKey)` to `src/writers/skill-writer.mjs`

### Phase 5: CLI Orchestration

- [ ] **5.1** Update `src/installer.mjs` (install loop in `runInstall()`)
  - After `installSkill()` call, call `installConfluenceSkill()` when `config.confluenceEnabled`
  - `installMcp()` already handles confluence via updated `buildMcpServers` — no extra call needed

- [ ] **5.2** Update `src/installer.mjs` (uninstall loop in `runUninstall()`)
  - Call `uninstallConfluenceSkill()` for each tool

### Phase 6: Skill Integration Update

- [ ] **6.1** Update `templates/resolve-jira-ticket/SKILL.md` — Phase 2 (Ticket Analysis)
  - Add detection of Confluence links in ticket description/comments/remote links
  - Confluence URL patterns: `*.atlassian.net/wiki/...`, `confluence.*/pages/...`
  - When found: invoke `read-confluence-docs` skill with the page URL

### Phase 7: Docs & Release

- [ ] **7.1** Update `README.md` — add Confluence section documenting the feature
- [ ] **7.2** Bump version in `package.json` (semver minor: new feature)

## Dependencies

- Task 2.1 must complete before 3.1 (need to know config shape)
- Task 4.1 must complete before 4.2 (need path config)
- Tasks 1.x, 2.x, 3.x, 4.x can proceed in parallel
- Task 5.x depends on 2.x, 3.x, 4.x all being complete
- Task 6.1 is independent of 2-5; can be done anytime after 1.x

## Timeline & Estimates

| Phase | Effort | Notes |
|-------|--------|-------|
| 1. Skill template | ~2h | Most creative work; needs testing against real Confluence |
| 2. Prompts | ~1h | Mostly boilerplate following Jira prompt pattern |
| 3. MCP writer | ~30m | Small additive change |
| 4. Tool config + skill writer | ~1h | Pattern established by Jira skill |
| 5. CLI orchestration | ~30m | Wiring already-written pieces |
| 6. resolve-jira-ticket update | ~1h | Need to verify Confluence URL patterns |
| 7. Docs + release | ~30m | README + version bump |
| **Total** | **~6.5h** | |

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `mcp-atlassian` Confluence tool names differ from assumed | Medium | High | Verify actual tool names before writing SKILL.md (Task 1.1 prerequisite) |
| Users have separate Confluence and Jira instances | Low | Medium | Always ask Confluence URL separately; don't assume it equals Jira URL |
| Confluence Cloud vs. Server auth differences | Medium | Medium | Support both `api_token` and `personal_token` modes (same as Jira) |
| Breaking existing Jira-only installs | Low | High | Confluence is additive; test uninstall path carefully |

## Resources Needed

- Access to a real Confluence instance (Cloud or Server) for testing Task 1.2
- `mcp-atlassian` documentation / source to confirm Confluence tool names
