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
