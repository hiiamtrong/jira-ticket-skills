import prompts from 'prompts';
import pc from 'picocolors';
import { parseArgs, printBanner, log, commandExists } from './utils.mjs';
import { runPrompts, runNonInteractive, checkPrerequisites } from './prompts.mjs';
import { TOOL_CONFIGS, getSupportedTools } from './detect-tool.mjs';
import { installSkill, uninstallSkill } from './writers/skill-writer.mjs';
import { installMcp, uninstallMcp } from './writers/mcp-writer.mjs';
import { installSettings, uninstallSettings } from './writers/settings-writer.mjs';
import { installSuperpowers } from './writers/superpowers-writer.mjs';
import { updateGitignore } from './writers/gitignore-writer.mjs';

const projectRoot = process.cwd();

/**
 * Main entry point.
 */
export async function run(argv) {
  const args = parseArgs(argv);

  printBanner();

  if (args.uninstall) {
    return runUninstall(args);
  }

  return runInstall(args);
}

/**
 * Install flow.
 */
async function runInstall(args) {
  // Prerequisites check
  checkPrerequisites();

  // Collect configuration
  let config;
  if (args.yes) {
    config = runNonInteractive(args);
  } else {
    config = await runPrompts(projectRoot, args);
  }

  // Install for each selected tool
  log.step('Installing...');

  for (const toolKey of config.tools) {
    const label = TOOL_CONFIGS[toolKey].label;
    console.log(`\n  ${pc.dim('─')} ${pc.bold(label)}`);

    installSkill(projectRoot, toolKey);
    installMcp(projectRoot, toolKey, config);
    installSettings(projectRoot, toolKey, config);
  }

  // Update .gitignore
  log.step('Securing credentials...');
  updateGitignore(projectRoot, config.tools);

  // Install superpowers
  log.step('Installing Superpowers...');
  for (const toolKey of config.tools) {
    await installSuperpowers(projectRoot, toolKey);
  }

  // Usage guide
  printUsageGuide(config);

  console.log('');
  log.success(pc.bold('Installation complete!'));
  console.log('');
  log.warn(
    `${pc.bold('Restart your current AI tool session')} for the new config to take effect.`,
  );
  console.log('');
}

/**
 * Uninstall flow.
 */
async function runUninstall(args) {
  let tools;

  if (args.tool) {
    tools = [args.tool];
  } else {
    const allTools = getSupportedTools().map((key) => ({
      title: TOOL_CONFIGS[key].label,
      value: key,
    }));

    const result = await prompts({
      type: 'multiselect',
      name: 'value',
      message: 'Uninstall from which AI tools?',
      choices: allTools,
      min: 1,
      hint: 'Space to select, Enter to confirm',
      instructions: false,
    });

    if (!result.value || result.value.length === 0) {
      throw new Error('Cancelled - no tool selected');
    }
    tools = result.value;
  }

  log.step('Uninstalling...');

  for (const toolKey of tools) {
    const label = TOOL_CONFIGS[toolKey]?.label || toolKey;
    console.log(`\n  ${pc.dim('─')} ${pc.bold(label)}`);

    uninstallSkill(projectRoot, toolKey);
    uninstallMcp(projectRoot, toolKey);
    uninstallSettings(projectRoot, toolKey);
  }

  console.log('');
  log.success(pc.bold('Uninstall complete!'));
  console.log('');
}

/**
 * Print usage guide.
 */
function printUsageGuide(config) {
  log.step('Usage');
  console.log(
    `  Invoke the skill in your AI tool with:`,
  );
  console.log('');
  console.log(
    `    ${pc.cyan('/resolve-jira-ticket')}            ${pc.dim('List your assigned tickets')}`,
  );
  console.log(
    `    ${pc.cyan(`/resolve-jira-ticket ${config.projectKey}-123`)}  ${pc.dim('Work on a specific ticket')}`,
  );
}
