import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const executable = fileURLToPath(new URL('../dist/index.js', import.meta.url));

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Authorization: 'Bearer smoke-key' },
      });
      if (response.ok) return;
    } catch {
      /* server still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('HTTP MCP server did not start');
}

describe('wallet MCP transports', () => {
  let process: ChildProcess;
  let port: number;

  beforeAll(async () => {
    port = await freePort();
    process = spawn(
      'node',
      [executable, '--http', '--port', String(port), '--api-key', 'smoke-key'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    await waitForHealth(port);
  });

  afterAll(() => process?.kill());

  test('stdio negotiates the 2026-07-28 protocol and lists wallet tools', async () => {
    const client = new Client(
      { name: 'wallet-mcp-test', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    try {
      await client.connect(
        new StdioClientTransport({ command: 'node', args: [executable] }),
      );
      expect(client.getProtocolEra()).toBe('modern');
      expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain(
        'set_rent_claimer',
      );
      expect(tools.tools.map((tool) => tool.name)).toContain(
        'replace_ed25519_authority',
      );
      expect(tools.tools.map((tool) => tool.name)).toContain(
        'create_v2_sub_account',
      );
      expect(tools.tools.map((tool) => tool.name)).toContain(
        'toggle_v2_sub_account',
      );
      expect(tools.tools.map((tool) => tool.name)).toContain(
        'withdraw_sol_from_v2_sub_account',
      );
      for (const name of [
        'fetch_v2_sub_account',
        'transact_v2_sub_account',
        'transfer_sol_from_v2_sub_account',
        'withdraw_token_from_v2_sub_account',
        'close_v1_sub_account',
        'close_v2_sub_account',
        'close_swig_wallet',
        'close_swig_token_accounts',
        'reserve_wallet_address',
        'activate_reserved_wallet',
      ]) {
        expect(tools.tools.map((tool) => tool.name)).toContain(name);
      }
    } finally {
      await client.close();
    }
  }, 15_000);

  test('generated agent secrets are private and never overwrite an existing file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swig-mcp-test-'));
    const secretPath = join(directory, 'agent.json');
    const client = new Client({ name: 'wallet-mcp-test', version: '1.0.0' });
    try {
      await client.connect(
        new StdioClientTransport({ command: 'node', args: [executable] }),
      );
      const first = await client.callTool({
        name: 'generate_agent_keypair',
        arguments: { saveToFile: secretPath },
      });
      expect(first.isError).not.toBe(true);
      expect(JSON.parse(await readFile(secretPath, 'utf8'))).toHaveLength(64);
      expect((await stat(secretPath)).mode & 0o777).toBe(0o600);
      const second = await client.callTool({
        name: 'generate_agent_keypair',
        arguments: { saveToFile: secretPath },
      });
      expect(second.isError).toBe(true);
    } finally {
      await client.close();
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);

  test('HTTP supports modern and legacy clients', async () => {
    for (const mode of [{ pin: '2026-07-28' }, 'legacy'] as const) {
      const client = new Client(
        { name: 'wallet-mcp-test', version: '1.0.0' },
        { versionNegotiation: { mode } },
      );
      try {
        await client.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${port}/mcp`),
            { requestInit: { headers: { Authorization: 'Bearer smoke-key' } } },
          ),
        );
        expect(client.getProtocolEra()).toBe(
          typeof mode === 'string' ? 'legacy' : 'modern',
        );
        expect((await client.listTools()).tools.length).toBe(28);
      } finally {
        await client.close();
      }
    }
  }, 15_000);

  test('HTTP wallet configuration carries across stateless MCP requests', async () => {
    const rpc = createHttpServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString()) as {
        id: number;
        method: string;
      };
      const result =
        body.method === 'getVersion'
          ? { 'solana-core': '2.0.0', 'feature-set': 1 }
          : { context: { slot: 1 }, value: 1_000_000_000 };
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    });
    await new Promise<void>((resolve) => rpc.listen(0, '127.0.0.1', resolve));
    const address = rpc.address();
    if (!address || typeof address === 'string')
      throw new Error('No mock RPC port');

    const client = new Client(
      { name: 'wallet-mcp-test', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    try {
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${port}/mcp`),
          { requestInit: { headers: { Authorization: 'Bearer smoke-key' } } },
        ),
      );
      const configure = await client.callTool({
        name: 'configure_rpc',
        arguments: {
          rpcUrl: `http://127.0.0.1:${address.port}`,
          commitment: 'confirmed',
        },
      });
      expect(configure.isError).not.toBe(true);
      const balance = await client.callTool({
        name: 'get_balance',
        arguments: { address: '11111111111111111111111111111111' },
      });
      expect(balance.isError).not.toBe(true);
      expect(balance.content).toEqual([
        { type: 'text', text: expect.stringContaining('1 SOL') },
      ]);
    } finally {
      await client.close();
      await new Promise<void>((resolve) => rpc.close(() => resolve()));
    }
  }, 15_000);

  test('HTTP rejects unauthenticated and unapproved browser requests', async () => {
    const endpoint = `http://127.0.0.1:${port}/mcp`;
    const unauthorized = await fetch(endpoint, { method: 'POST' });
    expect(unauthorized.status).toBe(401);
    const wrongOrigin = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer smoke-key',
        Origin: 'https://other.example',
      },
    });
    expect(wrongOrigin.status).toBe(403);
    const wrongHost = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer smoke-key', Host: 'evil.example' },
    });
    expect(wrongHost.status).toBe(403);
  });

  test('HTTP accepts only the configured browser origin', async () => {
    const browserPort = await freePort();
    const browserProcess = spawn(
      'node',
      [
        executable,
        '--http',
        '--port',
        String(browserPort),
        '--api-key',
        'smoke-key',
        '--cors-origin',
        'https://trusted.example',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    try {
      await waitForHealth(browserPort);
      const response = await fetch(`http://127.0.0.1:${browserPort}/mcp`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://trusted.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers':
            'authorization, content-type, mcp-protocol-version, mcp-method, mcp-name',
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://trusted.example',
      );
      const allowed = response.headers
        .get('Access-Control-Allow-Headers')!
        .toLowerCase()
        .split(',')
        .map((header) => header.trim());
      for (const header of [
        'authorization',
        'content-type',
        'mcp-protocol-version',
        'mcp-method',
        'mcp-name',
      ])
        expect(allowed).toContain(header);
      const browserClient = new Client(
        { name: 'browser-mcp-test', version: '1.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      try {
        await browserClient.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${browserPort}/mcp`),
            {
              requestInit: {
                headers: {
                  Authorization: 'Bearer smoke-key',
                  Origin: 'https://trusted.example',
                },
              },
            },
          ),
        );
        expect((await browserClient.listTools()).tools.length).toBe(28);
      } finally {
        await browserClient.close();
      }
      const rejected = await fetch(`http://127.0.0.1:${browserPort}/mcp`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://other.example' },
      });
      expect(rejected.status).toBe(403);
    } finally {
      browserProcess.kill();
    }
  });
});
