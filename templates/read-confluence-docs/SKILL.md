---
name: read-confluence-docs
description: "Use when the user wants to read, search, or reference Confluence documentation — by URL, page ID, or keyword search. Also invoked automatically by resolve-jira-ticket when Confluence links are detected in a Jira ticket."
---

# Read Confluence Docs

Fetch, search, and summarize Confluence pages to provide documentation context during development.

**Announce:** "Using read-confluence-docs to retrieve Confluence documentation."

## Phase 1: Determine Input Type

Examine what the user provided:

| Input type | Example | Action |
|------------|---------|--------|
| Confluence URL | `https://company.atlassian.net/wiki/spaces/TEAM/pages/123456/Page+Title` | Extract page ID → Phase 2A |
| Numeric page ID | `123456` | Go directly to Phase 2A |
| Search query | `"authentication architecture"` or `"how do migrations work"` | Go to Phase 2B |

**URL page ID extraction:**
- Pattern: `.../pages/<pageId>/...` — extract the numeric segment
- Example: `.../pages/123456/Auth-Guide` → pageId = `123456`

If the input is ambiguous (could be a search or a page title), default to **Phase 2B (search)** and present results.

## Phase 2A: Fetch Page by ID or URL

```
confluence_get_page(page_id="<pageId>")
```

If the page is found, proceed to **Phase 3**.

**If not found or access denied:**
- Report: "Could not fetch page `<id>`: [error]. This may be a permissions issue or the page may have been deleted."
- Offer: "Would you like me to search for it by title instead?"
- If yes → Phase 2B with the page title as the query

## Phase 2B: Search by Keyword or Topic

Build a CQL query from the user's input:

```
confluence_search(query="text ~ \"<keyword>\" ORDER BY lastModified DESC", limit=10)
```

**Present results:**
```
Found N Confluence pages matching "<query>":

1. [Page Title] — Space: TEAM | Last modified: 2025-01-15
   > Brief excerpt or description
2. [Page Title] — Space: DEV | Last modified: 2024-12-03
   > Brief excerpt or description
...

Which page would you like me to read? (Enter number, or 'all' to read the top 3)
```

**Wait for user selection.** Do NOT proceed without it.

If no results found:
- Report: "No Confluence pages found matching `<query>`."
- Suggest: broaden the search terms, check the space key, or provide a direct page URL/ID

## Phase 3: Read and Summarize

Once you have the page content from `confluence_get_page`:

**Output a structured Page Brief:**

```
## Confluence Page: [Page Title]

**Space:** <space key>
**Last modified:** <date> by <author>
**URL:** <page URL>

### Summary
<2-3 sentence high-level summary of what the page covers>

### Key Content
<Extract and present the most relevant sections. Use headings from the original page.
Preserve code blocks, tables, and lists verbatim.
For long pages, focus on the sections most relevant to the user's current task.>

### Related
- **Child pages:** <count> child pages (offer to read them)
- **Labels:** <labels if any>
```

**For long pages:** Summarize the table of contents first, then ask which sections to expand.

**For pages with code blocks:** Always include them verbatim — never paraphrase code.

## Phase 4: Offer Follow-up Actions

After presenting the page brief, always offer:

```
What would you like to do next?
a) Read child pages (use confluence_get_page_children to list them)
b) Get comments on this page (use confluence_get_comments)
c) See page history (use confluence_get_page_history)
d) Search for a related topic
e) Use this documentation as context and continue with my task
```

If the user selects (a), fetch children:
```
confluence_get_page_children(page_id="<pageId>")
```
Present as a numbered list and let the user choose which to read.

## Integration with resolve-jira-ticket

When invoked from `resolve-jira-ticket` (Confluence link detected in a ticket):
- Skip Phase 1 — input is always a URL
- Run Phase 2A directly
- After Phase 3, return immediately to `resolve-jira-ticket` Phase 3 (Map to Codebase) with the Confluence content as additional context
- Do NOT ask for Phase 4 follow-up — the Jira workflow continues automatically

## Error Handling

| Error | Response |
|-------|---------|
| Page not found (404) | Report error, offer to search by title |
| Access denied (403) | "You may not have permission to view this page. Ask your Confluence admin for access." |
| No search results | Suggest broader terms or direct URL |
| Ambiguous results | Present list, ask user to choose |
| MCP tool unavailable | "The Confluence MCP server is not running. Ensure it was configured during setup (`npx jira-ticket-skills`)." |

## Quick Reference

| Tool | When to use |
|------|-------------|
| `confluence_search` | Keyword/topic search, CQL queries |
| `confluence_get_page` | Fetch by page ID (extracted from URL or provided directly) |
| `confluence_get_page_children` | List child pages of a parent page |
| `confluence_get_comments` | Get discussion/comments on a page |
| `confluence_get_page_history` | See revision history and recent changes |
| `confluence_get_labels` | Get labels/tags on a page |
| `confluence_get_page_images` | Get images attached to a page |

## Red Flags — STOP if you catch yourself:

- Fetching a page without checking if the input is a URL, ID, or query first
- Presenting a search result list and then reading all results without user selection
- Paraphrasing or omitting code blocks from fetched pages
- Continuing `resolve-jira-ticket` flow before reading all detected Confluence links
- Claiming a page was "not found" without offering a search fallback
