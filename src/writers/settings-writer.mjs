import path from 'node:path';
import { readJson, readFile, writeJson, writeFile, removeFile, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

/**
 * Read previously installed config for a tool so prompts can pre-fill values.
 * Tokens/passwords are never returned (security).
 * Returns an object with any subset of: projectKey, jiraUrl, jiraAuthMethod,
 * jiraEmail, confluenceEnabled, confluenceUrl, confluenceAuthMethod,
 * trelloEnabled, trelloBoardId.
 */
export function readExistingConfig(projectRoot, toolKey) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) return {};

  const result = {};

  if (toolConfig.settingsType === 'rules') {
    _readFromRulesFile(toolConfig.settingsFile(projectRoot), result);
  } else {
    _readFromJsonSettings(toolConfig, projectRoot, result);
  }

  _readFromMcpConfig(toolConfig.mcpConfig(projectRoot), toolConfig.mcpKey, result);

  return result;
}

function _readFromJsonSettings(toolConfig, projectRoot, result) {
  const settings = readJson(toolConfig.settingsFile(projectRoot));
  if (!settings) return;

  let env = settings;
  for (const key of toolConfig.settingsEnvPath) {
    env = env?.[key];
  }
  if (!env) return;

  if (env.JIRA_PROJECT_KEY) result.projectKey = env.JIRA_PROJECT_KEY;
  if (env.TRELLO_BOARD_ID) result.trelloBoardId = env.TRELLO_BOARD_ID;
}

function _readFromRulesFile(rulesPath, result) {
  const content = readFile(rulesPath);
  if (!content) return;

  const projectKeyMatch = content.match(/\*\*JIRA_PROJECT_KEY\*\*[^`]*`([^`]+)`/);
  if (projectKeyMatch) result.projectKey = projectKeyMatch[1];

  const trelloBoardMatch = content.match(/\*\*TRELLO_BOARD_ID\*\*[^`]*`([^`]+)`/);
  if (trelloBoardMatch) {
    result.trelloBoardId = trelloBoardMatch[1];
    result.trelloEnabled = true;
  }
}

function _readFromMcpConfig(mcpPath, mcpKey, result) {
  const mcp = readJson(mcpPath);
  if (!mcp) return;

  const servers = mcp[mcpKey];
  if (!servers) return;

  const jira = servers.jira?.env;
  if (jira) {
    if (jira.JIRA_URL) result.jiraUrl = jira.JIRA_URL;
    if (jira.JIRA_API_TOKEN) {
      result.jiraAuthMethod = 'api_token';
      if (jira.JIRA_USERNAME) result.jiraEmail = jira.JIRA_USERNAME;
    } else if (jira.JIRA_PERSONAL_TOKEN) {
      result.jiraAuthMethod = 'personal_token';
    }
  }

  const confluence = servers.confluence?.env;
  if (confluence) {
    result.confluenceEnabled = true;
    if (confluence.CONFLUENCE_URL) result.confluenceUrl = confluence.CONFLUENCE_URL;
    if (confluence.CONFLUENCE_API_TOKEN) {
      result.confluenceAuthMethod = 'api_token';
      if (confluence.CONFLUENCE_USERNAME) result.confluenceEmail = confluence.CONFLUENCE_USERNAME;
    } else if (confluence.CONFLUENCE_PERSONAL_TOKEN) {
      result.confluenceAuthMethod = 'personal_token';
    }
  }

  if (servers.trello) {
    result.trelloEnabled = true;
  }
}

/**
 * Install settings (env vars) for a specific tool.
 */
export function installSettings(projectRoot, toolKey, config) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) throw new Error(`Unknown tool: ${toolKey}`);

  if (toolConfig.settingsType === 'rules') {
    return installRulesSettings(projectRoot, toolConfig, config);
  }

  return installJsonSettings(projectRoot, toolConfig, config);
}

/**
 * Write env vars into a JSON settings file (Claude Code, Antigravity).
 */
function installJsonSettings(projectRoot, toolConfig, config) {
  const settingsPath = toolConfig.settingsFile(projectRoot);
  const existing = readJson(settingsPath) || {};

  const envUpdate = { JIRA_PROJECT_KEY: config.projectKey };
  if (config.trelloEnabled) {
    envUpdate.TRELLO_BOARD_ID = config.trelloBoardId;
  }

  let target = existing;
  const envPath = toolConfig.settingsEnvPath;

  for (let i = 0; i < envPath.length; i++) {
    const key = envPath[i];
    if (i === envPath.length - 1) {
      target[key] = { ...(target[key] || {}), ...envUpdate };
    } else {
      target[key] = target[key] || {};
      target = target[key];
    }
  }

  writeJson(settingsPath, existing);

  const relPath = path.relative(projectRoot, settingsPath);
  log.success(`Set JIRA_PROJECT_KEY=${config.projectKey} in ${relPath}`);
}

/**
 * Write config as a Cursor rules file (.mdc) so the AI reads it as context.
 */
function installRulesSettings(projectRoot, toolConfig, config) {
  const rulesPath = toolConfig.settingsFile(projectRoot);

  const trelloBlock = config.trelloEnabled
    ? `

# Trello Configuration

- **TRELLO_BOARD_ID**: \`${config.trelloBoardId}\`

When using the resolve-trello-ticket skill, use board ID \`${config.trelloBoardId}\`.
`
    : '';

  const content = `---
description: Jira and Trello project configuration for resolve-* skills
globs:
alwaysApply: true
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`${config.projectKey}\`

When using the resolve-jira-ticket skill or searching Jira, use project key \`${config.projectKey}\`.
For JQL queries, use: \`project = ${config.projectKey}\`
${trelloBlock}`;

  writeFile(rulesPath, content);

  const relPath = path.relative(projectRoot, rulesPath);
  log.success(`Set JIRA_PROJECT_KEY=${config.projectKey} in ${relPath}`);
}

/**
 * Uninstall settings we added.
 */
export function uninstallSettings(projectRoot, toolKey) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) return;

  if (toolConfig.settingsType === 'rules') {
    return uninstallRulesSettings(projectRoot, toolConfig);
  }

  return uninstallJsonSettings(projectRoot, toolConfig);
}

/**
 * Remove env var from JSON settings file.
 */
function uninstallJsonSettings(projectRoot, toolConfig) {
  const settingsPath = toolConfig.settingsFile(projectRoot);
  const existing = readJson(settingsPath);
  if (!existing) {
    log.info('No settings file found');
    return;
  }

  let target = existing;
  const envPath = toolConfig.settingsEnvPath;

  for (const key of envPath) {
    if (!target[key]) return;
    if (key === envPath[envPath.length - 1]) {
      delete target[key].JIRA_PROJECT_KEY;
      delete target[key].TRELLO_BOARD_ID;
    } else {
      target = target[key];
    }
  }

  writeJson(settingsPath, existing);
  log.success(
    `Removed JIRA_PROJECT_KEY and TRELLO_BOARD_ID from ${path.relative(projectRoot, settingsPath)}`,
  );
}

/**
 * Remove rules file.
 */
function uninstallRulesSettings(projectRoot, toolConfig) {
  const rulesPath = toolConfig.settingsFile(projectRoot);

  if (removeFile(rulesPath)) {
    log.success(`Removed ${path.relative(projectRoot, rulesPath)}`);
  } else {
    log.info(`Rules file not found: ${path.relative(projectRoot, rulesPath)}`);
  }
}
