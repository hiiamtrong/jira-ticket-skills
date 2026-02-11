import path from 'node:path';
import { fileExists } from './utils.mjs';

/**
 * Tool configurations: where each AI tool stores its files.
 */
export const TOOL_CONFIGS = {
  claude: {
    label: 'Claude Code',
    skillDir: (root) =>
      path.join(root, '.claude', 'skills', 'resolve-jira-ticket'),
    skillFile: 'SKILL.md',
    mcpConfig: (root) => path.join(root, '.mcp.json'),
    mcpKey: 'mcpServers',
    settingsFile: (root) => path.join(root, '.claude', 'settings.json'),
    settingsEnvPath: ['env'],
  },
  cursor: {
    label: 'Cursor',
    skillDir: (root) => path.join(root, '.cursor', 'skills', 'resolve-jira-ticket'),
    skillFile: 'SKILL.md',
    mcpConfig: (root) => path.join(root, '.cursor', 'mcp.json'),
    mcpKey: 'mcpServers',
    settingsFile: (root) => path.join(root, '.cursor', 'settings.json'),
    settingsEnvPath: ['env'],
  },
  antigravity: {
    label: 'Antigravity',
    skillDir: (root) =>
      path.join(root, '.agent', 'skills', 'resolve-jira-ticket'),
    skillFile: 'SKILL.md',
    mcpConfig: (root) => path.join(root, '.agent', 'mcp.json'),
    mcpKey: 'mcpServers',
    settingsFile: (root) => path.join(root, '.agent', 'settings.json'),
    settingsEnvPath: ['env'],
  },
};

/**
 * Detect which AI coding tools are present in the project.
 * Returns array of detected tool keys.
 */
export function detectTools(projectRoot) {
  const detected = [];

  if (fileExists(path.join(projectRoot, '.claude'))) {
    detected.push('claude');
  }
  if (fileExists(path.join(projectRoot, '.cursor'))) {
    detected.push('cursor');
  }
  if (fileExists(path.join(projectRoot, '.agent'))) {
    detected.push('antigravity');
  }

  return detected;
}

/**
 * Get the config for a specific tool.
 */
export function getToolConfig(toolKey) {
  return TOOL_CONFIGS[toolKey] || null;
}

/**
 * Get all supported tool keys.
 */
export function getSupportedTools() {
  return Object.keys(TOOL_CONFIGS);
}
