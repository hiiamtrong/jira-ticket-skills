import prompts from 'prompts';
import pc from 'picocolors';
import { TOOL_CONFIGS, getSupportedTools } from './detect-tool.mjs';
import { log, commandExists } from './utils.mjs';

/**
 * Run all interactive prompts. Returns collected config.
 */
export async function runPrompts(projectRoot, cliArgs) {
  const config = {};

  // ── 1. Detect / select AI tool ────────────────────────────────────────
  config.tools = await promptTools(projectRoot, cliArgs);

  // ── 2. Jira configuration ────────────────────────────────────────────
  log.step('Jira Configuration');

  const jiraUrl = await prompts({
    type: 'text',
    name: 'value',
    message: 'Jira instance URL',
    initial: process.env.JIRA_URL || '',
    format: (v) => v.trim(),
    validate: (v) => {
      if (!v.trim()) return 'URL is required';
      try {
        new URL(v.startsWith('http') ? v : `https://${v}`);
        return true;
      } catch {
        return 'Invalid URL';
      }
    },
  });
  if (jiraUrl.value === undefined) throw new Error('Cancelled');
  config.jiraUrl = jiraUrl.value.startsWith('http')
    ? jiraUrl.value
    : `https://${jiraUrl.value}`;

  const jiraAuth = await prompts({
    type: 'select',
    name: 'value',
    message: 'Jira authentication method',
    choices: [
      { title: 'Personal Token (Server/DC)', value: 'personal_token' },
      { title: 'API Token + Email (Cloud)', value: 'api_token' },
    ],
  });
  if (jiraAuth.value === undefined) throw new Error('Cancelled');
  config.jiraAuthMethod = jiraAuth.value;

  if (config.jiraAuthMethod === 'api_token') {
    const email = await prompts({
      type: 'text',
      name: 'value',
      message: 'Jira account email',
      format: (v) => v.trim(),
      validate: (v) => (v.trim().includes('@') ? true : 'Valid email required'),
    });
    if (email.value === undefined) throw new Error('Cancelled');
    config.jiraEmail = email.value;
  }

  const jiraToken = await prompts({
    type: 'password',
    name: 'value',
    message:
      config.jiraAuthMethod === 'personal_token'
        ? 'Jira Personal Token'
        : 'Jira API Token',
    format: (v) => v.trim(),
    validate: (v) => (v.trim() ? true : 'Token is required'),
  });
  if (jiraToken.value === undefined) throw new Error('Cancelled');
  config.jiraToken = jiraToken.value;

  const projectKey = await prompts({
    type: 'text',
    name: 'value',
    message: 'Default Jira project key (e.g. PRJ)',
    initial: process.env.JIRA_PROJECT_KEY || '',
    format: (v) => v.trim().toUpperCase(),
    validate: (v) =>
      /^[A-Z][A-Z0-9]{1,9}$/.test(v.trim().toUpperCase())
        ? true
        : 'Must be 2-10 uppercase letters/numbers, starting with a letter',
  });
  if (projectKey.value === undefined) throw new Error('Cancelled');
  config.projectKey = projectKey.value;

  // ── 3. Figma configuration ───────────────────────────────────────────
  if (!cliArgs.noFigma) {
    log.step('Figma Integration');

    const figmaBridge = await prompts({
      type: 'confirm',
      name: 'value',
      message:
        'Install Figma Bridge (connects to Figma desktop app for live design context)?',
      initial: true,
    });
    config.figmaBridge = figmaBridge.value ?? false;
  } else {
    config.figmaBridge = false;
  }

  return config;
}

/**
 * Prompt for AI tool selection.
 */
async function promptTools(projectRoot, cliArgs) {
  // CLI override
  if (cliArgs.tool) {
    const supported = getSupportedTools();
    if (!supported.includes(cliArgs.tool)) {
      throw new Error(
        `Unknown tool: ${cliArgs.tool}. Supported: ${supported.join(', ')}`,
      );
    }
    return [cliArgs.tool];
  }

  // Always ask user to choose platform
  const allTools = getSupportedTools().map((key) => ({
    title: TOOL_CONFIGS[key].label,
    value: key,
  }));

  const result = await prompts({
    type: 'multiselect',
    name: 'value',
    message: 'Install for which AI tools?',
    choices: allTools,
    min: 1,
    hint: 'Space to select, Enter to confirm',
    instructions: false,
  });

  if (!result.value || result.value.length === 0) {
    throw new Error('Cancelled - no tool selected');
  }

  return result.value;
}

/**
 * Run non-interactive mode using env vars.
 */
export function runNonInteractive(cliArgs) {
  const jiraUrl = process.env.JIRA_URL?.trim();
  const jiraToken = process.env.JIRA_TOKEN?.trim();
  const projectKey = process.env.JIRA_PROJECT_KEY?.trim();
  const tool = (cliArgs.tool || process.env.TOOL || 'claude').trim();

  if (!jiraUrl) throw new Error('JIRA_URL env var is required in --yes mode');
  if (!jiraToken)
    throw new Error('JIRA_TOKEN env var is required in --yes mode');
  if (!projectKey)
    throw new Error('JIRA_PROJECT_KEY env var is required in --yes mode');

  return {
    tools: [tool],
    jiraUrl: jiraUrl.startsWith('http') ? jiraUrl : `https://${jiraUrl}`,
    jiraToken,
    jiraAuthMethod: 'personal_token',
    projectKey: projectKey.toUpperCase(),
    figmaBridge: !cliArgs.noFigma,
  };
}

/**
 * Check prerequisites and print warnings.
 * Returns detected Jira runner: 'uvx' | 'uv' | null
 */
export function checkPrerequisites() {
  log.step('Checking prerequisites...');

  if (commandExists('uvx')) {
    log.success('uvx found');
    return 'uvx';
  }

  if (commandExists('uv')) {
    log.success('uv found (will use "uv tool run" instead of uvx)');
    return 'uv';
  }

  log.warn(
    `${pc.bold('uvx')} not found. Required for Jira MCP server (mcp-atlassian).`,
  );
  if (process.platform === 'win32') {
    log.info(`Install: ${pc.cyan('pip install uv')} or ${pc.cyan('winget install astral-sh.uv')}`);
  } else {
    log.info(`Install: ${pc.cyan('pip install uv')} or ${pc.cyan('brew install uv')}`);
  }
  console.log('');
  return null;
}
