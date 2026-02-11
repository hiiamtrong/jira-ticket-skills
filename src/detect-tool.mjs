import os from 'node:os';
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
    settingsType: 'rules',
    settingsFile: (root) =>
      path.join(root, '.cursor', 'rules', 'jira-config.mdc'),
  },
  antigravity: {
    label: 'Antigravity (Google)',
    skillDir: (root) =>
      path.join(root, '.agent', 'skills', 'resolve-jira-ticket'),
    skillFile: 'SKILL.md',
    workflowDir: (root) => path.join(root, '.agent', 'workflows'),
    workflowFile: 'resolve-jira-ticket.md',
    // Antigravity IDE uses global config at ~/.gemini/antigravity/mcp_config.json
    mcpConfig: () => path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
    mcpKey: 'mcpServers',
    settingsType: 'rules',
    settingsFile: (root) =>
      path.join(root, '.agent', 'rules', 'jira-config.md'),
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
  if (
    fileExists(path.join(projectRoot, '.gemini')) ||
    fileExists(path.join(projectRoot, '.agent')) ||
    fileExists(path.join(os.homedir(), '.gemini', 'antigravity'))
  ) {
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
