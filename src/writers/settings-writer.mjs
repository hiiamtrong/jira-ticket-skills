import path from 'node:path';
import { readJson, writeJson, writeFile, removeFile, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

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

  const content = `---
description: Jira project configuration for resolve-jira-ticket skill
globs:
alwaysApply: true
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`${config.projectKey}\`

When using the resolve-jira-ticket skill or searching Jira, use project key \`${config.projectKey}\`.
For JQL queries, use: \`project = ${config.projectKey}\`
`;

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
    } else {
      target = target[key];
    }
  }

  writeJson(settingsPath, existing);
  log.success(
    `Removed JIRA_PROJECT_KEY from ${path.relative(projectRoot, settingsPath)}`,
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
