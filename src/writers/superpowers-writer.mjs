import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { log, commandExists, fileExists, ensureDir } from '../utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPERPOWERS_DIR = path.join(__dirname, '..', '..', 'templates', 'superpowers');

/**
 * Install superpowers for a specific AI tool.
 * - Claude Code: official plugin (full superpowers)
 * - Cursor / Antigravity: copy only required skills from bundled templates
 */
export async function installSuperpowers(projectRoot, toolKey) {
  switch (toolKey) {
    case 'claude':
      return installForClaude();
    case 'cursor':
      return installFromTemplates(projectRoot, {
        skillsDir: path.join(projectRoot, '.cursor', 'skills'),
      });
    case 'antigravity':
      return installFromTemplates(projectRoot, {
        skillsDir: path.join(projectRoot, '.agent', 'skills'),
        rulesDir: path.join(projectRoot, '.agent', 'rules'),
        workflowsDir: path.join(projectRoot, '.agent', 'workflows'),
      });
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
 * Copy bundled superpowers templates to project (Cursor & Antigravity).
 * Only copies the 4 required skills, no unnecessary files.
 */
function installFromTemplates(projectRoot, { skillsDir, rulesDir, workflowsDir }) {
  const srcSkills = path.join(SUPERPOWERS_DIR, 'skills');
  let installed = 0;

  // Copy skills
  if (fileExists(srcSkills)) {
    const skillFolders = fs.readdirSync(srcSkills, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const folder of skillFolders) {
      const src = path.join(srcSkills, folder.name);
      const dest = path.join(skillsDir, folder.name);
      copyDirNoOverwrite(src, dest);
      installed++;
    }

    if (installed > 0) {
      log.success(`Installed ${installed} superpowers skills`);
    }
  }

  // Copy rules (Antigravity only)
  if (rulesDir) {
    const srcRules = path.join(SUPERPOWERS_DIR, 'rules');
    if (fileExists(srcRules)) {
      copyDirNoOverwrite(srcRules, rulesDir);
      log.success('Installed superpowers rules');
    }
  }

  // Copy workflows (Antigravity only)
  if (workflowsDir) {
    const srcWorkflows = path.join(SUPERPOWERS_DIR, 'workflows');
    if (fileExists(srcWorkflows)) {
      copyDirNoOverwrite(srcWorkflows, workflowsDir);
      log.success('Installed superpowers workflows');
    }
  }

  if (installed === 0) {
    log.warn('No superpowers templates found in package');
  }
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
 * Uninstall superpowers for a specific tool.
 */
export function uninstallSuperpowers(projectRoot, toolKey) {
  const srcSkills = path.join(SUPERPOWERS_DIR, 'skills');
  if (!fileExists(srcSkills)) return;

  const skillNames = fs.readdirSync(srcSkills, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let destBase;
  switch (toolKey) {
    case 'cursor':
      destBase = path.join(projectRoot, '.cursor');
      break;
    case 'antigravity':
      destBase = path.join(projectRoot, '.agent');
      break;
    default:
      return; // Claude uses plugin system, no file cleanup needed
  }

  // Remove skill folders
  for (const name of skillNames) {
    const dir = path.join(destBase, 'skills', name);
    if (fileExists(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Remove rules (Antigravity)
  if (toolKey === 'antigravity') {
    const rulesFile = path.join(destBase, 'rules', 'superpowers.md');
    if (fileExists(rulesFile)) fs.unlinkSync(rulesFile);
  }

  // Remove workflows (Antigravity)
  if (toolKey === 'antigravity') {
    const srcWorkflows = path.join(SUPERPOWERS_DIR, 'workflows');
    if (fileExists(srcWorkflows)) {
      for (const file of fs.readdirSync(srcWorkflows)) {
        const dest = path.join(destBase, 'workflows', file);
        if (fileExists(dest)) fs.unlinkSync(dest);
      }
    }
  }

  log.success(`Removed superpowers files for ${toolKey}`);
}
