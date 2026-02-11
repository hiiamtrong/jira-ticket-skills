---
name: resolve-jira-ticket
description: "Use when the user wants to work on a Jira ticket (Bug, Story, Task, or any type), resolve issues from Jira, pick up assigned work, or references a ticket ID - fetches tickets via Jira MCP, analyzes context including Figma design links, then chains brainstorming and systematic debugging/implementation to deliver the fix or feature"
---

# Resolve Jira Ticket

Orchestrate the full lifecycle of resolving a Jira ticket: fetch assigned work, analyze ticket context (including Figma designs), map to codebase, then chain brainstorming and systematic debugging/implementation to deliver.

**Announce:** "Using resolve-jira-ticket to analyze and resolve a Jira ticket."

**Configuration:** The Jira project key is configured via `JIRA_PROJECT_KEY` env var (Claude Code, Antigravity) or in a rules file (Cursor). Read this value at the start and use it throughout the workflow. If not set, **ask the user** for the project key before proceeding.

## Phase 1: Fetch and Select Ticket

**If user provided a ticket ID (e.g., PRJ-123):** Skip to Phase 2.

**Otherwise:**

1. Read project key from `JIRA_PROJECT_KEY` (env var or rules context). If not set, **stop and ask the user** for the project key.
2. Search using Jira MCP tools with JQL:
```
project = $JIRA_PROJECT_KEY AND assignee = currentUser() AND status IN ("To Do", "In Progress", "Re-Open") ORDER BY priority DESC, created DESC
```

3. Present numbered list:
```
Found N tickets assigned to you:

1. [PRJ-101] Payment fails for TRON transactions (Bug, High, To Do)
2. [PRJ-98] Webhook stuck in PENDING (Bug, Medium, In Progress)
3. [PRJ-95] Add address validation UI (Story, Medium, To Do)

Which ticket to work on?
```

3. **Wait for user selection.** Do NOT proceed without it.

## Phase 2: Deep Ticket Analysis

Gather ALL context via Jira MCP tools:

1. **Full ticket details** - summary, description, priority, reporter, acceptance criteria, environment, issue type
2. **ALL comments (CRITICAL)** - Fetch and read EVERY comment on the ticket. Comments often contain the most valuable information:
   - Reproduction steps discovered by QA/team
   - Stack traces and error logs pasted by reporters
   - Previous investigation notes and findings
   - Workarounds already attempted
   - Screenshots or environment-specific details
   - Cross-references to related code or PRs
   **YOU MUST read all comments before proceeding. Do NOT skip this step even if the description seems sufficient.**
3. **Linked issues** - related bugs, parent stories, blockers. Read their descriptions and comments too for additional context.
4. **Figma link detection (CRITICAL)** - Scan ALL of the following for Figma URLs:
   - Ticket description
   - ALL comments
   - Remote links (use `jira_get_issue` with `fields: '*all'` to capture remote links)
   - Linked issue descriptions

   **Figma URL patterns to detect:**
   - `figma.com/design/...`
   - `figma.com/file/...`
   - `figma.com/proto/...`
   - `figma.com/board/...`

   Collect all unique Figma links with context about where each was found.

**Output a structured Ticket Brief:**

```
## Ticket Brief: [PRJ-XXX] Title

**Type:** Bug / Story / Task / etc.
**Reported behavior:** What is broken (for bugs) or what needs to be built (for features)
**Expected behavior:** What should happen or acceptance criteria
**Reproduction steps:** From description AND comments (for bugs)
**Stack traces/errors:** Any error output from description or comments
**Affected area:** Module/feature (e.g., "payment processing", "user dashboard")
**Environment:** Env-specific details
**Team notes:** Key insights extracted from ALL comments (summarize each commenter's input)
**Previous attempts:** Workarounds or fixes already tried (from comments)
**Related tickets:** Linked issues and their key context
**Design references:** [List of Figma links found, with source context]
```

Ask user: "Does this capture the ticket correctly? Any additional context?"

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
- **`get_selection()`** - Get currently selected nodes (useful if user selects the frame manually)
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
|  +------------------+  +--------------------+   |
|  | Card 1           |  | Card 2             |   |
|  | - Label: Value   |  | - Label: Value     |   |
|  | - Label: Value   |  | - Label: Value     |   |
|  | [Action Button]  |  | [Action Button]    |   |
|  +------------------+  +--------------------+   |
|                                                 |
|  [ Cancel ]                    [ Submit (CTA) ] |
+-----------------------------------------------+
```

Guidelines for ASCII drafts:
- Use `+---+` for borders, `|` for vertical edges
- Use `[Button Text]` for buttons and CTAs
- Use `[____]` or `[________________________]` for input fields
- Use `( ) Option` for radio buttons, `[x] Option` for checkboxes
- Use `v` or `[Dropdown v]` for select/dropdown
- Use `...` for truncated text
- Show multiple states if the design has them (default, loading, error, empty)
- Label each section clearly
- Keep proportions roughly matching the Figma layout
- For tables, use standard ASCII table format with `|` and `---`
- Add annotations with `<-- note` for non-obvious interactions

**Integration with ticket context:**
- For **bugs**: Compare current UI implementation against Figma design to identify visual discrepancies
- For **features/stories**: Use design as the implementation specification, ASCII draft serves as quick reference during coding
- For **tasks**: Reference design for UI-related work context

## Phase 3: Map to Codebase

1. **Identify affected area** from the ticket brief — search for relevant modules, services, components, or routes in the project structure

2. **Search keywords** from ticket (error messages, function names, status values, UI text) using Grep across the codebase

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

## Phase 5: Systematic Debugging / Implementation

**INVOKE:** `superpowers:systematic-debugging`

Hand off with full context from Phases 2-4:
- Ticket brief (Phase 2)
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

1. Run the project's test suite (e.g., `npm test`, `pnpm test`, `yarn test`, `make test`)
2. Run the project's linter if available (e.g., `npm run lint`, `pnpm lint`)
3. If ticket has reproduction steps, verify manually
4. If Design Brief exists, verify UI changes match Figma specs
5. Report results with evidence

**Do NOT update Jira automatically.** Report fix summary and let user decide.

## Quick Reference

| Phase             | Action                              | Sub-skill / Tools                |
| ----------------- | ----------------------------------- | -------------------------------- |
| 1. Select         | Fetch tickets, user picks           | Jira MCP                        |
| 2. Analyze        | Read ticket details/comments/links  | Jira MCP                        |
| 2.5 Design        | Extract Figma specs + ASCII UI draft | Figma MCP (get_node, get_screenshot, get_design_context, get_variable_defs, get_metadata, get_document) |
| 3. Map            | Find relevant code paths            | Grep, Read, git log             |
| 4. Understand     | Feature/bug design context          | brainstorming                    |
| 5. Debug/Implement| Root cause + fix / build feature    | systematic-debugging             |
| 6. Verify         | Tests, lint, design match, evidence | verification-before-completion   |

## Red Flags - STOP if you catch yourself:

- Proposing a fix before completing Phase 3
- Skipping comments or linked issues in Phase 2
- **Skipping Figma design analysis when Figma links are present in the ticket**
- **Not creating an ASCII UI draft when Figma links are present**
- Not invoking systematic-debugging for the fix
- Claiming "fixed" without test output evidence
- Updating Jira without user permission
- Implementing UI changes without referencing the Design Brief
