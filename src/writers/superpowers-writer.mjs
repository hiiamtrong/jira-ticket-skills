import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { log, commandExists, fileExists, ensureDir } from '../utils.mjs';

/**
 * Install superpowers for a specific AI tool.
 * Each tool has a different installation method.
 */
export async function installSuperpowers(projectRoot, toolKey) {
  switch (toolKey) {
    case 'claude':
      return installForClaude();
    case 'cursor':
      return installForCursor();
    case 'antigravity':
      return installForAntigravity(projectRoot);
    default:
      log.warn(`Superpowers auto-install not supported for: ${toolKey}`);
  }
}

/**
 * Claude Code: claude plugin install superpowers
 */
function installForClaude() {
  if (!commandExists('claude')) {
    log.warn(
      `${pc.bold('claude')} CLI not found. Install superpowers manually:`,
    );
    log.info(`  ${pc.cyan('claude plugin install superpowers')}`);
    return;
  }

  // Check if already installed
  try {
    const output = execFileSync('claude', ['plugin', 'list'], {
      encoding: 'utf-8',
      timeout: 15000,
    });
    if (output.includes('superpowers@superpowers-marketplace')) {
      log.success('Superpowers already installed (Claude Code)');
      return;
    }
  } catch {
    // Can't check, try installing anyway
  }

  // Install
  try {
    log.info('Installing superpowers plugin for Claude Code...');
    execFileSync('claude', ['plugin', 'install', 'superpowers'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000,
    });
    log.success('Superpowers installed (Claude Code)');
  } catch (err) {
    log.warn(`Failed to auto-install superpowers for Claude Code`);
    log.info(`  Install manually: ${pc.cyan('claude plugin install superpowers')}`);
  }
}

/**
 * Cursor: npx prpm install collections/superpowers
 */
function installForCursor() {
  // Try prpm first (if globally installed)
  if (commandExists('prpm')) {
    try {
      log.info('Installing superpowers for Cursor via prpm...');
      execFileSync('prpm', ['install', 'collections/superpowers'], {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60000,
      });
      log.success('Superpowers installed (Cursor via prpm)');
      return;
    } catch {
      // Fall through to openskills
    }
  }

  // Try openskills
  if (commandExists('openskills')) {
    try {
      log.info('Installing superpowers for Cursor via openskills...');
      execFileSync(
        'openskills',
        ['install', 'obra/superpowers', '--universal', '--global'],
        { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 },
      );
      execFileSync('openskills', ['sync'], {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000,
      });
      log.success('Superpowers installed (Cursor via openskills)');
      return;
    } catch {
      // Fall through to manual instructions
    }
  }

  // Neither available — try npx prpm
  try {
    log.info('Installing superpowers for Cursor via npx prpm...');
    execFileSync('npx', ['-y', 'prpm', 'install', 'collections/superpowers'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000,
    });
    log.success('Superpowers installed (Cursor via npx prpm)');
    return;
  } catch {
    // Fall through
  }

  log.warn('Could not auto-install superpowers for Cursor');
  log.info(`  Option 1: ${pc.cyan('npm install -g prpm && prpm install collections/superpowers')}`);
  log.info(`  Option 2: ${pc.cyan('bun add -g openskills && openskills install obra/superpowers --universal --global && openskills sync')}`);
}

/**
 * Recursively copy directory contents without overwriting existing files.
 */
function copyDirNoOverwrite(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirNoOverwrite(srcPath, destPath);
    } else if (!fileExists(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Antigravity: clone gemini-superpowers-antigravity and copy skills
 */
function installForAntigravity(projectRoot) {
  // Check if git is available
  if (!commandExists('git')) {
    log.warn('git not found. Install superpowers manually for Antigravity:');
    log.info(
      `  Clone: ${pc.cyan('https://github.com/anthonylee991/gemini-superpowers-antigravity')}`,
    );
    log.info(`  Copy skills into ${pc.cyan('.agent/skills/')}`);
    return;
  }

  // Clone to temp dir (clean up first in case of previous failed install)
  const tempDir = path.join(projectRoot, '.agent', '.superpowers-tmp');
  if (fileExists(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  try {
    log.info('Cloning superpowers for Antigravity...');
    execFileSync(
      'git',
      [
        'clone',
        '--depth=1',
        'https://github.com/anthonylee991/gemini-superpowers-antigravity.git',
        tempDir,
      ],
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 },
    );

    // Repo structure: .agent/skills/, .agent/rules/, .agent/workflows/
    const agentSrc = path.join(tempDir, '.agent');
    let copied = false;

    // Copy skills
    const srcSkills = path.join(agentSrc, 'skills');
    const destSkills = path.join(projectRoot, '.agent', 'skills');
    if (fileExists(srcSkills)) {
      copyDirNoOverwrite(srcSkills, destSkills);
      log.success('Superpowers skills copied to .agent/skills/');
      copied = true;
    }

    // Copy rules
    const srcRules = path.join(agentSrc, 'rules');
    const destRules = path.join(projectRoot, '.agent', 'rules');
    if (fileExists(srcRules)) {
      copyDirNoOverwrite(srcRules, destRules);
      log.success('Superpowers rules copied to .agent/rules/');
      copied = true;
    }

    // Copy workflows
    const srcWorkflows = path.join(agentSrc, 'workflows');
    const destWorkflows = path.join(projectRoot, '.agent', 'workflows');
    if (fileExists(srcWorkflows)) {
      copyDirNoOverwrite(srcWorkflows, destWorkflows);
      log.success('Superpowers workflows copied to .agent/workflows/');
      copied = true;
    }

    if (!copied) {
      log.warn('Cloned repo but no .agent/ directory found');
    }

    // Cleanup temp
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    // Cleanup on failure
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    log.warn(`Could not auto-install superpowers for Antigravity: ${err.message}`);
    log.info(
      `  Clone: ${pc.cyan('https://github.com/anthonylee991/gemini-superpowers-antigravity')}`,
    );
    log.info(`  Copy skills into ${pc.cyan('.agent/skills/')}`);
  }
}
