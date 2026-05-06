# Design: `resolve-trello-ticket` skill

**Date:** 2026-05-06
**Status:** Approved (pending user review of written spec)

## 1. Goal

Add a new skill `resolve-trello-ticket` that orchestrates the full lifecycle of resolving a Trello card, mirroring the structure of the existing `resolve-jira-ticket` skill but adapted for Trello's data model and the `@delorenj/mcp-server-trello` MCP toolset.

The installer (`bin/jira-ticket-skills`) gains an opt-in Trello integration that installs the skill template, registers the Trello MCP server, and writes the `TRELLO_BOARD_ID` configuration into the chosen AI tool's settings.

## 2. Scope

In scope:

- New skill template `templates/resolve-trello-ticket/{SKILL.md, workflow.md}`.
- Installer extensions to support Trello as an opt-in integration parallel to Confluence.
- Reuse of existing Confluence and Figma sub-skills (no changes to those).
- Tests for new writers and prompts.
- README documentation.

Out of scope:

- Changes to the `resolve-jira-ticket` skill.
- Changes to the `read-confluence-docs` skill.
- New Figma flow — reuse existing.
- Webhook/automation features beyond the existing MCP toolset.

## 3. Trello vs Jira data-model differences

| Concern | Jira | Trello |
|---|---|---|
| Project scope env var | `JIRA_PROJECT_KEY` | `TRELLO_BOARD_ID` |
| Ticket fetch | JQL `assignee = currentUser() AND status IN (...)` | `get_lists` → user picks list → `get_cards_by_list_id` → filter `idMembers` for current user |
| Status transition | `jira_transition_issue` | `move_card` (move card between lists) |
| Acceptance criteria source | Description / custom field | Description text **plus** all checklist items |
| Attachments | Jira attachments API | Card attachments — image **and** document (PDF/MD/DOCX/etc.), accessed via attachment URL |

## 4. Skill phases

The skill follows a 6-phase workflow that mirrors `resolve-jira-ticket`. Each phase is described below; details that match Jira exactly are summarised.

### Phase 1 — Fetch & Select

1. Read `TRELLO_BOARD_ID` env var. If absent, stop and ask the user.
2. If the user supplied a card ID or URL, skip to Phase 2.
3. Otherwise:
   - `set_active_board(boardId)`
   - `get_lists()` — present numbered list, user picks one
   - `get_cards_by_list_id(listId)` — filter cards where the current user is in `idMembers`
   - Present numbered card list, user picks one card
4. Wait for user selection. Do NOT proceed without it.

### Phase 2 — Deep Card Analysis

1. `get_card(cardId)` — full card details (description, members, labels, due date, list name, attachments metadata).
2. `get_card_comments(cardId)` — read EVERY comment.
3. **Acceptance Criteria** (combo strategy):
   - Parse description for markdown checklists (`- [ ]` / `- [x]`) and "AC:" or "Acceptance Criteria:" sections.
   - `get_acceptance_criteria(cardId)` — fetches the named "Acceptance Criteria" checklist if present.
   - `get_checklist_items` for every other checklist on the card.
   - Combine into a single AC list, deduplicated.
4. **Attachments** — for each entry in the card's `attachments`:
   - Image (`.png` / `.jpg` / `.jpeg` / `.gif` / `.webp` / `.svg`) → use the Read tool on the URL (multimodal).
   - PDF → use the Read tool (PDF support).
   - Document (`.md` / `.txt` / `.docx` / `.json` / `.csv`) → `curl -L <url> -o /tmp/<filename>` then Read.
   - Trello-internal URL needing login → try Read first; on 401/403 skip with warning ("Attachment requires login — open manually in browser").
5. **Confluence link detection** — scan description, all comments, and attachment URLs for Confluence patterns. For every unique link, invoke `read-confluence-docs` and add the result to the brief.
6. **Figma link detection** — scan the same surfaces for Figma patterns. If any found, trigger Phase 2.5.
7. Output a structured **Card Brief** mirroring the Jira Ticket Brief but with Trello field names: list name, labels, members, due date, checklist progress, attachments summary, related card links.

### Phase 2.5 — Figma Design Analysis

Identical to the Jira skill's Phase 2.5: same Figma MCP tool calls (`get_node`, `get_screenshot`, `get_design_context`, `get_variable_defs`, `get_metadata`), same Design Brief output, same ASCII wireframe requirement.

### Phase 3 — Map to Codebase

Identical to the Jira skill's Phase 3: Grep keywords, Read affected files, `git log --oneline -20 -- <files>`, output Codebase Mapping.

### Phase 4 — Brainstorm

Invoke `superpowers:brainstorming`. Focus areas identical to the Jira skill.

### Phase 5 — Implement (with auto-move on start)

1. Identify the "In Progress"-equivalent list:
   - Match list names case-insensitively against `["In Progress", "Doing", "WIP"]` from `get_lists`.
   - If exactly one match and the card is not already in that list → call `move_card(cardId, targetListId)` automatically and announce: *"Moved card to '<list name>'."*
   - If multiple matches → ask the user which list to move to.
   - If no match → skip with note: *"No 'In Progress' list found — skipping auto-move."*
2. Invoke `superpowers:systematic-debugging` for the actual fix/build.

### Phase 6 — Verify (no auto-move)

1. Invoke `superpowers:verification-before-completion` (run tests, lint, manual reproduction).
2. After verification, **suggest** but do NOT execute:
   - "Implementation done. To move card to next list, call `move_card(cardId, listId)`. Recommended target lists: <candidates whose name contains 'Review' or 'Done'>."
   - If any AC checklist items remain unchecked, suggest `update_checklist_item` calls.

## 5. Implementation changes (installer)

### 5.1 `src/detect-tool.mjs`

Extend each entry in `TOOL_CONFIGS` with Trello equivalents of the existing Confluence fields:

```js
trelloSkillDir: (root) => path.join(root, '<tool-base>', 'skills', 'resolve-trello-ticket'),
trelloSkillFile: 'SKILL.md',
// antigravity also gets:
trelloWorkflowFile: 'resolve-trello-ticket.md',
```

### 5.2 `src/writers/skill-writer.mjs`

Add a `TRELLO_TEMPLATE_DIR` constant and two new functions parallel to the Confluence pair:

- `installTrelloSkill(projectRoot, toolKey)` — copies `templates/resolve-trello-ticket/SKILL.md` to the tool's `trelloSkillDir`, and the workflow file for Antigravity.
- `uninstallTrelloSkill(projectRoot, toolKey)` — symmetric removal.

### 5.3 `src/writers/mcp-writer.mjs`

In `buildMcpServers`, add a Trello block gated by `config.trelloEnabled`:

```js
if (config.trelloEnabled) {
  servers.trello = {
    command: 'bunx',
    args: ['@delorenj/mcp-server-trello'],
    env: {
      TRELLO_API_KEY: config.trelloApiKey,
      TRELLO_TOKEN: config.trelloToken,
    },
  };
}
```

In `uninstallMcp`, add `'trello'` to the `serversToRemove` array.

### 5.4 `src/writers/settings-writer.mjs`

Extend `installJsonSettings` to also write `TRELLO_BOARD_ID` when `config.trelloEnabled`. The settings writer remains a single function — no need to split it. For rules-style settings (Cursor / Antigravity), append a Trello block to the rules file content when `config.trelloEnabled`.

`uninstallJsonSettings` removes `TRELLO_BOARD_ID` alongside `JIRA_PROJECT_KEY`.

### 5.5 `src/prompts.mjs`

Add a new section "Trello Integration" (placed after the existing Confluence section, before Figma):

```
log.step('Trello Integration');
const trelloEnable = await prompts({
  type: 'confirm',
  name: 'value',
  message: 'Add Trello integration (resolve Trello cards from your AI tool)?',
  initial: false,
});
config.trelloEnabled = trelloEnable.value ?? false;

if (config.trelloEnabled) {
  // prompt for TRELLO_API_KEY (text)
  // prompt for TRELLO_TOKEN (password)
  // prompt for TRELLO_BOARD_ID (text)
}
```

Default `false` — Trello is opt-in (does not affect users who don't use Trello).

`runNonInteractive` reads `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID` env vars in `--yes` mode. Trello is enabled when all three are present.

### 5.6 `src/installer.mjs`

In the install loop, after `installConfluenceSkill`, conditionally call `installTrelloSkill`. In the uninstall loop, always call `uninstallTrelloSkill`. Update `printUsageGuide` to mention `/resolve-trello-ticket` when Trello is enabled.

### 5.7 `bin/cli.mjs`

No changes required — argument parsing already passes through to `runPrompts` / `runNonInteractive`.

## 6. Tests

- `test/skill-writer.test.mjs` — install/uninstall Trello skill for each tool, assert files created/removed at correct paths.
- `test/mcp-writer.test.mjs` — install with `trelloEnabled: true` produces Trello server entry; uninstall removes it.
- `test/prompts.test.mjs` — `runNonInteractive` returns `trelloEnabled: true` only when all three env vars are set; missing any one disables it.

## 7. Documentation

- Update `README.md` with a "Trello Integration" section: env vars, opt-in install flow, `/resolve-trello-ticket` slash command usage.
- No separate docs page needed — the skill template's `SKILL.md` is the runtime documentation.

## 8. Open assumptions (defaults applied)

- **MCP server**: `@delorenj/mcp-server-trello` (already present in `.mcp.json` of the repo).
- **In-Progress multi-match**: ask the user which list to move to.
- **Default install behaviour**: Trello is opt-in (default off in interactive prompt; requires all three env vars in `--yes` mode).

## 9. Non-goals (deferred)

- Auto-update of Trello checklist items as TODOs are completed during implementation. Currently only suggested in Phase 6.
- Auto-creation of new cards from code TODOs.
- Sync between Jira and Trello for teams using both.
