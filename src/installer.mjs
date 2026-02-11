import pc from 'picocolors';
import { parseArgs, printBanner, log } from './utils.mjs';
import { runPrompts, runNonInteractive, checkPrerequisites } from './prompts.mjs';
import { detectTools, TOOL_CONFIGS } from './detect-tool.mjs';
import { installSkill, uninstallSkill } from './writers/skill-writer.mjs';
import { installMcp, uninstallMcp } from './writers/mcp-writer.mjs';
import { installSettings, uninstallSettings } from './writers/settings-writer.mjs';

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

  // Post-install guidance
  printSuperpowersGuide(config.tools);
  printUsageGuide(config);

  console.log('');
  log.success(pc.bold('Installation complete!'));
  console.log('');
}

/**
 * Uninstall flow.
 */
async function runUninstall(args) {
  const tools = args.tool ? [args.tool] : detectTools(projectRoot);

  if (tools.length === 0) {
    log.info('No AI tool configuration found. Nothing to uninstall.');
    return;
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
 * Print superpowers installation guide per tool.
 */
function printSuperpowersGuide(tools) {
  log.step('Recommended: Install Superpowers');
  console.log(
    `  ${pc.dim('The resolve-jira-ticket skill chains these superpowers skills:')}`,
  );
  console.log(`  ${pc.dim('  - brainstorming')}`);
  console.log(`  ${pc.dim('  - systematic-debugging')}`);
  console.log(`  ${pc.dim('  - verification-before-completion')}`);
  console.log('');

  for (const toolKey of tools) {
    switch (toolKey) {
      case 'claude':
        console.log(`  ${pc.bold('Claude Code:')}`);
        console.log(`    ${pc.cyan('claude plugins install superpowers')}`);
        break;

      case 'cursor':
        console.log(`  ${pc.bold('Cursor:')}`);
        console.log(
          `    ${pc.cyan('npm install -g prpm && prpm install collections/superpowers')}`,
        );
        console.log(`    ${pc.dim('or')}`);
        console.log(
          `    ${pc.cyan('bun add -g openskills && openskills install obra/superpowers --universal --global && openskills sync')}`,
        );
        break;

      case 'antigravity':
        console.log(`  ${pc.bold('Antigravity:')}`);
        console.log(
          `    Clone: ${pc.cyan('https://github.com/anthonylee991/gemini-superpowers-antigravity')}`,
        );
        console.log(
          `    Copy skills into your ${pc.cyan('.agent/skills/')} directory`,
        );
        break;
    }
    console.log('');
  }
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
