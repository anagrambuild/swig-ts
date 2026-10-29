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

The server exposes 28 tools grouped into three categories.

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

| Tool                                 | Description                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `create_swig_wallet`                 | Create a new Swig smart wallet on-chain with a root authority and permissions                               |
| `reserve_wallet_address`             | Derive a deterministic reserved V2 wallet address and activation package off-chain                          |
| `activate_reserved_wallet`           | Activate a reserved wallet after its address is funded                                                      |
| `fetch_swig_wallet`                  | Fetch a Swig wallet's details — account version, wallet address, and all roles/authorities                  |
| `add_authority`                      | Add a new authority to a wallet with specific permissions (Ed25519, Secp256k1, Secp256r1, or session-based) |
| `remove_authority`                   | Remove an authority by role ID                                                                              |
| `update_authority`                   | Update an authority's permissions (replace all, add actions, remove by type, or remove by index)            |
| `replace_ed25519_authority`          | Replace one Ed25519 role signer while preserving its permissions                                            |
| `set_rent_claimer`                   | Set the immutable rent claimer on a V2 wallet                                                               |
| `create_v2_sub_account`              | Create a V2 sub-account with the next on-chain ID                                                           |
| `fetch_v2_sub_account`               | Fetch V2 state, asset address, and enabled status                                                           |
| `toggle_v2_sub_account`              | Enable or disable one V2 sub-account                                                                        |
| `withdraw_sol_from_v2_sub_account`   | Withdraw SOL from a V2 sub-account into its parent wallet                                                   |
| `withdraw_token_from_v2_sub_account` | Withdraw SPL Token or Token-2022 assets from a V2 sub-account into a parent wallet token account            |
| `close_v1_sub_account`               | Close a disabled V1 sub-account and return its SOL to the parent wallet                                     |
| `close_v2_sub_account`               | Close a disabled V2 sub-account and return its SOL to the parent wallet                                     |
| `close_swig_token_accounts`          | Close empty token accounts owned by a Swig wallet                                                           |
| `close_swig_wallet`                  | Close an empty Swig wallet and send rent to its configured rent claimer                                     |

For `add_authority`, the `newAuthorityPubkey` format depends on `authorityType`: use Base58 for `ed25519` and `ed25519Session`, a hex-encoded SEC1 public key for `secp256k1`, and a compressed hex-encoded P-256 public key for `secp256r1`.

### Transactions

| Tool                               | Description                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `transact_sol_transfer`            | Transfer SOL from the Swig wallet to a recipient                                     |
| `transact_custom`                  | Execute any arbitrary instruction through the Swig wallet (the wallet is the signer) |
| `transfer_sol_from_v2_sub_account` | Transfer SOL from a V2 sub-account to a recipient through V2 signing                 |
| `transact_v2_sub_account`          | Execute one or more instructions with a V2 sub-account asset PDA as signer           |

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

Fund a new rent-claimer address to Solana's rent-exempt minimum before reducing or removing authorities: a small rent refund alone may not be enough to create that destination account.

The V2 sub-account tools cover the current create, toggle, sign, withdraw, and close instructions. A scoped role can use `subAccountV2Sign`, `subAccountV2Withdraw`, or `subAccountV2Toggle` for a single sub-account. `transact_v2_sub_account` accepts an array of instructions and uses the V2 asset PDA as the inner signer. Disable a sub-account before closing it, then drain any excess SOL and token balances before closing the parent wallet. If a rent claimer is configured, close tools use that address as the rent destination.

Wallet and sub-account close tools reject any remaining SPL Token or Token-2022 accounts, including empty accounts, before submitting a transaction. Close those accounts first. Also unwind protocol positions before closure: the token-account check cannot discover arbitrary third-party positions, and closing the signing PDA is irreversible.

`reserve_wallet_address` accepts an Ed25519 base58 public key or a compressed secp256k1/secp256r1 public key in hex, and returns an activation package. `activate_reserved_wallet` submits that package on-chain. The payer needs enough SOL for rent and transaction fees; the package's authority does not need to sign activation.

### Local Surfpool verification

After building the MCP server, run the optional on-chain smoke test against a loopback Surfpool instance. It exercises reserved-wallet activation, scoped V2 permissions, signing, SOL and token withdrawals, and close flows. The script refuses a non-loopback or non-Surfpool RPC.

```bash
SWIG_SURFPOOL_RPC_URL=http://127.0.0.1:18899 \
  SWIG_PROGRAM_SO=/path/to/swig.so \
  bun run --cwd packages/mcp-server test:surfpool
```

`SWIG_PROGRAM_SO` is optional when the desired Swig program is already loaded into Surfpool.

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
