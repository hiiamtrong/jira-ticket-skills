import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import pc from 'picocolors';

// ── Logger ──────────────────────────────────────────────────────────────────

export const log = {
  info: (msg) => console.log(`  ${pc.cyan('i')} ${msg}`),
  success: (msg) => console.log(`  ${pc.green('✓')} ${msg}`),
  warn: (msg) => console.log(`  ${pc.yellow('⚠')} ${msg}`),
  error: (msg) => console.log(`  ${pc.red('✗')} ${msg}`),
  step: (msg) => console.log(`\n  ${pc.bold(msg)}`),
};

// ── File Helpers ────────────────────────────────────────────────────────────

export function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function removeFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function removeDirIfEmpty(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      fs.rmdirSync(dirPath);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// ── Deep Merge ──────────────────────────────────────────────────────────────

export function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── CLI Arg Parsing ─────────────────────────────────────────────────────────

export function parseArgs(args) {
  const parsed = {
    uninstall: false,
    yes: false,
    tool: null,
    noFigma: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--uninstall') parsed.uninstall = true;
    if (arg === '--yes' || arg === '-y') parsed.yes = true;
    if (arg === '--no-figma') parsed.noFigma = true;
    if (arg === '--tool' && args[i + 1]) {
      parsed.tool = args[++i];
    }
  }

  return parsed;
}

// ── Command Check ───────────────────────────────────────────────────────────

export function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Banner ──────────────────────────────────────────────────────────────────

export function printBanner() {
  console.log('');
  console.log(
    `  ${pc.bold(pc.cyan('jira-ticket-skills'))} ${pc.dim('v1.0.0')}`,
  );
  console.log(
    `  ${pc.dim('Install Jira ticket resolution skills for AI coding tools')}`,
  );
  console.log('');
}
