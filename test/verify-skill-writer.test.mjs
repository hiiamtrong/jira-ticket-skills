import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installVerifySkill, uninstallVerifySkill } from '../src/writers/skill-writer.mjs';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-verify-'));
}

test('installVerifySkill(claude): creates SKILL.md at correct path', () => {
  const root = makeTmpDir();
  installVerifySkill(root, 'claude');
  const dest = path.join(root, '.claude', 'skills', 'verify-jira-ticket', 'SKILL.md');
  assert.ok(fs.existsSync(dest), `Expected file at ${dest}`);
});

test('installVerifySkill(cursor): creates SKILL.md at correct path', () => {
  const root = makeTmpDir();
  installVerifySkill(root, 'cursor');
  const dest = path.join(root, '.cursor', 'skills', 'verify-jira-ticket', 'SKILL.md');
  assert.ok(fs.existsSync(dest), `Expected file at ${dest}`);
});

test('installVerifySkill(antigravity): creates SKILL.md at correct path', () => {
  const root = makeTmpDir();
  installVerifySkill(root, 'antigravity');
  const dest = path.join(root, '.agent', 'skills', 'verify-jira-ticket', 'SKILL.md');
  assert.ok(fs.existsSync(dest), `Expected file at ${dest}`);
});

test('installVerifySkill: file content contains verify-jira-ticket name', () => {
  const root = makeTmpDir();
  installVerifySkill(root, 'claude');
  const content = fs.readFileSync(
    path.join(root, '.claude', 'skills', 'verify-jira-ticket', 'SKILL.md'),
    'utf-8',
  );
  assert.ok(content.includes('verify-jira-ticket'), 'SKILL.md should reference verify-jira-ticket');
});

test('installVerifySkill: throws on unknown tool', () => {
  const root = makeTmpDir();
  assert.throws(() => installVerifySkill(root, 'unknown'), /Unknown tool/);
});

test('uninstallVerifySkill(claude): removes installed file', () => {
  const root = makeTmpDir();
  installVerifySkill(root, 'claude');
  uninstallVerifySkill(root, 'claude');
  const dest = path.join(root, '.claude', 'skills', 'verify-jira-ticket', 'SKILL.md');
  assert.ok(!fs.existsSync(dest), 'File should be removed');
});

test('uninstallVerifySkill: idempotent when nothing installed', () => {
  const root = makeTmpDir();
  assert.doesNotThrow(() => uninstallVerifySkill(root, 'claude'));
});
