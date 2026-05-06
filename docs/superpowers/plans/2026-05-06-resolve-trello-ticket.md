# Resolve Trello Ticket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `resolve-trello-ticket` skill plus opt-in installer support, mirroring `resolve-jira-ticket` but adapted to Trello's data model and `@delorenj/mcp-server-trello`.

**Architecture:** New skill template at `templates/resolve-trello-ticket/{SKILL.md, workflow.md}` follows the 6-phase Jira pattern, with auto-move to "In Progress" on Phase 5 and a manual move suggestion on Phase 6. Installer extends `TOOL_CONFIGS` with Trello paths and adds parallel writer functions (`installTrelloSkill`, MCP server entry, `TRELLO_BOARD_ID` setting), gated by an opt-in `trelloEnabled` flag.

**Tech Stack:** Node.js (`>=18`), `node:test`, `prompts`, `picocolors`. Skill files are markdown consumed by Claude Code / Cursor / Antigravity.

**Spec:** [docs/superpowers/specs/2026-05-06-resolve-trello-ticket-design.md](../specs/2026-05-06-resolve-trello-ticket-design.md)

---

## File Structure

**New files:**
- `templates/resolve-trello-ticket/SKILL.md` — main skill (6 phases)
- `templates/resolve-trello-ticket/workflow.md` — Antigravity slash-command variant
- `test/trello-skill-writer.test.mjs` — tests for `installTrelloSkill` / `uninstallTrelloSkill`

**Modified files:**
- `src/detect-tool.mjs` — add `trelloSkillDir`, `trelloSkillFile`, `trelloWorkflowFile` to each tool config
- `src/writers/skill-writer.mjs` — add `installTrelloSkill` / `uninstallTrelloSkill` functions
- `src/writers/mcp-writer.mjs` — add Trello server build block + add `'trello'` to `serversToRemove`
- `src/writers/settings-writer.mjs` — write `TRELLO_BOARD_ID` env (JSON tools) and Trello block (rules tools)
- `src/prompts.mjs` — add Trello section in `runPrompts` and Trello env handling in `runNonInteractive`
- `src/installer.mjs` — call `installTrelloSkill` in install loop; mention `/resolve-trello-ticket` in usage guide
- `test/skill-writer.test.mjs` — additional cases for Trello install/uninstall (or use new file `test/trello-skill-writer.test.mjs`)
- `test/mcp-writer.test.mjs` — new cases for Trello server entry
- `test/prompts.test.mjs` — new cases for Trello env var handling in `runNonInteractive`
- `README.md` — add Trello Integration section

---

## Task 1: Create skill template `SKILL.md`

**Files:**
- Create: `templates/resolve-trello-ticket/SKILL.md`

- [ ] **Step 1: Write the SKILL.md template**

Write the file at `templates/resolve-trello-ticket/SKILL.md` with the exact content below.

````markdown
---
name: resolve-trello-ticket
description: "Use when the user wants to work on a Trello card, resolve issues from Trello, pick up assigned work, or references a Trello card ID/URL — fetches card via Trello MCP, analyzes context including attachments (image + document) and Figma design links, then chains brainstorming and systematic debugging/implementation to deliver the fix or feature."
---

# Resolve Trello Ticket

Orchestrate the full lifecycle of resolving a Trello card: fetch assigned work, analyze card context (description, comments, checklists, attachments, Figma designs, Confluence links), map to codebase, then chain brainstorming and systematic debugging/implementation to deliver. Auto-move the card to "In Progress" before implementation; suggest (but never auto-execute) the next move on completion.

**Announce:** "Using resolve-trello-ticket to analyze and resolve a Trello card."

**Configuration:** The Trello board ID is configured via `TRELLO_BOARD_ID` env var (Claude Code, Antigravity) or in a rules file (Cursor). Read this value at the start and use it throughout the workflow. If not set, **ask the user** for the board ID before proceeding.

## Phase 1: Fetch and Select Card

**If user provided a card ID or URL (e.g., `abc123` or `https://trello.com/c/abc123/...`):** Skip to Phase 2.

**Otherwise:**

1. Read `TRELLO_BOARD_ID` from env (Claude Code, Antigravity) or rules context (Cursor). If not set, **stop and ask the user** for the board ID.
2. Activate board:
```
set_active_board(boardId="<TRELLO_BOARD_ID>")
```
3. Fetch lists:
```
get_lists()
```
4. Present numbered list of lists:
```
Lists in this board:

1. Backlog
2. To Do
3. In Progress
4. In Review
5. Done

Which list to view cards from?
```
5. **Wait for user selection.** Do NOT proceed without it.
6. Fetch cards in the chosen list:
```
get_cards_by_list_id(listId="<chosenListId>")
```
7. Filter cards where the current user is in `idMembers` (use `get_board_members` if needed to identify the current user). Present numbered card list:
```
Your cards in "In Progress":

1. [card-id-1] Fix payment bug (Labels: bug, high)
2. [card-id-2] Add export CSV button (Labels: feature)
...

Which card to work on?
```
8. **Wait for user selection.** Do NOT proceed without it.

## Phase 2: Deep Card Analysis

Gather ALL context via Trello MCP tools:

1. **Full card details** — `get_card(cardId="<cardId>")`. Capture: name, description, list name, labels, members, due date, attachments metadata.

2. **ALL comments (CRITICAL)** — `get_card_comments(cardId="<cardId>")`. Read EVERY comment. Comments often contain:
   - Reproduction steps from QA
   - Stack traces and error logs
   - Previous investigation notes
   - Workarounds already tried
   - Cross-references to PRs or related cards
   **YOU MUST read all comments before proceeding. Do NOT skip this step even if the description seems sufficient.**

3. **Acceptance Criteria (combo strategy)** — combine results from all three sources, deduplicating:
   a. Parse the card description for markdown checklists (`- [ ]` / `- [x]`) and "AC:" / "Acceptance Criteria:" sections.
   b. `get_acceptance_criteria(cardId="<cardId>")` — fetches the named "Acceptance Criteria" checklist if present.
   c. For every other checklist on the card, call `get_checklist_items` to capture its items.

4. **Attachments** — for each attachment in the `get_card` result:
   - Look at the URL extension and MIME type to classify:
     - **Image** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) → use the Read tool on the attachment URL (multimodal support).
     - **PDF** (`.pdf`) → use the Read tool (supports PDFs natively).
     - **Document** (`.md`, `.txt`, `.docx`, `.json`, `.csv`) → download with `curl -L "<url>" -o /tmp/<filename>` then Read.
     - **Trello-internal URL requiring login** → try Read first; on 401/403 skip with warning: "Attachment requires login — open manually in browser."
   - Summarize each attachment's content in the Card Brief.

5. **Confluence link detection** — Scan ALL of the following for Confluence URLs:
   - Card description
   - ALL comments
   - Attachment URLs

   **Confluence URL patterns to detect:**
   - `*.atlassian.net/wiki/...`
   - `confluence.*/pages/...`
   - `confluence.*/display/...`

   Collect all unique Confluence links with context about where each was found.

   **If Confluence links found: INVOKE `read-confluence-docs`** with each URL before proceeding to Phase 3. Add the fetched documentation to the Card Brief as "Documentation context".

6. **Figma link detection (CRITICAL)** — Scan ALL of the following for Figma URLs:
   - Card description
   - ALL comments
   - Attachment URLs

   **Figma URL patterns to detect:**
   - `figma.com/design/...`
   - `figma.com/file/...`
   - `figma.com/proto/...`
   - `figma.com/board/...`

   Collect all unique Figma links with context about where each was found. If any are found, trigger Phase 2.5 before continuing to Phase 3.

**Output a structured Card Brief:**

```
## Card Brief: [card-id] Title

**List:** Current list name
**Labels:** [list of labels]
**Members:** [list of members]
**Due date:** YYYY-MM-DD or "none"
**Reported behavior:** What is broken (for bugs) or what needs to be built (for features)
**Expected behavior:** What should happen
**Acceptance Criteria:** Combined list from description + checklists (deduplicated). Mark each as [ ] or [x] based on current state.
**Reproduction steps:** From description AND comments (for bugs)
**Stack traces/errors:** Any error output from description or comments
**Affected area:** Module/feature inferred from card content
**Team notes:** Key insights extracted from ALL comments
**Previous attempts:** Workarounds or fixes already tried (from comments)
**Related cards:** Cross-references found in description/comments
**Attachments:**
  - <name> (<type>): <summary>
**Documentation context:** [Confluence pages fetched and their key content summaries]
**Design references:** [List of Figma links found, with source context]
```

Ask user: "Does this capture the card correctly? Any additional context?"

## Phase 2.5: Figma Design Analysis (if Figma links found)

**Skip this phase if no Figma links were found in Phase 2.**

**Prerequisite:** Ask the user to open the relevant Figma file in the **Figma desktop app** if using figma-bridge MCP. The bridge connects to the running desktop app.

**Extract nodeId from Figma URLs:**
- URL format: `https://figma.com/design/:fileKey/:fileName?node-id=1-2`
- Extract `node-id` parameter and replace `-` with `:` → nodeId = `1:2`
- If no node-id in URL, use `get_document` to browse the page tree and find the relevant frame

For each Figma link found, use available Figma MCP tools to extract design context:

1. **`get_node(nodeId)`** - Fetch the specific node by ID extracted from the URL
2. **`get_screenshot(nodeIds, format, scale)`** - Capture visual reference (pass nodeIds as array, e.g. `["1:2"]`, use PNG format, scale 2)
3. **`get_design_context(depth)`** - Extract layout structure, component hierarchy, and code-ready context (use depth 3-4 for detailed tree)
4. **`get_variable_defs()`** - Extract design tokens: colors, spacing, typography values
5. **`get_metadata()`** - Get document metadata including file name, pages, and current page info

**Additional tools available if needed:**
- **`get_document()`** - Get the full page document tree (useful when no specific nodeId)
- **`get_selection()`** - Get currently selected nodes
- **`get_styles()`** - Get all local styles in the document

**Output a structured Design Brief:**

```
## Design Brief: [Description / Figma page name]

**Visual reference:** Screenshots from Figma (describe key UI states)
**Layout structure:** Component hierarchy, sections, arrangement
**Components used:** Named Figma components and their roles
**Design tokens:**
  - Colors: [list key colors with hex/variable names]
  - Typography: [font sizes, weights, families]
  - Spacing: [padding, margins, gaps]
**Key UI elements:** Buttons, inputs, modals, states (hover, active, disabled, error)
**Responsive notes:** Any responsive/breakpoint behavior observed
**Interaction notes:** Transitions, animations, or state changes implied
```

**Draft UI with ASCII (REQUIRED when Figma links found):**

After extracting the design context, you MUST create an ASCII wireframe that captures the layout structure from Figma. This gives the team a quick visual reference without needing to open Figma.

```
## ASCII UI Draft

Example:
+-----------------------------------------------+
|  Header Bar                          [Avatar]  |
+-----------------------------------------------+
|                                                 |
|  +-------------------------------------------+  |
|  | Search: [________________________] [Search]|  |
|  +-------------------------------------------+  |
|                                                 |
|  [ Cancel ]                    [ Submit (CTA) ] |
+-----------------------------------------------+
```

Guidelines for ASCII drafts:
- Use `+---+` for borders, `|` for vertical edges
- Use `[Button Text]` for buttons and CTAs
- Use `[____]` for input fields
- Use `( ) Option` for radio buttons, `[x] Option` for checkboxes
- Show multiple states if the design has them
- Label each section clearly

## Phase 3: Map to Codebase

1. **Identify affected area** from the Card Brief — search for relevant modules, services, components, or routes in the project structure.
2. **Search keywords** from the card (error messages, function names, status values, UI text) using Grep across the codebase.
3. **Trace code path** — Read relevant source files to understand:
   - Entry points (controllers, routes, handlers, event listeners)
   - Business logic (services, helpers, utilities)
   - Data layer (models, entities, repositories, schemas)
   - Configuration (constants, enums, types)
4. **Map design to code** (if Design Brief exists):
   - Match Figma components to existing codebase components/templates
   - Identify which files render the affected UI
   - Note gaps between design and current implementation
5. **Check git history** for affected files:
```bash
git log --oneline -20 -- <affected-files>
```
6. **Summarize:**
```
## Codebase Mapping

**Primary files:** [list with paths]
**Related files:** [list with paths]
**UI files:** [components/templates matching Figma design, if applicable]
**Recent changes:** [commit summaries]
**Initial observations:** [anything obvious]
**Design-code gaps:** [differences between Figma and current implementation, if applicable]
```

## Phase 4: Brainstorm Understanding

**INVOKE:** `superpowers:brainstorming`

Focus brainstorming on:
- How the affected feature is designed to work (happy path)
- What state transitions or data flows are involved
- Where reported behavior diverges from expected (for bugs)
- What needs to be built or changed (for features)
- **If Design Brief exists:** How the Figma design maps to the code architecture, what UI components are needed, and how design tokens should be applied
- Edge cases or race conditions that could cause issues

Goal: Build a mental model of the system and the required changes.

## Phase 5: Auto-move + Systematic Debugging / Implementation

**Step 5a — Auto-move card to "In Progress":**

1. Re-fetch lists if not in cache: `get_lists()`.
2. Identify candidate "In Progress" lists by case-insensitive name match against: `["In Progress", "Doing", "WIP"]`.
3. Decision:
   - **Exactly one match AND card is not already in that list** → call `move_card(cardId="<cardId>", listId="<targetListId>")` and announce: *"Moved card to '<list name>'."*
   - **Card is already in the matched list** → skip move, announce: *"Card already in '<list name>'."*
   - **Multiple matches** → ask the user: *"Multiple 'In Progress'-style lists found: [list]. Which should I move the card to? (Or 'skip' to keep it in place.)"* Then move based on selection.
   - **No match** → skip with note: *"No 'In Progress' list found in this board — skipping auto-move."*

**Step 5b — Systematic debugging / implementation:**

**INVOKE:** `superpowers:systematic-debugging`

Hand off with full context from Phases 2-4:
- Card brief (Phase 2)
- Design brief (Phase 2.5, if available)
- Codebase mapping (Phase 3)
- System understanding (Phase 4)

Follow the four debugging phases strictly:
1. Root cause investigation
2. Pattern analysis
3. Hypothesis and testing
4. Implementation of fix

## Phase 6: Verification

**INVOKE:** `superpowers:verification-before-completion`

1. Run the project's test suite (e.g., `npm test`, `pnpm test`, `yarn test`, `make test`).
2. Run the project's linter if available (e.g., `npm run lint`, `pnpm lint`).
3. If card has reproduction steps, verify manually.
4. If Design Brief exists, verify UI changes match Figma specs.
5. Report results with evidence.

**Do NOT auto-move the card.** After verification:

- Report: *"Implementation done. Tests + lint passed (evidence above)."*
- Suggest (do not execute): *"To advance the card, call `move_card(cardId='<cardId>', listId='<targetListId>')`. Candidate target lists from this board: <names containing 'Review' or 'Done'>."*
- If any AC checklist items are still unchecked, suggest: *"Unchecked AC items remain: [list]. To mark complete, call `update_checklist_item(...)` for each."*

## Quick Reference

| Phase             | Action                              | Sub-skill / Tools                |
| ----------------- | ----------------------------------- | -------------------------------- |
| 1. Select         | Pick list, then card                | Trello MCP (`set_active_board`, `get_lists`, `get_cards_by_list_id`) |
| 2. Analyze        | Card details, comments, AC, attachments | Trello MCP (`get_card`, `get_card_comments`, `get_acceptance_criteria`, `get_checklist_items`) |
| 2.4 Confluence    | Read linked Confluence docs         | read-confluence-docs             |
| 2.5 Design        | Extract Figma specs + ASCII UI draft | Figma MCP                       |
| 3. Map            | Find relevant code paths            | Grep, Read, git log             |
| 4. Understand     | Feature/bug design context          | brainstorming                    |
| 5. Move + Implement | Auto-move to In Progress, then fix/build | Trello MCP (`move_card`) + systematic-debugging |
| 6. Verify         | Tests, lint, design match, evidence | verification-before-completion   |

## Red Flags - STOP if you catch yourself:

- Proposing a fix before completing Phase 3
- Skipping comments or checklists in Phase 2
- **Skipping attachments — image OR document — when present on the card**
- **Skipping Confluence doc reading when Confluence links are present in the card**
- **Skipping Figma design analysis when Figma links are present in the card**
- **Not creating an ASCII UI draft when Figma links are present**
- Not invoking systematic-debugging for the fix
- Claiming "fixed" without test output evidence
- **Auto-moving the card after Phase 6 (only suggest)**
- Implementing UI changes without referencing the Design Brief
````

- [ ] **Step 2: Smoke-check the file**

Run:
```bash
test -f templates/resolve-trello-ticket/SKILL.md && echo OK
grep -c "^## Phase" templates/resolve-trello-ticket/SKILL.md
```
Expected: `OK` and `7` (Phases 1, 2, 2.5, 3, 4, 5, 6).

- [ ] **Step 3: Commit**

```bash
git add templates/resolve-trello-ticket/SKILL.md
git commit -m "feat: add resolve-trello-ticket skill template"
```

---

## Task 2: Create Antigravity workflow file

**Files:**
- Create: `templates/resolve-trello-ticket/workflow.md`

- [ ] **Step 1: Write the workflow.md template**

Write the file at `templates/resolve-trello-ticket/workflow.md` with this exact content:

````markdown
---
description: Resolve a Trello card end-to-end. Fetches card via Trello MCP, analyzes context including attachments and Figma designs, maps to codebase, then chains brainstorming and systematic debugging to deliver the fix or feature.
---

# Resolve Trello Ticket

## Task
Resolve this Trello card: **{{input}}**

If `{{input}}` is empty or missing, fetch the board's lists and ask the user to pick one:
```
set_active_board(boardId="<TRELLO_BOARD_ID>")
get_lists()
```
Then fetch cards from the chosen list (`get_cards_by_list_id`) and filter by current user (`idMembers`). Present the list and ask the user to pick one. STOP until they choose.

## Workflow

Follow these phases strictly in order. Do NOT skip phases or jump ahead.

### Phase 1: Deep Card Analysis
Use Trello MCP tools to gather ALL context:
1. `get_card` — full details (name, description, list, labels, members, due date, attachments metadata)
2. `get_card_comments` — read every single comment
3. **Acceptance Criteria (combo)** — parse description for `- [ ]` / "AC:" sections, plus `get_acceptance_criteria` and `get_checklist_items` for every checklist
4. **Attachments** — for each attachment, classify by extension/MIME and read accordingly:
   - Image / PDF → Read tool on URL (multimodal / PDF support)
   - Document (`.md`, `.txt`, `.docx`, `.json`, `.csv`) → `curl -L "<url>" -o /tmp/<name>` then Read
   - Trello-internal needing login → try Read; on 401/403 skip with warning
5. Scan description, comments, attachments for **Confluence URLs** (`*.atlassian.net/wiki/...`, `confluence.*/...`) and **Figma URLs** (`figma.com/design/...`, `figma.com/file/...`)

Output a **Card Brief** with: list, labels, members, reported behavior, expected behavior, acceptance criteria (combined), repro steps, errors, affected area, team notes, previous attempts, related cards, attachments summary, design references.

Ask: "Does this capture the card correctly?"

### Phase 2: Figma Design Analysis (if links found)
Skip if no Figma links found.
- Ask user to open Figma desktop app
- Extract nodeId from URLs (replace `-` with `:` in node-id param)
- Use Figma MCP: get_node, get_screenshot, get_design_context, get_variable_defs
- Output a **Design Brief** with: layout, components, design tokens, UI elements
- Create an **ASCII wireframe** of the design

### Phase 3: Map to Codebase
1. Search for keywords from the card (error messages, function names, status values)
2. Trace code paths — entry points, business logic, data layer
3. If Design Brief exists, match Figma components to code components
4. Check git history: `git log --oneline -20 -- <affected-files>`
5. Output a **Codebase Mapping** with: primary files, related files, recent changes, observations

### Phase 4: Brainstorm
Load and follow the skill: `.agent/skills/superpowers-brainstorm/` (or use `/superpowers-brainstorm`)

Focus on: how the feature works (happy path), state transitions, where behavior diverges, what needs to change, edge cases.

### Phase 5: Auto-move + Implement
1. Auto-move card to "In Progress":
   - `get_lists()` to fetch lists
   - Match list names case-insensitively against `["In Progress", "Doing", "WIP"]`
   - Exactly one match → `move_card(cardId, targetListId)` and announce
   - Multiple matches → ask the user
   - No match → skip with note
2. Load and follow the skill: `.agent/skills/superpowers-debug/` (or use `/superpowers-debug`)

Hand off full context from Phases 1-4. Follow the four debugging phases:
1. Root cause investigation
2. Pattern analysis
3. Hypothesis and testing
4. Implementation

### Phase 6: Verify (no auto-move)
1. Run the project's test suite
2. Run the project's linter
3. If card has repro steps, verify the fix manually
4. If Design Brief exists, verify UI matches Figma specs
5. Report results with evidence (command output)

**Do NOT auto-move the card.** Suggest the next move:
- *"Implementation done. To advance the card, call `move_card(cardId='<cardId>', listId='<targetListId>')`. Candidate target lists: <names containing 'Review' or 'Done'>."*
- If unchecked AC items remain, suggest `update_checklist_item` calls.

## Red Flags — STOP if you catch yourself:
- Proposing a fix before completing Phase 3
- Skipping comments, checklists, or attachments in Phase 1
- Skipping Figma analysis when links are present
- Claiming "fixed" without test output evidence
- Auto-moving the card after Phase 6
````

- [ ] **Step 2: Smoke-check the file**

Run:
```bash
test -f templates/resolve-trello-ticket/workflow.md && echo OK
grep -c "^### Phase" templates/resolve-trello-ticket/workflow.md
```
Expected: `OK` and `6`.

- [ ] **Step 3: Commit**

```bash
git add templates/resolve-trello-ticket/workflow.md
git commit -m "feat: add resolve-trello-ticket workflow for antigravity"
```

---

## Task 3: Extend `TOOL_CONFIGS` with Trello paths

**Files:**
- Modify: `src/detect-tool.mjs`

- [ ] **Step 1: Add Trello fields to each tool config**

Edit `src/detect-tool.mjs`. Inside each entry of `TOOL_CONFIGS` (claude, cursor, antigravity), add Trello equivalents next to the existing Confluence fields. Final shape:

```js
// inside TOOL_CONFIGS.claude
trelloSkillDir: (root) =>
  path.join(root, '.claude', 'skills', 'resolve-trello-ticket'),
trelloSkillFile: 'SKILL.md',

// inside TOOL_CONFIGS.cursor
trelloSkillDir: (root) =>
  path.join(root, '.cursor', 'skills', 'resolve-trello-ticket'),
trelloSkillFile: 'SKILL.md',

// inside TOOL_CONFIGS.antigravity
trelloSkillDir: (root) =>
  path.join(root, '.agent', 'skills', 'resolve-trello-ticket'),
trelloSkillFile: 'SKILL.md',
trelloWorkflowFile: 'resolve-trello-ticket.md',
```

Place each `trelloSkillDir` immediately after the corresponding `confluenceSkillFile` line so related fields stay grouped.

- [ ] **Step 2: Verify by importing**

Run:
```bash
node -e "import('./src/detect-tool.mjs').then(m => console.log(JSON.stringify(Object.keys(m.TOOL_CONFIGS.claude))))"
```
Expected output should include `trelloSkillDir` and `trelloSkillFile`.

- [ ] **Step 3: Commit**

```bash
git add src/detect-tool.mjs
git commit -m "feat: add Trello skill paths to TOOL_CONFIGS"
```

---

## Task 4: Add `installTrelloSkill` / `uninstallTrelloSkill` (TDD)

**Files:**
- Create: `test/trello-skill-writer.test.mjs`
- Modify: `src/writers/skill-writer.mjs`

- [ ] **Step 1: Write failing tests**

Create `test/trello-skill-writer.test.mjs` with this content:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  installTrelloSkill,
  uninstallTrelloSkill,
} from '../src/writers/skill-writer.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-trello-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('installTrelloSkill(claude): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    const expected = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(fs.existsSync(expected), `Expected file: ${expected}`);
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill(cursor): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'cursor');
    const expected = path.join(
      root,
      '.cursor',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill(antigravity): creates SKILL.md and workflow.md', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'antigravity');
    const skill = path.join(
      root,
      '.agent',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const workflow = path.join(
      root,
      '.agent',
      'workflows',
      'resolve-trello-ticket.md',
    );
    assert.ok(fs.existsSync(skill), `Expected file: ${skill}`);
    assert.ok(fs.existsSync(workflow), `Expected file: ${workflow}`);
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill: file content matches template SKILL.md', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    const installed = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const templatePath = new URL(
      '../templates/resolve-trello-ticket/SKILL.md',
      import.meta.url,
    ).pathname;
    assert.equal(
      fs.readFileSync(installed, 'utf-8'),
      fs.readFileSync(templatePath, 'utf-8'),
    );
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill: throws on unknown tool', () => {
  assert.throws(() => installTrelloSkill('/tmp', 'unknown'), /Unknown tool/);
});

test('uninstallTrelloSkill(claude): removes installed file', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    uninstallTrelloSkill(root, 'claude');
    const expected = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(!fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('uninstallTrelloSkill(antigravity): removes both skill and workflow', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'antigravity');
    uninstallTrelloSkill(root, 'antigravity');
    const skill = path.join(
      root,
      '.agent',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const workflow = path.join(
      root,
      '.agent',
      'workflows',
      'resolve-trello-ticket.md',
    );
    assert.ok(!fs.existsSync(skill));
    assert.ok(!fs.existsSync(workflow));
  } finally {
    cleanup(root);
  }
});

test('uninstallTrelloSkill: idempotent when nothing installed', () => {
  const root = makeTempDir();
  try {
    assert.doesNotThrow(() => uninstallTrelloSkill(root, 'claude'));
  } finally {
    cleanup(root);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
node --test test/trello-skill-writer.test.mjs
```
Expected: ALL tests fail with import error like `installTrelloSkill is not a function` (or undefined).

- [ ] **Step 3: Implement the writer functions**

Edit `src/writers/skill-writer.mjs`. Add a constant near the top:

```js
const TRELLO_TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'resolve-trello-ticket');
```

Place it next to the existing `TEMPLATE_DIR` and `CONFLUENCE_TEMPLATE_DIR` constants.

Then append these two functions to the end of the file:

```js
/**
 * Install Trello skill file (and workflow for Antigravity) for a specific tool.
 */
export function installTrelloSkill(projectRoot, toolKey) {
  const config = getToolConfig(toolKey);
  if (!config) throw new Error(`Unknown tool: ${toolKey}`);

  const srcFile = path.join(TRELLO_TEMPLATE_DIR, 'SKILL.md');
  const destDir = config.trelloSkillDir(projectRoot);
  const destFile = path.join(destDir, config.trelloSkillFile);

  if (fileExists(destFile)) {
    log.warn(`Skill already exists: ${path.relative(projectRoot, destFile)} (overwriting)`);
  }

  copyFile(srcFile, destFile);
  log.success(`Installed Trello skill: ${path.relative(projectRoot, destFile)}`);

  if (config.workflowDir && config.trelloWorkflowFile) {
    const workflowSrc = path.join(TRELLO_TEMPLATE_DIR, 'workflow.md');
    const workflowDir = config.workflowDir(projectRoot);
    const workflowDest = path.join(workflowDir, config.trelloWorkflowFile);

    if (fileExists(workflowDest)) {
      log.warn(`Workflow already exists: ${path.relative(projectRoot, workflowDest)} (overwriting)`);
    }

    copyFile(workflowSrc, workflowDest);
    log.success(`Installed Trello workflow: ${path.relative(projectRoot, workflowDest)}`);
  }
}

/**
 * Uninstall Trello skill (and workflow) for a specific tool.
 */
export function uninstallTrelloSkill(projectRoot, toolKey) {
  const config = getToolConfig(toolKey);
  if (!config) return;

  const destDir = config.trelloSkillDir(projectRoot);
  const destFile = path.join(destDir, config.trelloSkillFile);

  if (removeFile(destFile)) {
    log.success(`Removed: ${path.relative(projectRoot, destFile)}`);
    removeDirIfEmpty(destDir);
  } else {
    log.info(`Trello skill not found: ${path.relative(projectRoot, destFile)}`);
  }

  if (config.workflowDir && config.trelloWorkflowFile) {
    const workflowDest = path.join(
      config.workflowDir(projectRoot),
      config.trelloWorkflowFile,
    );
    if (removeFile(workflowDest)) {
      log.success(`Removed: ${path.relative(projectRoot, workflowDest)}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
node --test test/trello-skill-writer.test.mjs
```
Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/skill-writer.mjs test/trello-skill-writer.test.mjs
git commit -m "feat: add Trello skill installer/uninstaller"
```

---

## Task 5: Add Trello MCP server config (TDD)

**Files:**
- Modify: `test/mcp-writer.test.mjs`
- Modify: `src/writers/mcp-writer.mjs`

- [ ] **Step 1: Write failing tests**

Append to `test/mcp-writer.test.mjs` (after the existing tests):

```js
// ── Trello server tests ───────────────────────────────────────────────────────

test('installMcp(claude): adds trello server when trelloEnabled=true', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      trelloEnabled: true,
      trelloApiKey: 'trello-api-key-123',
      trelloToken: 'trello-token-abc',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    const servers = mcp.mcpServers;

    assert.ok(servers.trello, 'trello server must be present');
    assert.equal(servers.trello.command, 'bunx');
    assert.deepEqual(servers.trello.args, ['@delorenj/mcp-server-trello']);
    assert.equal(servers.trello.env.TRELLO_API_KEY, 'trello-api-key-123');
    assert.equal(servers.trello.env.TRELLO_TOKEN, 'trello-token-abc');
  } finally {
    cleanup(root);
  }
});

test('installMcp(claude): no trello server when trelloEnabled=false', () => {
  const root = makeTempDir();
  try {
    installMcp(root, 'claude', baseConfig);
    const mcp = readMcp(root);
    assert.ok(!mcp.mcpServers.trello, 'trello server must not be added when disabled');
  } finally {
    cleanup(root);
  }
});

test('installMcp(claude): jira and trello coexist', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      trelloEnabled: true,
      trelloApiKey: 'k',
      trelloToken: 't',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    assert.ok(mcp.mcpServers.jira, 'jira must be present');
    assert.ok(mcp.mcpServers.trello, 'trello must be present');
  } finally {
    cleanup(root);
  }
});

test('uninstallMcp(claude): removes trello server', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      trelloEnabled: true,
      trelloApiKey: 'k',
      trelloToken: 't',
    };
    installMcp(root, 'claude', config);
    uninstallMcp(root, 'claude');
    const mcp = readMcp(root);
    assert.ok(!mcp.mcpServers.trello, 'trello server must be removed');
  } finally {
    cleanup(root);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
node --test test/mcp-writer.test.mjs
```
Expected: the four new tests fail (no `trello` server entry).

- [ ] **Step 3: Implement Trello MCP support**

Edit `src/writers/mcp-writer.mjs`. Inside `buildMcpServers`, after the Confluence block, add:

```js
  // Trello MCP (via bunx @delorenj/mcp-server-trello)
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

In `uninstallMcp`, change the `serversToRemove` line from:

```js
const serversToRemove = ['jira', 'figma-bridge', 'confluence'];
```

to:

```js
const serversToRemove = ['jira', 'figma-bridge', 'confluence', 'trello'];
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
node --test test/mcp-writer.test.mjs
```
Expected: ALL tests in this file pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/mcp-writer.mjs test/mcp-writer.test.mjs
git commit -m "feat: register Trello MCP server in installer"
```

---

## Task 6: Write `TRELLO_BOARD_ID` to settings (TDD)

**Files:**
- Modify: `src/writers/settings-writer.mjs`
- Create: `test/settings-writer.test.mjs` (file does not yet exist; create it)

- [ ] **Step 1: Write failing tests**

Create `test/settings-writer.test.mjs` with this content:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  installSettings,
  uninstallSettings,
} from '../src/writers/settings-writer.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-settings-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const baseConfig = {
  projectKey: 'PRJ',
  trelloEnabled: false,
};

test('installSettings(claude): writes TRELLO_BOARD_ID when trelloEnabled=true', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'board-abc',
    });
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.equal(settings.env.JIRA_PROJECT_KEY, 'PRJ');
    assert.equal(settings.env.TRELLO_BOARD_ID, 'board-abc');
  } finally {
    cleanup(root);
  }
});

test('installSettings(claude): does not write TRELLO_BOARD_ID when trelloEnabled=false', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', baseConfig);
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.equal(settings.env.JIRA_PROJECT_KEY, 'PRJ');
    assert.ok(
      !('TRELLO_BOARD_ID' in settings.env),
      'TRELLO_BOARD_ID must not be set',
    );
  } finally {
    cleanup(root);
  }
});

test('installSettings(cursor): writes Trello block to rules file when enabled', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'cursor', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'board-xyz',
    });
    const rules = fs.readFileSync(
      path.join(root, '.cursor', 'rules', 'jira-config.mdc'),
      'utf-8',
    );
    assert.match(rules, /TRELLO_BOARD_ID/);
    assert.match(rules, /board-xyz/);
  } finally {
    cleanup(root);
  }
});

test('installSettings(cursor): no Trello block when disabled', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'cursor', baseConfig);
    const rules = fs.readFileSync(
      path.join(root, '.cursor', 'rules', 'jira-config.mdc'),
      'utf-8',
    );
    assert.doesNotMatch(rules, /TRELLO_BOARD_ID/);
  } finally {
    cleanup(root);
  }
});

test('uninstallSettings(claude): removes TRELLO_BOARD_ID along with JIRA_PROJECT_KEY', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'b',
    });
    uninstallSettings(root, 'claude');
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.ok(
      !('JIRA_PROJECT_KEY' in (settings.env || {})),
      'JIRA_PROJECT_KEY must be removed',
    );
    assert.ok(
      !('TRELLO_BOARD_ID' in (settings.env || {})),
      'TRELLO_BOARD_ID must be removed',
    );
  } finally {
    cleanup(root);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
node --test test/settings-writer.test.mjs
```
Expected: tests fail because `TRELLO_BOARD_ID` is not written and rules file lacks Trello block.

- [ ] **Step 3: Implement settings changes**

Edit `src/writers/settings-writer.mjs`.

In `installJsonSettings`, change the line:

```js
const envUpdate = { JIRA_PROJECT_KEY: config.projectKey };
```

to:

```js
const envUpdate = { JIRA_PROJECT_KEY: config.projectKey };
if (config.trelloEnabled) {
  envUpdate.TRELLO_BOARD_ID = config.trelloBoardId;
}
```

In `installRulesSettings`, change the `content` template to conditionally append a Trello block. Replace the existing assignment:

```js
const content = `---
description: Jira project configuration for resolve-jira-ticket skill
globs:
alwaysApply: true
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`${config.projectKey}\`

When using the resolve-jira-ticket skill or searching Jira, use project key \`${config.projectKey}\`.
For JQL queries, use: \`project = ${config.projectKey}\`
`;
```

with:

```js
const trelloBlock = config.trelloEnabled
  ? `

# Trello Configuration

- **TRELLO_BOARD_ID**: \`${config.trelloBoardId}\`

When using the resolve-trello-ticket skill, use board ID \`${config.trelloBoardId}\`.
`
  : '';

const content = `---
description: Jira and Trello project configuration for resolve-* skills
globs:
alwaysApply: true
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`${config.projectKey}\`

When using the resolve-jira-ticket skill or searching Jira, use project key \`${config.projectKey}\`.
For JQL queries, use: \`project = ${config.projectKey}\`
${trelloBlock}`;
```

In `uninstallJsonSettings`, change the deletion line:

```js
delete target[key].JIRA_PROJECT_KEY;
```

to:

```js
delete target[key].JIRA_PROJECT_KEY;
delete target[key].TRELLO_BOARD_ID;
```

Also update the success log to be accurate:

```js
log.success(
  `Removed JIRA_PROJECT_KEY and TRELLO_BOARD_ID from ${path.relative(projectRoot, settingsPath)}`,
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
node --test test/settings-writer.test.mjs
```
Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/writers/settings-writer.mjs test/settings-writer.test.mjs
git commit -m "feat: write TRELLO_BOARD_ID to tool settings"
```

---

## Task 7: Add Trello prompts to interactive + non-interactive flow (TDD)

**Files:**
- Modify: `test/prompts.test.mjs`
- Modify: `src/prompts.mjs`

- [ ] **Step 1: Write failing tests**

Append to `test/prompts.test.mjs`:

```js
// ── Trello disabled (no env vars) ────────────────────────────────────────────

test('runNonInteractive: trelloEnabled=false when no Trello env vars set', () => {
  setJiraEnv();
  delete process.env.TRELLO_API_KEY;
  delete process.env.TRELLO_TOKEN;
  delete process.env.TRELLO_BOARD_ID;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.trelloEnabled, false);
});

test('runNonInteractive: trelloEnabled=false when only TRELLO_API_KEY set', () => {
  setJiraEnv({ TRELLO_API_KEY: 'k' });
  delete process.env.TRELLO_TOKEN;
  delete process.env.TRELLO_BOARD_ID;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.trelloEnabled, false);
});

test('runNonInteractive: trelloEnabled=false when TRELLO_BOARD_ID missing', () => {
  setJiraEnv({ TRELLO_API_KEY: 'k', TRELLO_TOKEN: 't' });
  delete process.env.TRELLO_BOARD_ID;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.trelloEnabled, false);
});

// ── Trello enabled ───────────────────────────────────────────────────────────

test('runNonInteractive: trelloEnabled=true when all three Trello env vars set', () => {
  setJiraEnv({
    TRELLO_API_KEY: 'api-key',
    TRELLO_TOKEN: 'token',
    TRELLO_BOARD_ID: 'board-id',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.trelloEnabled, true);
  assert.equal(config.trelloApiKey, 'api-key');
  assert.equal(config.trelloToken, 'token');
  assert.equal(config.trelloBoardId, 'board-id');
});

test('runNonInteractive: trims whitespace from Trello env vars', () => {
  setJiraEnv({
    TRELLO_API_KEY: '  k  ',
    TRELLO_TOKEN: '  t  ',
    TRELLO_BOARD_ID: '  b  ',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.trelloApiKey, 'k');
  assert.equal(config.trelloToken, 't');
  assert.equal(config.trelloBoardId, 'b');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
node --test test/prompts.test.mjs
```
Expected: the five new tests fail (`trelloEnabled` is undefined).

- [ ] **Step 3: Add Trello support to `runNonInteractive`**

Edit `src/prompts.mjs`. Inside `runNonInteractive`, after the Confluence env-handling block and before the `return { ... }`, add:

```js
  const trelloApiKey = process.env.TRELLO_API_KEY?.trim();
  const trelloToken = process.env.TRELLO_TOKEN?.trim();
  const trelloBoardId = process.env.TRELLO_BOARD_ID?.trim();
  const trelloEnabled = Boolean(trelloApiKey && trelloToken && trelloBoardId);
```

Then extend the `return { ... }` object to include:

```js
    trelloEnabled,
    ...(trelloEnabled && {
      trelloApiKey,
      trelloToken,
      trelloBoardId,
    }),
```

- [ ] **Step 4: Add Trello prompts to `runPrompts`**

Inside `runPrompts`, after the Confluence section (`if (config.confluenceEnabled) { ... }`) and before the Figma section (`if (!cliArgs.noFigma) { ... }`), insert:

```js
  // ── 4b. Trello configuration ─────────────────────────────────────────
  log.step('Trello Integration');

  const trelloEnable = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Add Trello integration (resolve Trello cards from your AI tool)?',
    initial: false,
  });
  config.trelloEnabled = trelloEnable.value ?? false;

  if (config.trelloEnabled) {
    const apiKey = await prompts({
      type: 'text',
      name: 'value',
      message: 'Trello API key (https://trello.com/app-key)',
      initial: process.env.TRELLO_API_KEY || '',
      format: (v) => v.trim(),
      validate: (v) => (v.trim() ? true : 'API key is required'),
    });
    if (apiKey.value === undefined) throw new Error('Cancelled');
    config.trelloApiKey = apiKey.value;

    const token = await prompts({
      type: 'password',
      name: 'value',
      message: 'Trello token',
      format: (v) => v.trim(),
      validate: (v) => (v.trim() ? true : 'Token is required'),
    });
    if (token.value === undefined) throw new Error('Cancelled');
    config.trelloToken = token.value;

    const boardId = await prompts({
      type: 'text',
      name: 'value',
      message: 'Default Trello board ID',
      initial: process.env.TRELLO_BOARD_ID || '',
      format: (v) => v.trim(),
      validate: (v) => (v.trim() ? true : 'Board ID is required'),
    });
    if (boardId.value === undefined) throw new Error('Cancelled');
    config.trelloBoardId = boardId.value;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
node --test test/prompts.test.mjs
```
Expected: ALL tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/prompts.mjs test/prompts.test.mjs
git commit -m "feat: add Trello integration prompts"
```

---

## Task 8: Wire Trello into installer + uninstaller flow

**Files:**
- Modify: `src/installer.mjs`

- [ ] **Step 1: Update install loop**

Edit `src/installer.mjs`. Update the import line at the top from:

```js
import { installSkill, uninstallSkill, installConfluenceSkill, uninstallConfluenceSkill } from './writers/skill-writer.mjs';
```

to:

```js
import {
  installSkill,
  uninstallSkill,
  installConfluenceSkill,
  uninstallConfluenceSkill,
  installTrelloSkill,
  uninstallTrelloSkill,
} from './writers/skill-writer.mjs';
```

In the install loop, after the `installConfluenceSkill` call:

```js
if (config.confluenceEnabled) {
  installConfluenceSkill(projectRoot, toolKey);
}
```

add:

```js
if (config.trelloEnabled) {
  installTrelloSkill(projectRoot, toolKey);
}
```

In the uninstall loop, after `uninstallConfluenceSkill(projectRoot, toolKey);`, add:

```js
uninstallTrelloSkill(projectRoot, toolKey);
```

- [ ] **Step 2: Update usage guide**

Inside `printUsageGuide`, after the Confluence-conditional block, add:

```js
  if (config.trelloEnabled) {
    console.log('');
    console.log(
      `    ${pc.cyan('/resolve-trello-ticket')}            ${pc.dim('List your assigned Trello cards')}`,
    );
    console.log(
      `    ${pc.cyan('/resolve-trello-ticket <cardId>')}   ${pc.dim('Work on a specific card')}`,
    );
  }
```

- [ ] **Step 3: Smoke-test the installer end-to-end**

Run a dry-installation against a temp dir to confirm nothing throws:
```bash
TMP=$(mktemp -d) && \
  JIRA_URL=https://jira.example.com \
  JIRA_TOKEN=t \
  JIRA_PROJECT_KEY=PRJ \
  TRELLO_API_KEY=k \
  TRELLO_TOKEN=tk \
  TRELLO_BOARD_ID=board1 \
  node -e "process.chdir('$TMP'); import('./src/installer.mjs').then(m => m.run(['--yes', '--tool', 'claude', '--no-figma']))" && \
  ls "$TMP/.claude/skills"
```
Expected output: directory listing includes `resolve-jira-ticket`, `read-confluence-docs` (if enabled), and `resolve-trello-ticket`.

(Note: `installer.mjs` does not export `run` directly — you may need to invoke `bin/cli.mjs` instead. If the smoke-test command does not work as written, just run the full test suite in Step 4.)

- [ ] **Step 4: Run full test suite**

Run:
```bash
npm test
```
Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/installer.mjs
git commit -m "feat: wire Trello skill into installer flow"
```

---

## Task 9: Update README with Trello integration docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the existing README**

Run:
```bash
cat README.md
```
to confirm where the "Confluence Integration" section sits. The new "Trello Integration" section will be inserted right after it, following the same structure (overview → env vars → usage example).

- [ ] **Step 2: Add the Trello section**

After the "Confluence Integration" section in `README.md`, insert:

````markdown
## Trello Integration (optional)

Resolve Trello cards end-to-end with the same workflow as Jira tickets. Opt-in during install.

### Setup

During `npx jira-ticket-skills`, answer **Yes** to "Add Trello integration?" and supply:

- **Trello API key** — from https://trello.com/app-key
- **Trello token** — generate from the same page
- **Default board ID** — visible in the board URL: `https://trello.com/b/<boardId>/...`

For non-interactive installs (`--yes` flag), set:

```bash
TRELLO_API_KEY=...
TRELLO_TOKEN=...
TRELLO_BOARD_ID=...
```

### Usage

```bash
/resolve-trello-ticket               # List cards in your active list (you choose the list)
/resolve-trello-ticket <cardId>      # Work on a specific card
```

The skill auto-moves the card to "In Progress" before implementation. After tests pass, it suggests (but does not auto-execute) the next move.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Trello integration in README"
```

---

## Task 10: Final verification

**Files:**
- (none — verification only)

- [ ] **Step 1: Run full test suite**

Run:
```bash
npm test
```
Expected: ALL tests pass, including the new Trello-related cases in `trello-skill-writer.test.mjs`, `mcp-writer.test.mjs`, `settings-writer.test.mjs`, `prompts.test.mjs`.

- [ ] **Step 2: Verify no stray placeholders or TODOs**

Run:
```bash
grep -rn "TODO\|TBD\|FIXME" templates/resolve-trello-ticket/ || echo "Clean"
```
Expected: `Clean`.

- [ ] **Step 3: Confirm git history is clean**

Run:
```bash
git log --oneline -10
```
Expected: 9 commits from this plan, in order.

- [ ] **Step 4: Done**

Report completion to the user with:
- List of new files created
- Tests passing count
- Reminder to bump `package.json` version + publish if releasing

---

## Self-Review

**1. Spec coverage:**
- Spec §3 (Trello vs Jira table) → Tasks 3-7 implement env, fetch logic (Task 1 SKILL), transition (Task 1 + Task 5), AC combo (Task 1), attachments (Task 1). ✅
- Spec §4 (skill phases) → Task 1 SKILL.md covers all 6 phases including Phase 5 auto-move and Phase 6 manual-move suggestion. ✅
- Spec §5.1 detect-tool → Task 3. ✅
- Spec §5.2 skill-writer → Task 4. ✅
- Spec §5.3 mcp-writer → Task 5. ✅
- Spec §5.4 settings-writer → Task 6. ✅
- Spec §5.5 prompts → Task 7. ✅
- Spec §5.6 installer → Task 8. ✅
- Spec §6 tests → Tasks 4, 5, 6, 7. ✅
- Spec §7 README docs → Task 9. ✅

**2. Placeholder scan:** No TBD/TODO/FIXME. Code blocks contain full implementations. ✅

**3. Type consistency:** Function names consistent across tasks (`installTrelloSkill`/`uninstallTrelloSkill`, `trelloEnabled`/`trelloApiKey`/`trelloToken`/`trelloBoardId`). MCP server name `trello` consistent. Env var `TRELLO_BOARD_ID` consistent. ✅
