---
name: verify-jira-ticket
description: "Use when a dev wants to verify their own Jira ticket before it moves to QA — fetches AC from the ticket, prompts for API base URL and auth, constructs live API calls for each AC item, compares responses against expected behavior, then moves the ticket to 'Ready for Test' on full pass"
---

# Verify Jira Ticket

Verify a Jira ticket by calling the actual API — not by reading code. Each acceptance criterion becomes an API test. Pass all → move to "Ready for Test".

**Announce:** "Using verify-jira-ticket to verify the ticket against the live API."

**Configuration:** Reads `JIRA_PROJECT_KEY` env var (or asks the user). The API base URL and auth token are collected at runtime — never from env vars (they differ per environment).

---

## Phase 1: Fetch Ticket and Extract AC

**If user provided a ticket ID (e.g., PRJ-123):** use it directly.

**Otherwise:**

1. Read `JIRA_PROJECT_KEY`. If absent, ask the user.
2. Search for tickets in "In Review" / "Code Review" status:
```
project = $JIRA_PROJECT_KEY AND assignee = currentUser() AND status IN ("In Review", "Code Review") ORDER BY updated DESC
```
3. Present numbered list. **Wait for user selection.**

**Then fetch full ticket context:**

1. `jira_get_issue(issueKey, fields='*all')` — description, AC field, comments, remote links.
2. Read ALL comments — they often contain curl examples, API contracts, or clarifications from the reporter.
3. **Extract Acceptance Criteria** — combine all sources:
   - Custom AC field (if present)
   - Description: sections labelled "AC:", "Acceptance Criteria:", "Given/When/Then"
   - Markdown checklists (`- [ ] item`) in description or comments

4. Output a structured **Verification Plan:**

```
## Verification Plan: [PRJ-XXX] Title

**Status:** In Review → target: Ready for Test
**AC items found:** N

| # | Acceptance Criterion | Verification method |
|---|----------------------|---------------------|
| 1 | <AC text> | API call → assert <expected> |
| 2 | <AC text> | API call → assert <expected> |
...

**Ambiguous items** (cannot map to an API call):
- <item> — reason: <why it's unclear>
```

Ask: "Does this AC list look complete? Any items to add or clarify before I build the API calls?"

**STOP and wait for user confirmation.**

---

## Phase 2: Collect API Context

Ask the user these questions **in a single prompt** (do not split into multiple turns):

```
To verify via API, I need:

1. Base URL of the dev/staging environment (e.g., https://api.dev.example.com)
2. Auth method:
   a) Bearer token → paste token
   b) Cookie / session → paste cookie header value
   c) Basic auth → username:password
   d) No auth required
3. Any required headers beyond auth (e.g., X-Tenant-ID, Content-Type)?
4. Any path prefix for all endpoints (e.g., /api/v1)?
```

Store the collected values as:
- `BASE_URL` — strip trailing slash
- `AUTH_HEADER` — the full header string (e.g., `Authorization: Bearer <token>`)
- `EXTRA_HEADERS` — array of additional headers
- `PATH_PREFIX` — prepend to all endpoint paths (default: empty)

Do NOT log or echo the auth token value after this step.

---

## Phase 3: Build API Calls from AC

For each AC item from Phase 1:

1. **Map to HTTP call** — infer from the AC text:
   - Identify: HTTP method, endpoint path, request body/params, expected response (status code, body fields, behavior).
   - If the ticket description or comments contain example curl commands or request payloads → use them as the source of truth.
   - If the AC is ambiguous (cannot determine endpoint) → flag it and ask the user to clarify before proceeding.

2. **Generate a curl command** for each:

```bash
curl -s -X <METHOD> "<BASE_URL><PATH_PREFIX><path>" \
  -H "<AUTH_HEADER>" \
  [-H "<EXTRA_HEADER>"] \
  [-H "Content-Type: application/json"] \
  [-d '<request body>'] \
  | jq .   # pretty-print JSON response
```

3. Show all generated curl commands to the user and ask: "Do these API calls look right before I run them? [Y/n to adjust]"

**STOP and wait for confirmation.**

---

## Phase 4: Execute and Verify

Run each curl command in sequence. For each AC item:

1. Execute the curl command via Bash.
2. Parse the response:
   - HTTP status code (`-w "%{http_code}"` flag)
   - Response body (JSON parsed where applicable)
3. Compare against the AC's expected behavior:
   - Status code matches expected (e.g., 200, 201, 400, 404)
   - Required fields present in response body
   - Specific field values match (if AC specifies exact values)
   - Error message matches (for negative test cases)
4. Record result: **PASS** or **FAIL** with evidence.

Output a **Verification Report** after all calls:

```
## Verification Report: [PRJ-XXX]

| # | AC Item | HTTP Call | Status | Result | Evidence |
|---|---------|-----------|--------|--------|----------|
| 1 | <text>  | GET /endpoint | 200 OK | ✅ PASS | `{"id": 1, ...}` |
| 2 | <text>  | POST /endpoint | 201 Created | ✅ PASS | `{"created": true}` |
| 3 | <text>  | GET /endpoint?x=bad | 400 | ❌ FAIL | Expected 400, got 200 |

**Result: N/M passed**

**Failed items:**
- AC #3: Expected 400 Bad Request for invalid input, got 200 OK.
  Response: `{"data": null}`
  Action needed: investigate endpoint validation logic.
```

---

## Phase 5: Move to "Ready for Test" (only on full pass)

**If any AC item FAILED:** Stop here. Do NOT move the ticket.

Report: *"Verification incomplete — N item(s) failed (see report above). Fix and re-run `/verify-jira-ticket` before moving to Ready for Test."*

**If ALL AC items PASSED:**

1. Call `jira_get_transitions(issueKey)` to list available transitions.
2. Match transition names case-insensitively against `["Ready for Test", "Ready for QA", "QA", "Testing"]`.
3. Apply move policy:
   - **Exactly one match:** ask *"All N AC items passed. Move [PRJ-XXX] to '<transition name>'? [Y/n]"*. On confirm → `jira_transition_issue(issueKey, transitionId)`.
   - **Multiple matches:** present numbered list and ask which to apply.
   - **No match:** report *"No 'Ready for Test'-style transition found. Available: [list]. Please transition manually."*
4. Post a verification summary comment via `jira_add_comment`:

```
✅ API verification complete — all N AC items passed.

Verified against: <BASE_URL> (environment not logged for security)
Verified by: <current user>

| # | AC Item | Result |
|---|---------|--------|
| 1 | <text>  | ✅ PASS — GET /endpoint → 200 OK |
| 2 | <text>  | ✅ PASS — POST /endpoint → 201 Created |

Moving to Ready for Test.
```

**Never move silently.** Always confirm before transitioning.

---

## Quick Reference

| Phase | Action | Tools |
|-------|--------|-------|
| 1. Fetch AC | Get ticket, extract all AC items | Jira MCP (`jira_get_issue`) |
| 2. API context | Collect base URL + auth from user | Prompt |
| 3. Build calls | Map each AC → curl command | Bash (preview only) |
| 4. Execute | Run calls, compare to expected | Bash + curl |
| 5. Move | Confirm + transition to Ready for Test | Jira MCP (`jira_get_transitions`, `jira_transition_issue`, `jira_add_comment`) |

---

## Red Flags — STOP if you catch yourself:

- Running API calls before user confirms the curl commands look right (Phase 3)
- Logging or echoing the auth token after Phase 2
- Moving the ticket when any AC item FAILED
- Skipping ambiguous AC items without flagging them to the user
- Using code reading or test files as a substitute for actual API calls — this skill verifies the **running system**, not the source code
- Moving the ticket without user confirmation
- Guessing endpoint paths not mentioned in the AC or ticket — ask the user
