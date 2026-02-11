import path from 'node:path';
import { readJson, writeJson, deepMerge, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

/**
 * Install settings (env vars) for a specific tool.
 */
export function installSettings(projectRoot, toolKey, config) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) throw new Error(`Unknown tool: ${toolKey}`);

  const settingsPath = toolConfig.settingsFile(projectRoot);
  const existing = readJson(settingsPath) || {};

  // Build the env object at the correct nested path
  const envUpdate = { JIRA_PROJECT_KEY: config.projectKey };

  // Navigate to the correct nesting using settingsEnvPath
  let target = existing;
  const envPath = toolConfig.settingsEnvPath;

  for (let i = 0; i < envPath.length; i++) {
    const key = envPath[i];
    if (i === envPath.length - 1) {
      // Last key: merge env vars
      target[key] = { ...(target[key] || {}), ...envUpdate };
    } else {
      // Intermediate key: ensure object exists
      target[key] = target[key] || {};
      target = target[key];
    }
  }

  writeJson(settingsPath, existing);

  const relPath = path.relative(projectRoot, settingsPath);
  log.success(`Set JIRA_PROJECT_KEY=${config.projectKey} in ${relPath}`);
}

/**
 * Uninstall settings we added.
 */
export function uninstallSettings(projectRoot, toolKey) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) return;

  const settingsPath = toolConfig.settingsFile(projectRoot);
  const existing = readJson(settingsPath);
  if (!existing) {
    log.info('No settings file found');
    return;
  }

  // Navigate to env object and remove our key
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
