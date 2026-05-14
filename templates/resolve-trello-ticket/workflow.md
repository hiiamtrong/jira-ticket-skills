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

### Phase 6: Verify (test gatekeeper)
A bug or feature is NOT done until a test guards it.

1. **Write/extend tests for THIS fix** — bug repro test that fails without fix; feature tests covering each AC item; refactor: confirm existing coverage. Doc-only changes can skip.
2. Run the project's test suite
3. Run the project's linter
4. If card has repro steps, verify the fix manually
5. If Design Brief exists, verify UI matches Figma specs
6. Report results with evidence (command output)

**Gatekeeper checklist (must all pass before Phase 7):**
- [ ] New/updated test(s) exist for THIS fix at `<file:line>`
- [ ] Those tests pass
- [ ] Full suite passes
- [ ] Linter passes (if configured)

If any item is unchecked → STOP. Do not proceed to Phase 7.

### Phase 7: Move card to "Review" (with confirmation)
After the gatekeeper passes:

1. Match list names case-insensitively against `["In Review", "Code Review", "Review", "Ready for Review"]`.
2. Exactly one match → ask *"Tests pass. Move card to '<list name>'? [Y/n]"* → on confirm `move_card(cardId, listId)`.
3. Multiple matches → present numbered list and ask which.
4. No match → report skip and ask user to advance manually.
5. Tick off any AC checklist items the implementation now satisfies (ask before each `update_checklist_item`).
6. Post a summary `add_comment`: *"Fix implemented. Test(s): <file:line>. Suite + lint pass."*
7. If unchecked AC items remain AND uncovered → do NOT move; return to Phase 5.

**Never move silently.** Always announce before applying.

## Red Flags — STOP if you catch yourself:
- Proposing a fix before completing Phase 3
- Skipping comments, checklists, or attachments in Phase 1
- Skipping Figma analysis when links are present
- Claiming "fixed" without test output evidence
- Moving the card to Review without a test that guards THIS fix
- Skipping the Phase 6 gatekeeper checklist
- Moving the card silently — Phase 7 requires user confirmation
