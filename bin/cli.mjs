#!/usr/bin/env node

import { run } from '../src/installer.mjs';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  jira-ticket-skills - Install Jira ticket resolution skills for AI coding tools

  Usage:
    npx jira-ticket-skills              Interactive install
    npx jira-ticket-skills --uninstall  Remove installed skill + configs
    npx jira-ticket-skills --yes        Non-interactive (uses env vars)

  Environment variables (for --yes mode):
    JIRA_URL             Jira instance URL
    JIRA_TOKEN           Jira personal/API token
    JIRA_PROJECT_KEY     Default project key (e.g. PRJ)
    TOOL                 AI tool: claude | cursor | antigravity

  Options:
    --tool <name>        Force AI tool (claude, cursor, antigravity)
    --no-figma           Skip Figma integration
    --uninstall          Remove all installed files and configs
    --yes, -y            Non-interactive mode
    --help, -h           Show this help
`);
  process.exit(0);
}

run(args).catch((err) => {
  console.error(`\n  Error: ${err.message}`);
  process.exit(1);
});
