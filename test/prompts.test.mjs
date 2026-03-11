import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runNonInteractive } from '../src/prompts.mjs';

// Snapshot env vars before each test and restore after
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  // Restore to original state
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, savedEnv);
});

// Helper to set required Jira env vars
function setJiraEnv(overrides = {}) {
  process.env.JIRA_URL = 'https://jira.example.com';
  process.env.JIRA_TOKEN = 'jira-token-123';
  process.env.JIRA_PROJECT_KEY = 'PRJ';
  Object.assign(process.env, overrides);
}

// ── Confluence disabled (no env vars) ────────────────────────────────────────

test('runNonInteractive: confluenceEnabled=false when CONFLUENCE_URL not set', () => {
  setJiraEnv();
  delete process.env.CONFLUENCE_URL;
  delete process.env.CONFLUENCE_TOKEN;
  delete process.env.CONFLUENCE_EMAIL;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceEnabled, false);
  assert.ok(!config.confluenceUrl);
  assert.ok(!config.confluenceToken);
});

test('runNonInteractive: confluenceEnabled=false when only CONFLUENCE_URL set (no token)', () => {
  setJiraEnv({ CONFLUENCE_URL: 'https://confluence.example.com' });
  delete process.env.CONFLUENCE_TOKEN;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceEnabled, false);
});

test('runNonInteractive: confluenceEnabled=false when only CONFLUENCE_TOKEN set (no url)', () => {
  setJiraEnv({ CONFLUENCE_TOKEN: 'conf-token' });
  delete process.env.CONFLUENCE_URL;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceEnabled, false);
});

// ── Confluence enabled: personal_token ───────────────────────────────────────

test('runNonInteractive: confluenceEnabled=true when URL + token set', () => {
  setJiraEnv({
    CONFLUENCE_URL: 'https://confluence.example.com',
    CONFLUENCE_TOKEN: 'conf-token-xyz',
  });
  delete process.env.CONFLUENCE_EMAIL;

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceEnabled, true);
  assert.equal(config.confluenceUrl, 'https://confluence.example.com');
  assert.equal(config.confluenceToken, 'conf-token-xyz');
  assert.equal(config.confluenceAuthMethod, 'personal_token');
  assert.ok(!config.confluenceEmail);
});

// ── Confluence enabled: api_token ─────────────────────────────────────────────

test('runNonInteractive: confluenceAuthMethod=api_token when CONFLUENCE_EMAIL set', () => {
  setJiraEnv({
    CONFLUENCE_URL: 'https://confluence.example.com',
    CONFLUENCE_TOKEN: 'conf-api-token',
    CONFLUENCE_EMAIL: 'user@example.com',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceEnabled, true);
  assert.equal(config.confluenceAuthMethod, 'api_token');
  assert.equal(config.confluenceEmail, 'user@example.com');
});

// ── URL normalization ─────────────────────────────────────────────────────────

test('runNonInteractive: prepends https:// to confluenceUrl if missing', () => {
  setJiraEnv({
    CONFLUENCE_URL: 'confluence.example.com',
    CONFLUENCE_TOKEN: 'token',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceUrl, 'https://confluence.example.com');
});

test('runNonInteractive: preserves https:// in confluenceUrl', () => {
  setJiraEnv({
    CONFLUENCE_URL: 'https://confluence.example.com',
    CONFLUENCE_TOKEN: 'token',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceUrl, 'https://confluence.example.com');
});

// ── Required Jira fields still work ──────────────────────────────────────────

test('runNonInteractive: throws when JIRA_URL missing', () => {
  setJiraEnv();
  delete process.env.JIRA_URL;
  assert.throws(() => runNonInteractive({ tool: 'claude', noFigma: true }), /JIRA_URL/);
});

test('runNonInteractive: throws when JIRA_TOKEN missing', () => {
  setJiraEnv();
  delete process.env.JIRA_TOKEN;
  assert.throws(() => runNonInteractive({ tool: 'claude', noFigma: true }), /JIRA_TOKEN/);
});

test('runNonInteractive: throws when JIRA_PROJECT_KEY missing', () => {
  setJiraEnv();
  delete process.env.JIRA_PROJECT_KEY;
  assert.throws(() => runNonInteractive({ tool: 'claude', noFigma: true }), /JIRA_PROJECT_KEY/);
});

// ── Whitespace trimming ───────────────────────────────────────────────────────

test('runNonInteractive: trims whitespace from CONFLUENCE_URL', () => {
  setJiraEnv({
    CONFLUENCE_URL: '  https://confluence.example.com  ',
    CONFLUENCE_TOKEN: 'token',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceUrl, 'https://confluence.example.com');
});

test('runNonInteractive: trims whitespace from CONFLUENCE_TOKEN', () => {
  setJiraEnv({
    CONFLUENCE_URL: 'https://confluence.example.com',
    CONFLUENCE_TOKEN: '  my-token  ',
  });

  const config = runNonInteractive({ tool: 'claude', noFigma: true });
  assert.equal(config.confluenceToken, 'my-token');
});
