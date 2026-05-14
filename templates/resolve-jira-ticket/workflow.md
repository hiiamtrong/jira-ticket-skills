---
description: Resolve a Jira ticket end-to-end. Fetches ticket via Jira MCP, analyzes context including Figma designs, maps to codebase, then chains brainstorming and systematic debugging to deliver the fix or feature.
---

# Resolve Jira Ticket

## Task
Resolve this Jira ticket: **{{input}}**

If `{{input}}` is empty or missing, search for assigned tickets using Jira MCP with:
```
project = $JIRA_PROJECT_KEY AND assignee = currentUser() AND status IN ("To Do", "In Progress", "Re-Open") ORDER BY priority DESC, created DESC
```
Present the list and ask the user to pick one. STOP until they choose.

## Workflow

Follow these phases strictly in order. Do NOT skip phases or jump ahead.

### Phase 1: Deep Ticket Analysis
Use Jira MCP tools to gather ALL context:
1. Full ticket details (summary, description, priority, acceptance criteria)
2. **ALL comments** — read every single comment. They contain repro steps, stack traces, investigation notes, workarounds
3. Linked issues — read their descriptions and comments too
4. Scan description, comments, and remote links for Figma URLs (`figma.com/design/...`, `figma.com/file/...`)

Output a **Ticket Brief** with: type, reported behavior, expected behavior, repro steps, errors, affected area, team notes from comments, previous attempts, related tickets, design references.

Ask: "Does this capture the ticket correctly?"

### Phase 2: Figma Design Analysis (if links found)
Skip if no Figma links found.
- Ask user to open Figma desktop app
- Extract nodeId from URLs (replace `-` with `:` in node-id param)
- Use Figma MCP: get_node, get_screenshot, get_design_context, get_variable_defs
- Output a **Design Brief** with: layout structure, components, design tokens, UI elements
- Create an **ASCII wireframe** of the design

### Phase 3: Map to Codebase
1. Search for keywords from ticket (error messages, function names, status values)
2. Trace code paths — entry points, business logic, data layer
3. If Design Brief exists, match Figma components to code components
4. Check git history: `git log --oneline -20 -- <affected-files>`
5. Output a **Codebase Mapping** with: primary files, related files, recent changes, observations

### Phase 4: Brainstorm
Load and follow the skill: `.agent/skills/superpowers-brainstorm/` (or use `/superpowers-brainstorm`)

Focus on: how the feature works (happy path), state transitions, where behavior diverges, what needs to change, edge cases.

### Phase 5: Debug / Implement
Load and follow the skill: `.agent/skills/superpowers-debug/` (or use `/superpowers-debug`)

Hand off full context from Phases 1-4. Follow the four debugging phases:
1. Root cause investigation
2. Pattern analysis
3. Hypothesis and testing
4. Implementation

### Phase 6: Verify (test gatekeeper)
A bug or feature is NOT done until a test guards it.

1. **Write/extend tests for THIS fix** — bug repro test that fails without fix; feature tests covering each AC; refactor: confirm existing coverage. Doc-only changes can skip.
2. Run the project's test suite
3. Run the project's linter
4. If ticket has repro steps, verify the fix manually
5. If Design Brief exists, verify UI matches Figma specs
6. Report results with evidence (command output)

**Gatekeeper checklist (must all pass before Phase 7):**
- [ ] New/updated test(s) exist for THIS fix at `<file:line>`
- [ ] Those tests pass
- [ ] Full suite passes
- [ ] Linter passes (if configured)

If any item is unchecked → STOP. Do not proceed to Phase 7.

### Phase 7: Move ticket to "In Review" (with confirmation)
After the gatekeeper passes:

1. Call `jira_get_transitions(issueKey)` to list available transitions.
2. Match transition names case-insensitively against `["In Review", "Code Review", "Review", "Ready for Review"]`.
3. Exactly one match → ask *"Tests pass. Move <PRJ-XXX> to '<transition name>'? [Y/n]"* → on confirm `jira_transition_issue(issueKey, transitionId)`.
4. Multiple matches → present numbered list and ask which.
5. No match → report skip and ask user to transition manually.
6. Post a summary `jira_add_comment`: *"Fix implemented. Test(s): <file:line>. Suite + lint pass."*

**Never move silently.** Always announce before applying.

## Red Flags — STOP if you catch yourself:
- Proposing a fix before completing Phase 3
- Skipping comments or linked issues in Phase 1
- Skipping Figma analysis when links are present
- Claiming "fixed" without test output evidence
- Moving the ticket to In Review without a test that guards THIS fix
- Skipping the Phase 6 gatekeeper checklist
- Transitioning the ticket without confirming with the user first
