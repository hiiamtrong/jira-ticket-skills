import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installConfluenceSkill, uninstallConfluenceSkill } from '../src/writers/skill-writer.mjs';
import { TOOL_CONFIGS } from '../src/detect-tool.mjs';

// Create a fresh temp dir for each test via a helper
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-skill-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── installConfluenceSkill ────────────────────────────────────────────────────

test('installConfluenceSkill(claude): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'claude');
    const expected = path.join(root, '.claude', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(fs.existsSync(expected), `Expected file to exist: ${expected}`);
  } finally {
    cleanup(root);
  }
});

test('installConfluenceSkill(cursor): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'cursor');
    const expected = path.join(root, '.cursor', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(fs.existsSync(expected), `Expected file to exist: ${expected}`);
  } finally {
    cleanup(root);
  }
});

test('installConfluenceSkill(antigravity): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'antigravity');
    const expected = path.join(root, '.agent', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(fs.existsSync(expected), `Expected file to exist: ${expected}`);
  } finally {
    cleanup(root);
  }
});

test('installConfluenceSkill: file content matches template SKILL.md', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'claude');
    const installed = path.join(root, '.claude', 'skills', 'read-confluence-docs', 'SKILL.md');
    const templatePath = new URL('../templates/read-confluence-docs/SKILL.md', import.meta.url).pathname;
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const installedContent = fs.readFileSync(installed, 'utf-8');
    assert.equal(installedContent, templateContent);
  } finally {
    cleanup(root);
  }
});

test('installConfluenceSkill: throws on unknown tool', () => {
  assert.throws(
    () => installConfluenceSkill('/tmp', 'unknown-tool'),
    /Unknown tool/,
  );
});

test('installConfluenceSkill: overwrites existing file without error', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'claude');
    // Should not throw
    installConfluenceSkill(root, 'claude');
    const expected = path.join(root, '.claude', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

// ── uninstallConfluenceSkill ──────────────────────────────────────────────────

test('uninstallConfluenceSkill(claude): removes installed file', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'claude');
    const expected = path.join(root, '.claude', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(fs.existsSync(expected));

    uninstallConfluenceSkill(root, 'claude');
    assert.ok(!fs.existsSync(expected), 'File should be removed');
  } finally {
    cleanup(root);
  }
});

test('uninstallConfluenceSkill(cursor): removes installed file', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'cursor');
    uninstallConfluenceSkill(root, 'cursor');
    const expected = path.join(root, '.cursor', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(!fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('uninstallConfluenceSkill(antigravity): removes installed file', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'antigravity');
    uninstallConfluenceSkill(root, 'antigravity');
    const expected = path.join(root, '.agent', 'skills', 'read-confluence-docs', 'SKILL.md');
    assert.ok(!fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('uninstallConfluenceSkill: no-op when file does not exist (idempotent)', () => {
  const root = makeTempDir();
  try {
    // Should not throw when nothing installed
    assert.doesNotThrow(() => uninstallConfluenceSkill(root, 'claude'));
  } finally {
    cleanup(root);
  }
});

test('uninstallConfluenceSkill: removes empty parent dir after uninstall', () => {
  const root = makeTempDir();
  try {
    installConfluenceSkill(root, 'claude');
    uninstallConfluenceSkill(root, 'claude');
    const skillDir = path.join(root, '.claude', 'skills', 'read-confluence-docs');
    // Dir should be gone (empty after removing the only file)
    assert.ok(!fs.existsSync(skillDir), 'Empty skill dir should be removed');
  } finally {
    cleanup(root);
  }
});

test('uninstallConfluenceSkill: unknown tool is silently ignored', () => {
  assert.doesNotThrow(() => uninstallConfluenceSkill('/tmp', 'unknown-tool'));
});
