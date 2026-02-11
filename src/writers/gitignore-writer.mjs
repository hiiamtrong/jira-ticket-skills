import path from 'node:path';
import { readFile, writeFile, fileExists, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

/**
 * Entries to add to .gitignore (files that may contain credentials).
 */
const GITIGNORE_ENTRIES = {
  claude: ['.mcp.json', '.claude/settings.json'],
  cursor: ['.cursor/mcp.json'],
  antigravity: ['.agent/mcp.json', '.agent/settings.json'],
};

/**
 * Add credential-containing files to .gitignore.
 */
export function updateGitignore(projectRoot, tools) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const existing = readFile(gitignorePath) || '';
  const lines = existing.split('\n');

  // Collect all entries needed
  const entriesToAdd = [];
  for (const toolKey of tools) {
    const entries = GITIGNORE_ENTRIES[toolKey] || [];
    for (const entry of entries) {
      if (!lines.some((line) => line.trim() === entry)) {
        entriesToAdd.push(entry);
      }
    }
  }

  if (entriesToAdd.length === 0) {
    log.success('.gitignore already up to date');
    return;
  }

  // Add section header + entries
  const section = [
    '',
    '# jira-ticket-skills (MCP credentials)',
    ...entriesToAdd,
    '',
  ].join('\n');

  const updated = existing.trimEnd() + '\n' + section;
  writeFile(gitignorePath, updated);

  log.success(
    `Added to .gitignore: ${entriesToAdd.join(', ')}`,
  );
}
