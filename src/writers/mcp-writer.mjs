import os from 'node:os';
import path from 'node:path';
import { readJson, writeJson, deepMerge, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

/**
 * Build MCP server entries from user config.
 */
function buildMcpServers(config) {
  const servers = {};

  // Jira MCP (mcp-atlassian via uvx)
  const jiraEnv = {
    JIRA_URL: config.jiraUrl,
  };

  if (config.jiraAuthMethod === 'api_token') {
    jiraEnv.JIRA_API_TOKEN = config.jiraToken;
    jiraEnv.JIRA_USERNAME = config.jiraEmail;
  } else {
    jiraEnv.JIRA_PERSONAL_TOKEN = config.jiraToken;
  }

  if (config.jiraRunner === 'uv') {
    servers.jira = {
      command: 'uv',
      args: ['tool', 'run', 'mcp-atlassian'],
      env: jiraEnv,
    };
  } else {
    servers.jira = {
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: jiraEnv,
    };
  }

  // Figma Bridge (via npx @gethopp/figma-mcp-bridge)
  if (config.figmaBridge) {
    servers['figma-bridge'] = {
      command: 'npx',
      args: ['-y', '@gethopp/figma-mcp-bridge'],
    };
  }

  return servers;
}

/**
 * Install MCP server config for a specific tool.
 */
export function installMcp(projectRoot, toolKey, config) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) throw new Error(`Unknown tool: ${toolKey}`);

  const mcpPath = toolConfig.mcpConfig(projectRoot);
  const mcpKey = toolConfig.mcpKey;
  const existing = readJson(mcpPath) || {};

  const newServers = buildMcpServers(config);
  const existingServers = existing[mcpKey] || {};

  const added = [];
  const updated = [];

  for (const [name, serverConfig] of Object.entries(newServers)) {
    if (existingServers[name]) {
      existingServers[name] = serverConfig;
      updated.push(name);
    } else {
      existingServers[name] = serverConfig;
      added.push(name);
    }
  }

  existing[mcpKey] = existingServers;
  writeJson(mcpPath, existing);

  const displayPath = formatDisplayPath(projectRoot, mcpPath);
  if (added.length) {
    log.success(`Added MCP servers to ${displayPath}: ${added.join(', ')}`);
  }
  if (updated.length) {
    log.success(`Updated MCP servers in ${displayPath}: ${updated.join(', ')}`);
  }
}

/**
 * Format a path for display: use relative for project files, ~ for home dir files.
 */
function formatDisplayPath(projectRoot, filePath) {
  if (filePath.startsWith(projectRoot)) {
    return path.relative(projectRoot, filePath);
  }
  const home = os.homedir();
  if (filePath.startsWith(home)) {
    return '~' + filePath.slice(home.length);
  }
  return filePath;
}

/**
 * Uninstall MCP server entries we added.
 */
export function uninstallMcp(projectRoot, toolKey) {
  const toolConfig = getToolConfig(toolKey);
  if (!toolConfig) return;

  const mcpPath = toolConfig.mcpConfig(projectRoot);
  const mcpKey = toolConfig.mcpKey;
  const existing = readJson(mcpPath);
  if (!existing || !existing[mcpKey]) {
    log.info('No MCP config found');
    return;
  }

  const serversToRemove = ['jira', 'figma-bridge'];
  const removed = [];

  for (const name of serversToRemove) {
    if (existing[mcpKey][name]) {
      delete existing[mcpKey][name];
      removed.push(name);
    }
  }

  if (removed.length) {
    writeJson(mcpPath, existing);
    log.success(
      `Removed MCP servers from ${formatDisplayPath(projectRoot, mcpPath)}: ${removed.join(', ')}`,
    );
  } else {
    log.info('No MCP servers to remove');
  }
}
