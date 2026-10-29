# @swig-wallet/mcp-server

MCP (Model Context Protocol) server that gives AI agents the ability to create and manage [Swig](https://swig.so) smart wallets on Solana. Runs locally over stdio or remotely over Streamable HTTP.

## Quick start

### Local (stdio)

```bash
# From the swig-ts monorepo
bunx nx build @swig-wallet/mcp-server

# Add to Claude Code
claude mcp add swig-wallet -- node packages/mcp-server/dist/index.js
```

### Remote (HTTP)

```bash
node packages/mcp-server/dist/index.js --http --port 3001 --api-key YOUR_SECRET

# Add to Claude Code
claude mcp add swig-wallet --transport http https://your-host.com/mcp
```

## Installation

The server is part of the `swig-ts` monorepo. Build it with:

```bash
bun install
bun run build   # builds all workspace packages
```

Or rebuild the MCP server after its workspace dependencies are built:

```bash
cd packages/mcp-server
bun run build
```

The compiled output is a single file at `dist/index.js`.

## Transport modes

### stdio (default)

The server reads JSON-RPC messages from stdin and writes to stdout. This is the standard way local MCP servers work — the AI agent spawns the process as a subprocess.

```bash
node dist/index.js
```

**Agent configuration examples:**

Claude Code (`claude mcp add`):

```bash
claude mcp add swig-wallet -- node /path/to/dist/index.js
```

Cursor / VS Code / generic MCP client (`settings.json` or equivalent):

```json
{
  "mcpServers": {
    "swig-wallet": {
      "command": "node",
      "args": ["/path/to/swig-ts/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### Streamable HTTP (`--http`)

Starts an HTTP server that implements [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http). Current clients use independent POST requests; older MCP clients can still connect. The wallet configuration and agent keypair belong to the server process, so run one server per trusted operator.

```bash
node dist/index.js --http
```

**Endpoints:**

| Path      | Methods | Description                 |
| --------- | ------- | --------------------------- |
| `/mcp`    | POST    | MCP endpoint (current spec) |
| `/health` | GET     | JSON health check           |

**Agent configuration examples:**

Claude Code:

```bash
claude mcp add swig-wallet --transport http https://your-host.com/mcp
```

Cursor:

> Settings > MCP Servers > Add a server > URL: `https://your-host.com/mcp`

Current MCP clients negotiate the protocol using `server/discover`. Older clients use `initialize`.

## CLI options

```
swig-mcp-server              Start in stdio mode (default)
swig-mcp-server --http       Start as Streamable HTTP server
```

| Flag                     | Default     | Description                                                     |
| ------------------------ | ----------- | --------------------------------------------------------------- |
| `--http`                 | off         | Enable HTTP mode instead of stdio                               |
| `--port <n>`             | `3001`      | HTTP listen port                                                |
| `--host <addr>`          | `127.0.0.1` | HTTP bind address                                               |
| `--api-key <key>`        | none        | Require `Authorization: Bearer <key>`; required beyond loopback |
| `--cors-origin <origin>` | none        | Exact browser origin allowed to call the server                 |
| `--help`, `-h`           |             | Print help and exit                                             |

### Environment variables

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `PORT`                 | HTTP port (overridden by `--port`)                |
| `SWIG_MCP_API_KEY`     | Bearer token for auth (overridden by `--api-key`) |
| `SWIG_MCP_CORS_ORIGIN` | Browser origin allowed to call the server         |

## Tools

The server exposes 18 tools grouped into three categories.

### Configuration

These tools set up the server's runtime state. Call `configure_rpc` first.

| Tool                      | Description                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `configure_rpc`           | Set the Solana RPC endpoint and commitment level                                                                          |
| `configure_paymaster`     | Provide Swig Paymaster API credentials from [dashboard.onswig.com](https://dashboard.onswig.com) for gasless transactions |
| `configure_gas_sponsor`   | Provide a custom gas sponsorship server URL                                                                               |
| `generate_agent_keypair`  | Generate a new Ed25519 keypair for the agent (optionally save to file)                                                    |
| `configure_agent_keypair` | Load an existing keypair from a JSON file or base58 secret key                                                            |
| `get_balance`             | Check the SOL balance of any address                                                                                      |

### Wallet management

| Tool                               | Description                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `create_swig_wallet`               | Create a new Swig smart wallet on-chain with a root authority and permissions                               |
| `fetch_swig_wallet`                | Fetch a Swig wallet's details — account version, wallet address, and all roles/authorities                  |
| `add_authority`                    | Add a new authority to a wallet with specific permissions (Ed25519, Secp256k1, Secp256r1, or session-based) |
| `remove_authority`                 | Remove an authority by role ID                                                                              |
| `update_authority`                 | Update an authority's permissions (replace all, add actions, remove by type, or remove by index)            |
| `replace_ed25519_authority`        | Replace one Ed25519 role signer while preserving its permissions                                            |
| `set_rent_claimer`                 | Set the immutable rent claimer on a V2 wallet                                                               |
| `create_v2_sub_account`            | Create a V2 sub-account with the next on-chain ID                                                           |
| `toggle_v2_sub_account`            | Enable or disable one V2 sub-account                                                                        |
| `withdraw_sol_from_v2_sub_account` | Withdraw SOL from a V2 sub-account into its parent wallet                                                   |

For `add_authority`, the `newAuthorityPubkey` format depends on `authorityType`: use Base58 for `ed25519` and `ed25519Session`, a hex-encoded SEC1 public key for `secp256k1`, and a compressed hex-encoded P-256 public key for `secp256r1`.

### Transactions

| Tool                    | Description                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `transact_sol_transfer` | Transfer SOL from the Swig wallet to a recipient                                     |
| `transact_custom`       | Execute any arbitrary instruction through the Swig wallet (the wallet is the signer) |

## Gas / fee handling

The server supports three strategies for paying transaction fees. Configure one before sending transactions.

### 1. Swig Paymaster (gasless)

The [Swig Paymaster](https://dashboard.onswig.com) covers fees. Call `configure_paymaster` with your API key and paymaster public key.

### 2. Custom gas sponsor

Your own server signs and sponsors transactions. Call `configure_gas_sponsor` with the server URL. The server will POST a base64-encoded transaction to `<url>/sponsor` and expect a JSON response with `{ "signature": "..." }`.

### 3. Self-funded

The agent pays fees from its own SOL balance. Call `generate_agent_keypair` or `configure_agent_keypair` to set up the keypair, then fund the address with SOL.

## Permissions reference

When calling `create_swig_wallet`, `add_authority`, or `update_authority`, pass a `permissions` array where each object has a `type` field:

| Type                    | Additional fields                   | Description                                    |
| ----------------------- | ----------------------------------- | ---------------------------------------------- |
| `all`                   | —                                   | Full root permissions                          |
| `manageAuthority`       | —                                   | Can add/remove/update authorities              |
| `allButManageAuthority` | —                                   | Everything except authority management         |
| `closeSwigAuthority`    | —                                   | Can close the Swig account                     |
| `replaceAuthority`      | `roleId` (u32 number)               | Can replace only the specified role's signer   |
| `subAccountV2Create`    | —                                   | Can create a V2 sub-account                    |
| `subAccountV2All`       | `subAccountId` (u32 number)         | All runtime operations on one V2 sub-account   |
| `subAccountV2Sign`      | `subAccountId` (u32 number)         | Sign as one V2 sub-account                     |
| `subAccountV2Withdraw`  | `subAccountId` (u32 number)         | Withdraw from one V2 sub-account               |
| `subAccountV2Toggle`    | `subAccountId` (u32 number)         | Toggle one V2 sub-account                      |
| `solLimit`              | `amount`                            | One-time SOL spend limit (lamports, as string) |
| `solRecurringLimit`     | `recurringAmount`, `window`         | Recurring SOL limit                            |
| `solDestinationLimit`   | `amount`, `destination`             | SOL limit to a specific recipient              |
| `tokenLimit`            | `mint`, `amount`                    | One-time token spend limit                     |
| `tokenRecurringLimit`   | `mint`, `recurringAmount`, `window` | Recurring token limit                          |
| `programLimit`          | `programId`                         | Access to a specific program                   |
| `programAll`            | —                                   | Access to any program                          |
| `programCurated`        | —                                   | Access to curated programs                     |
| `subAccount`            | —                                   | Sub-account management                         |
| `stakeAll`              | —                                   | Full staking permissions                       |
| `stakeLimit`            | `amount`                            | Staking with amount limit                      |

Example:

```json
[
  { "type": "solLimit", "amount": "500000000" },
  {
    "type": "programLimit",
    "programId": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
  }
]
```

`rentDestination` was removed from the Swig protocol. Rent routing uses `set_rent_claimer` on V2 wallets.

The MCP currently exposes the existing wallet operations plus Ed25519 signer replacement, rent claimer setup, and V2 sub-account creation, toggle, and SOL withdrawal. V2 sub-account signing, token withdrawal, and reserved wallet creation are not yet MCP tools, though their permission types can be encoded and decoded.

## Deployment

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY packages/mcp-server/dist/index.js .
COPY node_modules/ ./node_modules/
ENV PORT=3001
ENV SWIG_MCP_API_KEY=changeme
EXPOSE 3001
CMD ["node", "index.js", "--http"]
```

### Railway / Render / Fly.io

Set the start command to:

```bash
node packages/mcp-server/dist/index.js --http
```

Set environment variables `PORT` and `SWIG_MCP_API_KEY`.

### Production checklist

- Always use `--api-key` or `SWIG_MCP_API_KEY` to require authentication
- Serve behind a reverse proxy (nginx, Caddy) with TLS termination
- Set `--cors-origin` to the exact browser origin if browser access is needed
- Use a dedicated RPC endpoint (Helius, Triton, QuickNode) rather than the public Solana RPC

## Architecture

```
Agent (Claude Code, Cursor, etc.)
  │
  ├── stdio ──────── swig-mcp-server (local process)
  │
  └── HTTP POST ──── swig-mcp-server --http (remote)
                       │
                       ├── /mcp     → Streamable HTTP transport (per request)
                       └── /health  → health check
```

The server uses `@swig-wallet/classic` (web3.js v1.x) internally. All Swig SDK operations — wallet creation, authority management, transaction signing — are handled through the `@swig-wallet/classic` and `@swig-wallet/paymaster-classic` packages.

## License

Apache-2.0
