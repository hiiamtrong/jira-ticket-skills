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
   c. For every other checklist on the card, call `get_checklist_items(checklistId="<id>")` to capture its items.

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
- Use `v` or `[Dropdown v]` for select/dropdown
- Use `...` for truncated text
- Show multiple states if the design has them
- Label each section clearly
- Keep proportions roughly matching the Figma layout
- For tables, use standard ASCII table format with `|` and `---`
- Add annotations with `<-- note` for non-obvious interactions

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

## Phase 6: Verification (gatekeeper — tests are mandatory)

**INVOKE:** `superpowers:verification-before-completion`

A bug or feature is NOT done until a test guards it. The test is the gatekeeper that prevents regression.

### Step 1 — Write/extend tests for THIS fix

For **bugs:**
- Write a test that reproduces the original bug. It must FAIL on the unfixed code path and PASS after your fix.
- Cover the specific edge case from the reproduction steps in the Card Brief.

For **features/stories:**
- Write tests that cover each acceptance criterion (description text + every checklist item) from the Card Brief.
- Include happy path + at least one edge case.

For **refactors / non-behavioral changes:**
- Confirm existing tests still cover the touched code path. If coverage is missing, add it.
- State explicitly: *"No new behavior added — existing tests at `<paths>` cover the change."*

**Skip-test allowed only if** the change is documentation/comment-only. State this explicitly.

### Step 2 — Run the full suite

1. Run the project's test suite (e.g., `npm test`, `pnpm test`, `yarn test`, `make test`).
2. Run the project's linter if available (e.g., `npm run lint`, `pnpm lint`).
3. If card has reproduction steps, verify manually.
4. If Design Brief exists, verify UI changes match Figma specs.
5. Report results with evidence (command output).

### Step 3 — Gatekeeper check (MUST pass before Phase 7)

Confirm in your report:
- [ ] New/updated test(s) exist for THIS fix at `<file:line>`
- [ ] Those tests pass
- [ ] Full suite passes
- [ ] Linter passes (if configured)

If any item is unchecked → **STOP**. Do not proceed to Phase 7. Fix or add the missing piece.

## Phase 7: Move card to "Review" (with confirmation)

After the gatekeeper passes:

1. From `get_lists()` (already cached from Phase 1), match list names case-insensitively against `["In Review", "Code Review", "Review", "Ready for Review"]`.
2. Apply the move policy:
   - **Exactly one match:** ask the user *"Tests pass. Move card to '<list name>'? [Y/n]"*. On confirm → `move_card(cardId="<cardId>", listId="<targetListId>")`.
   - **Multiple matches:** present numbered list and ask which to apply.
   - **No match:** report *"No 'Review'-style list found. Available lists: [names]. Skipping move — please advance the card manually."*
3. Tick off any acceptance-criteria checklist items that are now satisfied:
   - For each unchecked item that the implementation covers, ask *"Mark AC item '<text>' as done? [Y/n]"* then call `update_checklist_item(...)`.
   - List remaining unchecked items in the report.
4. After moving, post a summary comment via `add_comment`:

   ```
   Fix implemented. Test(s): <file:line>. Suite + lint pass.
   ```

5. If any AC items remain unchecked AND uncovered, do NOT move — return to Phase 5.

**Never move silently.** Always announce the transition before applying it. If user declines, report status and stop.

## Quick Reference

| Phase             | Action                              | Sub-skill / Tools                |
| ----------------- | ----------------------------------- | -------------------------------- |
| 1. Select         | Pick list, then card                | Trello MCP (`set_active_board`, `get_lists`, `get_cards_by_list_id`) |
| 2. Analyze        | Card details, comments, AC, attachments | Trello MCP (`get_card`, `get_card_comments`, `get_acceptance_criteria`, `get_checklist_items`) |
| 2. Confluence     | Read linked Confluence docs         | read-confluence-docs             |
| 2.5 Design        | Extract Figma specs + ASCII UI draft | Figma MCP                       |
| 3. Map            | Find relevant code paths            | Grep, Read, git log             |
| 4. Understand     | Feature/bug design context          | brainstorming                    |
| 5. Auto-move + Implement | Auto-move to In Progress, then fix/build | Trello MCP (`move_card`) + systematic-debugging |
| 6. Verify (gate)  | Write/extend tests for fix, run suite + lint | verification-before-completion |
| 7. Move to Review | Confirm + `move_card` to In Review, tick AC | Trello MCP (`move_card`, `update_checklist_item`, `add_comment`) |

## Red Flags - STOP if you catch yourself:

- Proposing a fix before completing Phase 3
- Skipping comments or checklists in Phase 2
- **Skipping attachments — image OR document — when present on the card**
- **Skipping Confluence doc reading when Confluence links are present in the card**
- **Skipping Figma design analysis when Figma links are present in the card**
- **Not creating an ASCII UI draft when Figma links are present**
- Not invoking systematic-debugging for the fix
- Claiming "fixed" without test output evidence
- **Moving the card to Review without a test that guards THIS fix**
- **Skipping the Phase 6 gatekeeper checklist (test exists + passes)**
- Moving the card silently — Phase 7 requires user confirmation
- Implementing UI changes without referencing the Design Brief
