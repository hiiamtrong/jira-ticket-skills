import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, fileExists, removeFile, removeDirIfEmpty, log } from '../utils.mjs';
import { getToolConfig } from '../detect-tool.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'resolve-jira-ticket');

/**
 * Install skill file for a specific tool.
 */
export function installSkill(projectRoot, toolKey) {
  const config = getToolConfig(toolKey);
  if (!config) throw new Error(`Unknown tool: ${toolKey}`);

  const srcFile = path.join(TEMPLATE_DIR, 'SKILL.md');
  const destDir = config.skillDir(projectRoot);
  const destFile = path.join(destDir, config.skillFile);

  if (fileExists(destFile)) {
    log.warn(`Skill already exists: ${path.relative(projectRoot, destFile)} (overwriting)`);
  }

  copyFile(srcFile, destFile);
  log.success(`Installed skill: ${path.relative(projectRoot, destFile)}`);
}

/**
 * Uninstall skill file for a specific tool.
 */
export function uninstallSkill(projectRoot, toolKey) {
  const config = getToolConfig(toolKey);
  if (!config) return;

  const destDir = config.skillDir(projectRoot);
  const destFile = path.join(destDir, config.skillFile);

  if (removeFile(destFile)) {
    log.success(`Removed: ${path.relative(projectRoot, destFile)}`);
    removeDirIfEmpty(destDir);
  } else {
    log.info(`Skill not found: ${path.relative(projectRoot, destFile)}`);
  }
}
