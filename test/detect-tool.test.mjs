import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { TOOL_CONFIGS, getSupportedTools } from '../src/detect-tool.mjs';

const ROOT = '/fake/project';

test('getSupportedTools returns all 3 tools', () => {
  const tools = getSupportedTools();
  assert.deepEqual(tools, ['claude', 'cursor', 'antigravity']);
});

// ── Claude ────────────────────────────────────────────────────────────────────

test('claude: confluenceSkillDir returns correct path', () => {
  const dir = TOOL_CONFIGS.claude.confluenceSkillDir(ROOT);
  assert.equal(dir, path.join(ROOT, '.claude', 'skills', 'read-confluence-docs'));
});

test('claude: confluenceSkillFile is SKILL.md', () => {
  assert.equal(TOOL_CONFIGS.claude.confluenceSkillFile, 'SKILL.md');
});

test('claude: skillDir and confluenceSkillDir are sibling directories', () => {
  const skillDir = TOOL_CONFIGS.claude.skillDir(ROOT);
  const confluenceDir = TOOL_CONFIGS.claude.confluenceSkillDir(ROOT);
  assert.equal(path.dirname(skillDir), path.dirname(confluenceDir));
});

// ── Cursor ────────────────────────────────────────────────────────────────────

test('cursor: confluenceSkillDir returns correct path', () => {
  const dir = TOOL_CONFIGS.cursor.confluenceSkillDir(ROOT);
  assert.equal(dir, path.join(ROOT, '.cursor', 'skills', 'read-confluence-docs'));
});

test('cursor: confluenceSkillFile is SKILL.md', () => {
  assert.equal(TOOL_CONFIGS.cursor.confluenceSkillFile, 'SKILL.md');
});

test('cursor: skillDir and confluenceSkillDir are sibling directories', () => {
  const skillDir = TOOL_CONFIGS.cursor.skillDir(ROOT);
  const confluenceDir = TOOL_CONFIGS.cursor.confluenceSkillDir(ROOT);
  assert.equal(path.dirname(skillDir), path.dirname(confluenceDir));
});

// ── Antigravity ───────────────────────────────────────────────────────────────

test('antigravity: confluenceSkillDir returns correct path', () => {
  const dir = TOOL_CONFIGS.antigravity.confluenceSkillDir(ROOT);
  assert.equal(dir, path.join(ROOT, '.agent', 'skills', 'read-confluence-docs'));
});

test('antigravity: confluenceSkillFile is SKILL.md', () => {
  assert.equal(TOOL_CONFIGS.antigravity.confluenceSkillFile, 'SKILL.md');
});

test('antigravity: skillDir and confluenceSkillDir are sibling directories', () => {
  const skillDir = TOOL_CONFIGS.antigravity.skillDir(ROOT);
  const confluenceDir = TOOL_CONFIGS.antigravity.confluenceSkillDir(ROOT);
  assert.equal(path.dirname(skillDir), path.dirname(confluenceDir));
});

// ── Cross-tool consistency ────────────────────────────────────────────────────

test('all tools have confluenceSkillDir and confluenceSkillFile', () => {
  for (const [key, config] of Object.entries(TOOL_CONFIGS)) {
    assert.ok(typeof config.confluenceSkillDir === 'function', `${key}: confluenceSkillDir must be a function`);
    assert.ok(typeof config.confluenceSkillFile === 'string', `${key}: confluenceSkillFile must be a string`);
    assert.ok(config.confluenceSkillFile.length > 0, `${key}: confluenceSkillFile must not be empty`);
  }
});

test('all tools: confluenceSkillDir path contains read-confluence-docs', () => {
  for (const [key, config] of Object.entries(TOOL_CONFIGS)) {
    const dir = config.confluenceSkillDir(ROOT);
    assert.ok(dir.includes('read-confluence-docs'), `${key}: confluenceSkillDir must include read-confluence-docs`);
  }
});
