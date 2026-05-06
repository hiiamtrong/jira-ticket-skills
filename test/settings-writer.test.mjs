import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  installSettings,
  uninstallSettings,
} from '../src/writers/settings-writer.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-settings-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const baseConfig = {
  projectKey: 'PRJ',
  trelloEnabled: false,
};

test('installSettings(claude): writes TRELLO_BOARD_ID when trelloEnabled=true', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'board-abc',
    });
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.equal(settings.env.JIRA_PROJECT_KEY, 'PRJ');
    assert.equal(settings.env.TRELLO_BOARD_ID, 'board-abc');
  } finally {
    cleanup(root);
  }
});

test('installSettings(claude): does not write TRELLO_BOARD_ID when trelloEnabled=false', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', baseConfig);
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.equal(settings.env.JIRA_PROJECT_KEY, 'PRJ');
    assert.ok(
      !('TRELLO_BOARD_ID' in settings.env),
      'TRELLO_BOARD_ID must not be set',
    );
  } finally {
    cleanup(root);
  }
});

test('installSettings(cursor): writes Trello block to rules file when enabled', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'cursor', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'board-xyz',
    });
    const rules = fs.readFileSync(
      path.join(root, '.cursor', 'rules', 'jira-config.mdc'),
      'utf-8',
    );
    assert.match(rules, /TRELLO_BOARD_ID/);
    assert.match(rules, /board-xyz/);
  } finally {
    cleanup(root);
  }
});

test('installSettings(cursor): no Trello block when disabled', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'cursor', baseConfig);
    const rules = fs.readFileSync(
      path.join(root, '.cursor', 'rules', 'jira-config.mdc'),
      'utf-8',
    );
    assert.doesNotMatch(rules, /TRELLO_BOARD_ID/);
  } finally {
    cleanup(root);
  }
});

test('uninstallSettings(claude): removes TRELLO_BOARD_ID along with JIRA_PROJECT_KEY', () => {
  const root = makeTempDir();
  try {
    installSettings(root, 'claude', {
      ...baseConfig,
      trelloEnabled: true,
      trelloBoardId: 'b',
    });
    uninstallSettings(root, 'claude');
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    assert.ok(
      !('JIRA_PROJECT_KEY' in (settings.env || {})),
      'JIRA_PROJECT_KEY must be removed',
    );
    assert.ok(
      !('TRELLO_BOARD_ID' in (settings.env || {})),
      'TRELLO_BOARD_ID must be removed',
    );
  } finally {
    cleanup(root);
  }
});
