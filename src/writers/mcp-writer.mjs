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

  servers.jira = {
    command: 'uvx',
    args: ['mcp-atlassian'],
    env: jiraEnv,
  };

  // Figma HTTP MCP
  if (config.figma) {
    servers.figma = {
      type: 'http',
      url: 'https://mcp.figma.com/mcp',
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

  // Merge: skip servers that already exist
  const skipped = [];
  const added = [];

  for (const [name, serverConfig] of Object.entries(newServers)) {
    if (existingServers[name]) {
      skipped.push(name);
    } else {
      existingServers[name] = serverConfig;
      added.push(name);
    }
  }

  existing[mcpKey] = existingServers;
  writeJson(mcpPath, existing);

  const relPath = path.relative(projectRoot, mcpPath);
  if (added.length) {
    log.success(`Added MCP servers to ${relPath}: ${added.join(', ')}`);
  }
  if (skipped.length) {
    log.warn(`Skipped existing MCP servers in ${relPath}: ${skipped.join(', ')}`);
  }

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

  const serversToRemove = ['jira', 'figma', 'figma-bridge'];
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
      `Removed MCP servers from ${path.relative(projectRoot, mcpPath)}: ${removed.join(', ')}`,
    );
  } else {
    log.info('No MCP servers to remove');
  }
}
