---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
feature: confluence-reader
---

# Requirements & Problem Understanding — Confluence Reader Skill

## Problem Statement
**What problem are we solving?**

- Developers using AI coding tools (Claude Code, Cursor, Antigravity) often need to reference Confluence documentation while working on tickets — architecture decisions, API specs, onboarding guides, runbooks, etc.
- Currently, there is no skill in `jira-ticket-skills` that enables AI agents to search and read Confluence pages. Developers must manually open Confluence, copy content, and paste it into the AI chat.
- This manual process breaks flow and prevents the AI agent from autonomously discovering documentation context linked to a Jira ticket or specified by the user.

## Goals & Objectives
**What do we want to achieve?**

**Primary goals:**
- Add a `read-confluence-docs` skill that AI agents can invoke to search, retrieve, and summarize Confluence pages
- Extend the installer CLI to prompt for Confluence credentials and register the `confluence` MCP server (via `mcp-atlassian`)
- Install the Confluence skill template for all three supported AI tools (Claude Code, Cursor, Antigravity)

**Secondary goals:**
- Allow the `resolve-jira-ticket` skill to optionally chain into `read-confluence-docs` when a Jira ticket references a Confluence link
- Provide Confluence space search so the agent can discover relevant pages without needing an exact URL

**Non-goals:**
- Creating or editing Confluence pages (read-only access only in this iteration)
- A separate MCP server binary — `mcp-atlassian` already supports Confluence
- Supporting non-Atlassian wiki systems (Notion, etc.)
- Confluence Server basic auth (username + password without a token) — not supported in this iteration

**In scope (auth):**
- Atlassian Cloud: email + API token
- Confluence Data Center / Server: Personal Access Token (PAT)

## User Stories & Use Cases
**How will users interact with the solution?**

1. **As a developer**, I want to say "read the Confluence page about our authentication architecture" so that the AI agent fetches and summarizes it without me leaving my IDE.
2. **As a developer working on a Jira ticket**, I want the AI agent to automatically follow Confluence links in the ticket description/comments so that I get the full documentation context before implementation.
3. **As a new team member**, I want to ask "what does our onboarding guide say about database migrations?" so that the AI searches Confluence and surfaces the relevant section.
4. **As a tech lead**, I want to run `npx jira-ticket-skills` and configure Confluence (URL + token) alongside Jira so that Confluence MCP is set up in one step.
5. **As a developer who already installed `jira-ticket-skills`**, I want to run `npx jira-ticket-skills` again to add Confluence without having to reconfigure Jira so that I don't lose my existing setup.

**Key workflows:**
- Installer prompts: "Add Confluence integration?" → asks for CONFLUENCE_URL and CONFLUENCE_API_TOKEN → writes MCP config + skill file
- Skill invocation: user references Confluence or a Jira ticket contains a Confluence link → agent invokes `read-confluence-docs` → fetches page, summarizes, returns context

**Edge cases:**
- Confluence URL is same Atlassian instance as Jira (common in Cloud) — Jira URL is pre-filled as default but token is always asked separately
- User skips Confluence during install — skill is not installed; can be added later via re-run
- Page not found / access denied — skill must report error gracefully
- Confluence page contains child pages — skill should mention children and offer to read them

## Success Criteria
**How will we know when we're done?**

- [ ] Running `npx jira-ticket-skills` offers an optional Confluence configuration step
- [ ] After installation, `.claude/skills/read-confluence-docs/SKILL.md` exists (and equivalents for Cursor/Antigravity)
- [ ] The skill can search Confluence by keyword and return page content via `mcp-atlassian` Confluence tools
- [ ] The skill can fetch a page by URL or ID
- [ ] `mcp-atlassian` Confluence MCP server entry is written to `.mcp.json` (Claude Code) / tool-specific MCP config
- [ ] Integration with `resolve-jira-ticket`: if a Confluence link is detected in a ticket (description, comments, or remote links), the agent automatically invokes `read-confluence-docs`
- [ ] All three tools (Claude Code, Cursor, Antigravity) are supported
- [ ] `CONFLUENCE_URL` + `CONFLUENCE_TOKEN` env vars configure Confluence in `--yes` mode (CI/scripted installs)

## Constraints & Assumptions
**What limitations do we need to work within?**

**Technical constraints:**
- `mcp-atlassian` (via `uvx`) handles both Jira and Confluence from the same server process, configured via environment variables.
- Read-only Confluence access only (MCP tools available: search, get page, get page children, get comments, get page history, get labels, get page images).
- `uvx` / `uv` must already be installed (same prerequisite as Jira).

**Business constraints:**
- Must not break existing Jira-only installations.
- Confluence configuration must be optional — users without Confluence should experience no change.

**Assumptions:**
- Atlassian Cloud users authenticate with email + API token for both Jira and Confluence.
- Atlassian Data Center/Server users authenticate with a Personal Access Token.
- `mcp-atlassian` version supports Confluence tools (confirmed: it does).

## Decisions Made

- **Shared vs. separate credentials:** Credentials are always asked separately. The Jira URL is pre-filled as a default for the Confluence URL (convenience for Atlassian Cloud users sharing the same domain), but the token is always a separate prompt. Rationale: some teams use different service accounts for Confluence vs. Jira.
- **Automatic chaining from `resolve-jira-ticket`:** Yes — when a Confluence link is detected in a Jira ticket (description, comments, or remote links), `resolve-jira-ticket` will automatically invoke `read-confluence-docs`. This is explicitly in scope.

## Questions & Open Items
**What do we still need to clarify?**

- [ ] Should the installer support a `--confluence-only` flag for users who want to add Confluence to an existing install without going through all Jira prompts again?
- [x] ~~What are the exact Confluence MCP tool names?~~ **Resolved** — verified against [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian): `confluence_search`, `confluence_get_page`, `confluence_get_page_children`, `confluence_get_comments`, `confluence_get_page_history`.
