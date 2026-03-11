import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installMcp, uninstallMcp } from '../src/writers/mcp-writer.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-mcp-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readMcp(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'));
}

// Base config without Confluence
const baseConfig = {
  jiraUrl: 'https://jira.example.com',
  jiraToken: 'jira-token-123',
  jiraAuthMethod: 'personal_token',
  jiraRunner: 'uvx',
  figmaBridge: false,
  confluenceEnabled: false,
};

// ── Confluence: install with api_token ────────────────────────────────────────

test('installMcp(claude): adds confluence server when confluenceEnabled=true (api_token)', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'conf-token-abc',
      confluenceAuthMethod: 'api_token',
      confluenceEmail: 'user@example.com',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    const servers = mcp.mcpServers;

    assert.ok(servers.confluence, 'confluence server must be present');
    assert.equal(servers.confluence.command, 'uvx');
    assert.deepEqual(servers.confluence.args, ['mcp-atlassian']);
    assert.equal(servers.confluence.env.CONFLUENCE_URL, 'https://confluence.example.com');
    assert.equal(servers.confluence.env.CONFLUENCE_API_TOKEN, 'conf-token-abc');
    assert.equal(servers.confluence.env.CONFLUENCE_USERNAME, 'user@example.com');
    assert.ok(!servers.confluence.env.CONFLUENCE_PERSONAL_TOKEN, 'should not set personal token for api_token auth');
  } finally {
    cleanup(root);
  }
});

// ── Confluence: install with personal_token ───────────────────────────────────

test('installMcp(claude): adds confluence server with personal_token auth', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'personal-token-xyz',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    const servers = mcp.mcpServers;

    assert.ok(servers.confluence, 'confluence server must be present');
    assert.equal(servers.confluence.env.CONFLUENCE_PERSONAL_TOKEN, 'personal-token-xyz');
    assert.ok(!servers.confluence.env.CONFLUENCE_API_TOKEN, 'should not set api token for personal_token auth');
    assert.ok(!servers.confluence.env.CONFLUENCE_USERNAME, 'should not set username for personal_token auth');
  } finally {
    cleanup(root);
  }
});

// ── Confluence: uv runner ─────────────────────────────────────────────────────

test('installMcp(claude): uses uv tool run when jiraRunner=uv', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      jiraRunner: 'uv',
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'token',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    const conf = mcp.mcpServers.confluence;

    assert.equal(conf.command, 'uv');
    assert.deepEqual(conf.args, ['tool', 'run', 'mcp-atlassian']);
  } finally {
    cleanup(root);
  }
});

// ── Confluence: disabled ──────────────────────────────────────────────────────

test('installMcp(claude): no confluence server when confluenceEnabled=false', () => {
  const root = makeTempDir();
  try {
    installMcp(root, 'claude', baseConfig);
    const mcp = readMcp(root);
    assert.ok(!mcp.mcpServers.confluence, 'confluence server must not be added when disabled');
  } finally {
    cleanup(root);
  }
});

// ── Jira server still present alongside Confluence ────────────────────────────

test('installMcp(claude): jira server coexists with confluence server', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'token',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'claude', config);
    const mcp = readMcp(root);
    assert.ok(mcp.mcpServers.jira, 'jira server must still be present');
    assert.ok(mcp.mcpServers.confluence, 'confluence server must be present');
  } finally {
    cleanup(root);
  }
});

// ── Uninstall: removes confluence ─────────────────────────────────────────────

test('uninstallMcp(claude): removes confluence server', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'token',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'claude', config);
    uninstallMcp(root, 'claude');
    const mcp = readMcp(root);
    assert.ok(!mcp.mcpServers.confluence, 'confluence server must be removed');
  } finally {
    cleanup(root);
  }
});

test('uninstallMcp(claude): removes jira and confluence together', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'token',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'claude', config);
    uninstallMcp(root, 'claude');
    const mcp = readMcp(root);
    assert.ok(!mcp.mcpServers.jira, 'jira server must be removed');
    assert.ok(!mcp.mcpServers.confluence, 'confluence server must be removed');
  } finally {
    cleanup(root);
  }
});

test('uninstallMcp: does not fail when no mcp.json exists', () => {
  const root = makeTempDir();
  try {
    assert.doesNotThrow(() => uninstallMcp(root, 'claude'));
  } finally {
    cleanup(root);
  }
});

// ── Cursor tool writes to .cursor/mcp.json ────────────────────────────────────

test('installMcp(cursor): writes to .cursor/mcp.json', () => {
  const root = makeTempDir();
  try {
    const config = {
      ...baseConfig,
      confluenceEnabled: true,
      confluenceUrl: 'https://confluence.example.com',
      confluenceToken: 'token',
      confluenceAuthMethod: 'personal_token',
    };
    installMcp(root, 'cursor', config);
    const cursorMcpPath = path.join(root, '.cursor', 'mcp.json');
    assert.ok(fs.existsSync(cursorMcpPath), '.cursor/mcp.json must exist');
    const mcp = JSON.parse(fs.readFileSync(cursorMcpPath, 'utf-8'));
    assert.ok(mcp.mcpServers.confluence, 'confluence must be in cursor mcp config');
  } finally {
    cleanup(root);
  }
});
