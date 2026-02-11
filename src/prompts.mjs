import prompts from 'prompts';
import pc from 'picocolors';
import { detectTools, TOOL_CONFIGS, getSupportedTools } from './detect-tool.mjs';
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
    ? jiraUrl.value.trim()
    : `https://${jiraUrl.value.trim()}`;

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
      validate: (v) => (v.includes('@') ? true : 'Valid email required'),
    });
    if (email.value === undefined) throw new Error('Cancelled');
    config.jiraEmail = email.value.trim();
  }

  const jiraToken = await prompts({
    type: 'password',
    name: 'value',
    message:
      config.jiraAuthMethod === 'personal_token'
        ? 'Jira Personal Token'
        : 'Jira API Token',
    validate: (v) => (v.trim() ? true : 'Token is required'),
  });
  if (jiraToken.value === undefined) throw new Error('Cancelled');
  config.jiraToken = jiraToken.value.trim();

  const projectKey = await prompts({
    type: 'text',
    name: 'value',
    message: 'Default Jira project key (e.g. PRJ)',
    initial: process.env.JIRA_PROJECT_KEY || '',
    validate: (v) =>
      /^[A-Z][A-Z0-9]{1,9}$/.test(v.trim().toUpperCase())
        ? true
        : 'Must be 2-10 uppercase letters/numbers, starting with a letter',
  });
  if (projectKey.value === undefined) throw new Error('Cancelled');
  config.projectKey = projectKey.value.trim().toUpperCase();

  // ── 3. Figma configuration ───────────────────────────────────────────
  if (!cliArgs.noFigma) {
    log.step('Figma Integration');

    const enableFigma = await prompts({
      type: 'confirm',
      name: 'value',
      message: 'Enable Figma design integration?',
      initial: true,
    });
    config.figma = enableFigma.value ?? false;

    if (config.figma) {
      const figmaBridge = await prompts({
        type: 'confirm',
        name: 'value',
        message:
          'Also install Figma Bridge (connects to Figma desktop app for live design context)?',
        initial: true,
      });
      config.figmaBridge = figmaBridge.value ?? false;
    }
  } else {
    config.figma = false;
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

  const detected = detectTools(projectRoot);

  if (detected.length === 1) {
    const label = TOOL_CONFIGS[detected[0]].label;
    log.info(`Detected: ${pc.bold(label)}`);
    return detected;
  }

  if (detected.length > 1) {
    log.info(
      `Detected multiple tools: ${detected.map((t) => TOOL_CONFIGS[t].label).join(', ')}`,
    );
  }

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
  const jiraUrl = process.env.JIRA_URL;
  const jiraToken = process.env.JIRA_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  const tool = cliArgs.tool || process.env.TOOL || 'claude';

  if (!jiraUrl) throw new Error('JIRA_URL env var is required in --yes mode');
  if (!jiraToken)
    throw new Error('JIRA_TOKEN env var is required in --yes mode');
  if (!projectKey)
    throw new Error('JIRA_PROJECT_KEY env var is required in --yes mode');

  return {
    tools: [tool],
    jiraUrl,
    jiraToken,
    jiraAuthMethod: 'personal_token',
    projectKey: projectKey.toUpperCase(),
    figma: !cliArgs.noFigma,
    figmaBridge: !cliArgs.noFigma,
  };
}

/**
 * Check prerequisites and print warnings.
 */
export function checkPrerequisites() {
  log.step('Checking prerequisites...');

  if (!commandExists('uvx')) {
    log.warn(
      `${pc.bold('uvx')} not found. Required for Jira MCP server (mcp-atlassian).`,
    );
    log.info(`Install: ${pc.cyan('pip install uv')} or ${pc.cyan('pipx install uv')}`);
    console.log('');
  } else {
    log.success('uvx found');
  }
}
