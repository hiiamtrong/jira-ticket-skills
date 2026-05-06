import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readExistingConfig } from '../src/writers/settings-writer.mjs';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jts-prefill-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── claude: reads from JSON settings + MCP config ────────────────────────────

test('readExistingConfig claude: returns projectKey from settings.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.claude', 'settings.json'), {
    env: { JIRA_PROJECT_KEY: 'ABC', TRELLO_BOARD_ID: 'board-1' },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.projectKey, 'ABC');
  assert.equal(config.trelloBoardId, 'board-1');
});

test('readExistingConfig claude: reads jiraUrl and jiraAuthMethod from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      jira: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { JIRA_URL: 'https://jira.example.com', JIRA_PERSONAL_TOKEN: 'tok' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.jiraUrl, 'https://jira.example.com');
  assert.equal(config.jiraAuthMethod, 'personal_token');
});

test('readExistingConfig claude: detects api_token auth when JIRA_API_TOKEN present', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      jira: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: {
          JIRA_URL: 'https://jira.example.com',
          JIRA_API_TOKEN: 'api-tok',
          JIRA_USERNAME: 'user@example.com',
        },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.jiraAuthMethod, 'api_token');
  assert.equal(config.jiraEmail, 'user@example.com');
});

test('readExistingConfig claude: reads confluenceUrl and confluenceEnabled from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      jira: { command: 'uvx', args: ['mcp-atlassian'], env: { JIRA_URL: 'https://j.com', JIRA_PERSONAL_TOKEN: 'x' } },
      confluence: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { CONFLUENCE_URL: 'https://confluence.example.com', CONFLUENCE_PERSONAL_TOKEN: 'ctok' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.confluenceEnabled, true);
  assert.equal(config.confluenceUrl, 'https://confluence.example.com');
  assert.equal(config.confluenceAuthMethod, 'personal_token');
});

test('readExistingConfig claude: reads trelloEnabled and trelloBoardId', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.claude', 'settings.json'), {
    env: { TRELLO_BOARD_ID: 'my-board' },
  });
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      trello: {
        command: 'bunx',
        args: ['@delorenj/mcp-server-trello'],
        env: { TRELLO_API_KEY: 'k', TRELLO_TOKEN: 't' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.trelloEnabled, true);
  assert.equal(config.trelloBoardId, 'my-board');
});

test('readExistingConfig claude: returns empty object when no files exist', () => {
  const root = makeTmpDir();
  const config = readExistingConfig(root, 'claude');
  assert.deepEqual(config, {});
});

// ── cursor: reads from rules .mdc file ───────────────────────────────────────

test('readExistingConfig cursor: reads projectKey from rules file', () => {
  const root = makeTmpDir();
  const rulesPath = path.join(root, '.cursor', 'rules', 'jira-config.mdc');
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, `---
description: config
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`MYPRJ\`
`, 'utf-8');
  const config = readExistingConfig(root, 'cursor');
  assert.equal(config.projectKey, 'MYPRJ');
});

test('readExistingConfig cursor: reads trelloBoardId from rules file', () => {
  const root = makeTmpDir();
  const rulesPath = path.join(root, '.cursor', 'rules', 'jira-config.mdc');
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, `---
description: config
---

# Jira Configuration

- **JIRA_PROJECT_KEY**: \`MYPRJ\`

# Trello Configuration

- **TRELLO_BOARD_ID**: \`my-trello-board\`
`, 'utf-8');
  const config = readExistingConfig(root, 'cursor');
  assert.equal(config.trelloBoardId, 'my-trello-board');
  assert.equal(config.trelloEnabled, true);
});

test('readExistingConfig cursor: returns empty object when rules file missing', () => {
  const root = makeTmpDir();
  const config = readExistingConfig(root, 'cursor');
  assert.deepEqual(config, {});
});

// ── token reading from MCP config ─────────────────────────────────────────────

test('readExistingConfig claude: reads jiraToken (personal_token) from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      jira: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { JIRA_URL: 'https://jira.example.com', JIRA_PERSONAL_TOKEN: 'my-secret-token' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.jiraToken, 'my-secret-token');
});

test('readExistingConfig claude: reads jiraToken (api_token) from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      jira: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { JIRA_URL: 'https://jira.example.com', JIRA_API_TOKEN: 'api-tok', JIRA_USERNAME: 'u@e.com' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.jiraToken, 'api-tok');
});

test('readExistingConfig claude: reads confluenceToken from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      confluence: {
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { CONFLUENCE_URL: 'https://conf.example.com', CONFLUENCE_PERSONAL_TOKEN: 'ctok' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.confluenceToken, 'ctok');
});

test('readExistingConfig claude: reads trelloApiKey and trelloToken from .mcp.json', () => {
  const root = makeTmpDir();
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      trello: {
        command: 'bunx',
        args: ['@delorenj/mcp-server-trello'],
        env: { TRELLO_API_KEY: 'my-key', TRELLO_TOKEN: 'my-tok' },
      },
    },
  });
  const config = readExistingConfig(root, 'claude');
  assert.equal(config.trelloApiKey, 'my-key');
  assert.equal(config.trelloToken, 'my-tok');
});
