import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  installTrelloSkill,
  uninstallTrelloSkill,
} from '../src/writers/skill-writer.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-trello-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('installTrelloSkill(claude): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    const expected = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(fs.existsSync(expected), `Expected file: ${expected}`);
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill(cursor): creates SKILL.md at correct path', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'cursor');
    const expected = path.join(
      root,
      '.cursor',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill(antigravity): creates SKILL.md and workflow.md', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'antigravity');
    const skill = path.join(
      root,
      '.agent',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const workflow = path.join(
      root,
      '.agent',
      'workflows',
      'resolve-trello-ticket.md',
    );
    assert.ok(fs.existsSync(skill), `Expected file: ${skill}`);
    assert.ok(fs.existsSync(workflow), `Expected file: ${workflow}`);
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill: file content matches template SKILL.md', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    const installed = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const templatePath = new URL(
      '../templates/resolve-trello-ticket/SKILL.md',
      import.meta.url,
    ).pathname;
    assert.equal(
      fs.readFileSync(installed, 'utf-8'),
      fs.readFileSync(templatePath, 'utf-8'),
    );
  } finally {
    cleanup(root);
  }
});

test('installTrelloSkill: throws on unknown tool', () => {
  assert.throws(() => installTrelloSkill('/tmp', 'unknown'), /Unknown tool/);
});

test('uninstallTrelloSkill(claude): removes installed file', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'claude');
    uninstallTrelloSkill(root, 'claude');
    const expected = path.join(
      root,
      '.claude',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    assert.ok(!fs.existsSync(expected));
  } finally {
    cleanup(root);
  }
});

test('uninstallTrelloSkill(antigravity): removes both skill and workflow', () => {
  const root = makeTempDir();
  try {
    installTrelloSkill(root, 'antigravity');
    uninstallTrelloSkill(root, 'antigravity');
    const skill = path.join(
      root,
      '.agent',
      'skills',
      'resolve-trello-ticket',
      'SKILL.md',
    );
    const workflow = path.join(
      root,
      '.agent',
      'workflows',
      'resolve-trello-ticket.md',
    );
    assert.ok(!fs.existsSync(skill));
    assert.ok(!fs.existsSync(workflow));
  } finally {
    cleanup(root);
  }
});

test('uninstallTrelloSkill: idempotent when nothing installed', () => {
  const root = makeTempDir();
  try {
    assert.doesNotThrow(() => uninstallTrelloSkill(root, 'claude'));
  } finally {
    cleanup(root);
  }
});
