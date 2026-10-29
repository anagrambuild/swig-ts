---
name: swig-smart-wallet
description: >
  Create and manage Solana smart wallets using the Swig MCP server or the
  Swig TypeScript SDK. This skill enables AI agents to operate Swig wallets
  directly through MCP tools or generate SDK-based code to create wallets,
  manage authorities (add/remove/update with granular permissions), execute
  transactions through the wallet, and handle gas sponsorship via the Swig
  Paymaster API, a custom gas server, or self-funded SOL. Works with both
  @swig-wallet/classic (web3.js 1.x) and @swig-wallet/kit (@solana/kit 2.x).
---

# Swig Smart Wallet Skill

You are an AI agent that can create and manage Solana smart wallets using the Swig protocol. Swig wallets are on-chain programmable wallets with granular authority and permission management.

Choose the execution path that matches the user's request:

- Use `@swig-wallet/mcp-server` when the user wants direct wallet operations through MCP tools and does not need application code.
- Use `@swig-wallet/classic` or `@swig-wallet/kit` when the user wants TypeScript scripts, app integration, or reusable code examples.

Prefer the MCP path for direct operational tasks. Prefer the SDK path when the deliverable is code.

## Getting Started with Swig MCP

Use this path when the user wants the agent to call Swig tools directly instead of generating integration code.

### Step 1: Build the server

```bash
# From the swig-ts monorepo
bun install
bun run build -w @swig-wallet/mcp-server
```

### Step 2: Configure the MCP client

Add the server to the AI agent:

```bash
# Claude Code (local/stdio)
claude mcp add swig-wallet -- node /path/to/packages/mcp-server/dist/index.js

# Claude Code (remote/HTTP)
claude mcp add swig-wallet --transport http https://your-host.com/mcp
```

For remote HTTP deployments, require auth with `--api-key` or `SWIG_MCP_API_KEY` and point clients at the `/mcp` endpoint.

### Step 3: Configure RPC

Call `configure_rpc` first. Common networks:

- Mainnet: `https://api.mainnet-beta.solana.com`
- Devnet: `https://api.devnet.solana.com`

Use a dedicated RPC provider for production workloads.

### Step 4: Set up the agent keypair

Call `generate_agent_keypair` to create a new keypair or `configure_agent_keypair` to load an existing one.

If you are using the self-funded path, fund this address with SOL. It pays transaction fees and the rent needed for Swig wallet creation.

If you want sponsored transactions, also configure one of these before creating or using wallets:

- `configure_paymaster`
- `configure_gas_sponsor`

### Step 5: Create a Swig wallet

Call `create_swig_wallet`. This creates:

- A **Swig account**: the on-chain config holding roles and authorities
- A **wallet address**: the PDA that holds funds

Unless the user asks for something else, treat the configured agent keypair as the root authority with full permissions.

### Step 6: Use the wallet

- `fetch_swig_wallet` to inspect wallet details and authorities
- `get_balance` to check SOL balance for the wallet or agent
- `transact_sol_transfer` to send SOL from the wallet
- `transact_custom` to execute arbitrary instructions through the wallet
- `add_authority`, `remove_authority`, and `update_authority` to manage permissions

For `add_authority`, the `newAuthorityPubkey` format depends on `authorityType`: use Base58 for `ed25519` and `ed25519Session`, a hex-encoded SEC1 public key for `secp256k1`, and a compressed hex-encoded P-256 public key for `secp256r1`.

## Shared Prerequisites

Before performing wallet operations in either MCP or SDK mode, you MUST gather the following from the user unless it is already provided:

### 1. Solana RPC Endpoint

Ask the user: "What Solana RPC endpoint should I use for transactions?"

Acceptable answers:

- A specific URL (e.g. `https://api.mainnet-beta.solana.com`, `https://api.devnet.solana.com`, or a custom RPC like Helius, Triton, etc.)
- "devnet" — use `https://api.devnet.solana.com`
- "mainnet" — use `https://api.mainnet-beta.solana.com`
- "localnet" or "localhost" — use `http://localhost:8899`

If the user does not know, suggest they use devnet for testing: `https://api.devnet.solana.com`

Store the RPC URL in an environment variable `SOLANA_RPC_URL` or in a `.env` file.

### 2. Gas / Fee Sponsorship

Ask the user: "How would you like transaction fees to be handled?"

Present these three options:

**Option A — Swig Paymaster (recommended for production)**
The Swig Paymaster API covers transaction fees. Ask the user to provide:

- Their **API Key** from `dashboard.onswig.com`
- Their **Paymaster Public Key** from `dashboard.onswig.com`
- The **network** they want to use: `mainnet` or `devnet`

Store these as environment variables:

```
SWIG_PAYMASTER_API_KEY=<their-api-key>
SWIG_PAYMASTER_PUBKEY=<their-paymaster-pubkey>
SWIG_PAYMASTER_NETWORK=devnet
```

**Option B — Custom Gas Sponsorship Server**
The user runs their own server that signs/sponsors transactions. Ask for:

- The **API URL** of their gas sponsorship server

Store as:

```
GAS_SPONSOR_URL=<their-server-url>
```

**Option C — Self-funded (agent pays its own fees)**
The agent generates its own Solana keypair and pays fees from its own balance. The user must send a small amount of SOL (0.01-0.1 SOL) to the agent's address.

When using this option:

1. Generate a new Ed25519 keypair for the agent
2. Save the keypair securely to a file (e.g. `agent-keypair.json`)
3. Display the public key to the user
4. Ask: "Please send a small amount of SOL (at least 0.01 SOL) to `<agent-public-key>` and let me know when done."
5. Verify the balance before proceeding

In MCP mode, these map directly to `configure_paymaster`, `configure_gas_sponsor`, `generate_agent_keypair`, and `configure_agent_keypair`.

## SDK Choice

The Swig SDK comes in two flavors. Choose based on the project:

| Package                | Solana SDK             | When to Use                                                         |
| ---------------------- | ---------------------- | ------------------------------------------------------------------- |
| `@swig-wallet/classic` | `@solana/web3.js` v1.x | Existing projects using web3.js v1, broader ecosystem compatibility |
| `@swig-wallet/kit`     | `@solana/kit` v2.x     | New projects, modern Solana development                             |

If the user has no preference, default to `@swig-wallet/classic` for broader compatibility.

## SDK Installation

```bash
# For classic (web3.js 1.x)
npm install @swig-wallet/classic @solana/web3.js

# For kit (@solana/kit 2.x)
npm install @swig-wallet/kit @solana/kit

# For paymaster support (add one based on SDK choice)
npm install @swig-wallet/paymaster-classic
# or
npm install @swig-wallet/paymaster-kit
```

## SDK Core Operations

### 1. Create a Swig Wallet

A Swig wallet is created on-chain with:

- A random 32-byte **ID** (used to derive the PDA address)
- A **root authority** (the initial owner, typically an Ed25519 public key)
- **Root actions/permissions** (typically `Actions.set().all().get()` for full control)

#### Classic Example

```typescript
import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
const payer = Keypair.fromSecretKey(/* loaded from file or env */);

// 1. Generate random 32-byte Swig ID
const id = new Uint8Array(32);
crypto.getRandomValues(id);

// 2. Derive the Swig account PDA
const swigAccountAddress = findSwigPda(id);

// 3. Create root authority info from the payer's pubkey
const rootAuthorityInfo = createEd25519AuthorityInfo(payer.publicKey);

// 4. Set root permissions (full control)
const rootActions = Actions.set().all().get();

// 5. Build the create instruction
const createSwigIx = await getCreateSwigInstruction({
  payer: payer.publicKey,
  id,
  actions: rootActions,
  authorityInfo: rootAuthorityInfo,
});

// 6. Send transaction
const tx = new Transaction().add(createSwigIx);
const signature = await sendAndConfirmTransaction(connection, tx, [payer]);

// 7. Fetch and verify
const swig = await fetchSwig(connection, swigAccountAddress);
const walletAddress = await getSwigWalletAddress(swig);

console.log('Swig account:', swigAccountAddress.toBase58());
console.log('Swig wallet address:', walletAddress.toBase58());
```

#### Kit Example

```typescript
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  sendAndConfirmTransactionFactory,
  signTransaction,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getSignatureFromTransaction,
} from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL!);
const rpcSubscriptions = createSolanaRpcSubscriptions(
  process.env.SOLANA_RPC_URL!.replace('https', 'wss'),
);
const payer = await generateKeyPairSigner();

const id = new Uint8Array(32);
crypto.getRandomValues(id);
const swigAccountAddress = await findSwigPda(id);

const rootAuthorityInfo = createEd25519AuthorityInfo(payer.address);
const rootActions = Actions.set().all().get();

const createSwigIx = await getCreateSwigInstruction({
  payer: payer.address,
  id,
  actions: rootActions,
  authorityInfo: rootAuthorityInfo,
});

const { value: blockhash } = await rpc.getLatestBlockhash().send();
const txMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayer(payer.address, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstructions([createSwigIx], m),
);
const compiledTx = compileTransaction(txMessage);
const signedTx = await signTransaction([payer.keyPair], compiledTx);

await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signedTx, {
  commitment: 'confirmed',
});

const swig = await fetchSwig(rpc, swigAccountAddress);
const walletAddress = await getSwigWalletAddress(swig);
```

### 2. Add an Authority

Authorities are additional keys that can interact with the Swig wallet, each with specific permissions.

```typescript
import {
  fetchSwig,
  getAddAuthorityInstructions,
  createEd25519AuthorityInfo,
  Actions,
} from '@swig-wallet/classic';

const swig = await fetchSwig(connection, swigAccountAddress);
const rootRole = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey)[0];

// Create a new authority with specific permissions
const newAuthorityInfo = createEd25519AuthorityInfo(newKeypair.publicKey);

// Example permissions: 0.5 SOL spend limit
const actions = Actions.set()
  .solLimit({ amount: 500_000_000n }) // 0.5 SOL in lamports
  .get();

const ixs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  newAuthorityInfo,
  actions,
);

const tx = new Transaction().add(...ixs);
await sendAndConfirmTransaction(connection, tx, [rootKeypair]);
```

### 3. Remove an Authority

```typescript
import {
  getRemoveAuthorityInstructions,
  fetchSwig,
} from '@swig-wallet/classic';

const swig = await fetchSwig(connection, swigAccountAddress);
const rootRole = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey)[0];

// Find the role ID of the authority to remove
const roleToRemove = swig.findRolesByEd25519SignerPk(targetPubkey)[0];

const ixs = await getRemoveAuthorityInstructions(
  swig,
  rootRole.id,
  roleToRemove.id,
);

const tx = new Transaction().add(...ixs);
await sendAndConfirmTransaction(connection, tx, [rootKeypair]);
```

### 4. Update Authority Permissions

```typescript
import {
  getUpdateAuthorityInstructions,
  updateAuthorityReplaceAllActions,
  updateAuthorityAddActions,
  updateAuthorityRemoveByType,
  Actions,
  Permission,
  fetchSwig,
} from '@swig-wallet/classic';

const swig = await fetchSwig(connection, swigAccountAddress);
const rootRole = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey)[0];
const roleToUpdate = swig.findRolesByEd25519SignerPk(targetPubkey)[0];

// Option 1: Replace all actions
const updateInfo = updateAuthorityReplaceAllActions(
  Actions.set().solLimit({ amount: 1_000_000_000n }).programAll().get(),
);

// Option 2: Add new actions
// const updateInfo = updateAuthorityAddActions(
//   Actions.set().tokenLimit({ mint: tokenMintPubkey, amount: 1_000_000n }).get()
// );

// Option 3: Remove actions by type
// const updateInfo = updateAuthorityRemoveByType([Permission.SolLimit]);

const ixs = await getUpdateAuthorityInstructions(
  swig,
  rootRole.id,
  roleToUpdate.id,
  updateInfo,
);

const tx = new Transaction().add(...ixs);
await sendAndConfirmTransaction(connection, tx, [rootKeypair]);
```

### 5. Execute Transactions Through the Swig Wallet

The Swig wallet acts as the signer for inner instructions. Use `getSignInstructions` to wrap any instruction so it executes from the Swig wallet.

```typescript
import { SystemProgram } from '@solana/web3.js';
import {
  getSignInstructions,
  getSwigWalletAddress,
  fetchSwig,
} from '@swig-wallet/classic';

const swig = await fetchSwig(connection, swigAccountAddress);
const walletAddress = await getSwigWalletAddress(swig);
const role = swig.findRolesByEd25519SignerPk(signerKeypair.publicKey)[0];

// Build the inner instruction (SOL transfer from the Swig wallet)
const transferIx = SystemProgram.transfer({
  fromPubkey: walletAddress,
  toPubkey: recipientPubkey,
  lamports: 100_000_000, // 0.1 SOL
});

// Wrap it with Swig signing
const signedIxs = await getSignInstructions(swig, role.id, [transferIx]);

const tx = new Transaction().add(...signedIxs);
await sendAndConfirmTransaction(connection, tx, [signerKeypair]);
```

### 6. Using the Paymaster (Gasless Transactions)

#### Classic Paymaster

```typescript
import { Keypair } from '@solana/web3.js';
import { createPaymasterClient } from '@swig-wallet/paymaster-classic';

const paymaster = createPaymasterClient({
  apiKey: process.env.SWIG_PAYMASTER_API_KEY!,
  paymasterPubkey: process.env.SWIG_PAYMASTER_PUBKEY!,
  baseUrl: 'https://api.onswig.com',
  network: process.env.SWIG_PAYMASTER_NETWORK as 'mainnet' | 'devnet',
});

// Build your instructions normally, then:
const tx = await paymaster.createLegacyTransaction(
  [instruction1, instruction2],
  [userKeypair], // user signs
);

// Paymaster signs and sends
const signature = await paymaster.signAndSend(tx);
```

#### Kit Paymaster

```typescript
import { partiallySignTransaction } from '@solana/kit';
import { createPaymasterClient } from '@swig-wallet/paymaster-kit';

const paymaster = createPaymasterClient({
  apiKey: process.env.SWIG_PAYMASTER_API_KEY!,
  paymasterPubkey: process.env.SWIG_PAYMASTER_PUBKEY!,
  baseUrl: 'https://api.onswig.com',
  network: process.env.SWIG_PAYMASTER_NETWORK as 'mainnet' | 'devnet',
});

const unsignedTx = await paymaster.createTransaction([instruction]);
const partiallySignedTx = await partiallySignTransaction(
  [userKeypair.keyPair],
  unsignedTx,
);
const fullySignedTx = await paymaster.fullySign(partiallySignedTx);

await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
  fullySignedTx,
  { commitment: 'confirmed' },
);
```

### 7. Custom Gas Sponsorship Server

If the user has their own gas server, send the serialized transaction to it for signing:

```typescript
async function sponsorTransaction(
  serializedTx: Uint8Array,
  sponsorUrl: string,
): Promise<Uint8Array> {
  const response = await fetch(`${sponsorUrl}/sponsor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: Buffer.from(serializedTx).toString('base64'),
    }),
  });
  const { signedTransaction } = await response.json();
  return Buffer.from(signedTransaction, 'base64');
}
```

## Available Permission Types

Use the `Actions` builder to set permissions for authorities:

| Method                                                                            | Description                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `.all()`                                                                          | Full root permissions (everything)               |
| `.manageAuthority()`                                                              | Can add/remove/update other authorities          |
| `.allButManageAuthority()`                                                        | Everything except managing authorities           |
| `.closeSwigAuthority()`                                                           | Can close the Swig account                       |
| `.solLimit({ amount })`                                                           | One-time SOL spend limit (in lamports as bigint) |
| `.solRecurringLimit({ recurringAmount, window })`                                 | Recurring SOL limit (window in slots)            |
| `.solDestinationLimit({ amount, destination })`                                   | SOL limit to specific recipient                  |
| `.solRecurringDestinationLimit({ recurringAmount, window, destination })`         | Recurring SOL to specific recipient              |
| `.tokenLimit({ mint, amount })`                                                   | One-time token spend limit                       |
| `.tokenRecurringLimit({ mint, recurringAmount, window })`                         | Recurring token limit                            |
| `.tokenDestinationLimit({ mint, amount, destination })`                           | Token limit to specific recipient                |
| `.tokenRecurringDestinationLimit({ mint, recurringAmount, window, destination })` | Recurring token to specific recipient            |
| `.programLimit({ programId })`                                                    | Can interact with a specific program             |
| `.programAll()`                                                                   | Can interact with any program                    |
| `.programCurated()`                                                               | Can interact with curated programs               |
| `.subAccount()`                                                                   | Can create/manage sub-accounts                   |
| `.stakeAll()`                                                                     | Full staking permissions                         |
| `.stakeLimit({ amount })`                                                         | Staking with amount limit                        |

Combine permissions by chaining:

```typescript
const actions = Actions.set()
  .solLimit({ amount: 1_000_000_000n }) // 1 SOL limit
  .tokenLimit({ mint: usdcMint, amount: 100_000_000n }) // 100 USDC
  .programLimit({ programId: jupiterProgramId }) // Jupiter access
  .get();
```

## Authority Types

| Type            | Function                                                    | Use Case                |
| --------------- | ----------------------------------------------------------- | ----------------------- |
| Ed25519         | `createEd25519AuthorityInfo(publicKey)`                     | Standard Solana keypair |
| Ed25519 Session | `createEd25519SessionAuthorityInfo(publicKey, maxDuration)` | Time-limited Ed25519    |
| Secp256k1       | `createSecp256k1AuthorityInfo(publicKey)`                   | Ethereum-style keys     |
| Secp256r1       | `createSecp256r1AuthorityInfo(publicKey)`                   | Passkeys / WebAuthn     |

## Agent Identity Key Setup (Self-Funded)

When the agent needs its own keypair:

```typescript
import { Keypair } from '@solana/web3.js';
import fs from 'fs';

// Generate and save
const agentKeypair = Keypair.generate();
fs.writeFileSync(
  'agent-keypair.json',
  JSON.stringify(Array.from(agentKeypair.secretKey)),
);
console.log('Agent public key:', agentKeypair.publicKey.toBase58());

// Load later
const loaded = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('agent-keypair.json', 'utf-8'))),
);
```

## Important Constants

- **Swig Program ID**: `swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB`
- **1 SOL** = `1_000_000_000` lamports (use `BigInt` or `n` suffix)
- **Swig Paymaster Dashboard**: `dashboard.onswig.com`

## Workflow Summary

1. **Choose execution path**: use MCP for direct wallet operations, SDK for code generation or integration
2. **Gather config**: RPC URL and fee strategy; choose SDK flavor if writing code
3. **For MCP**: build/register the server, call `configure_rpc`, set up the agent keypair and fee strategy, then use the wallet tools directly
4. **For SDK**: install packages, load or generate a keypair, create the wallet, add authorities, and wrap inner instructions with `getSignInstructions`

## Error Handling

Always wrap transactions in try/catch and handle common errors:

- Insufficient balance (need SOL for rent + fees)
- Authority not found (refetch swig before operations)
- Permission denied (authority lacks required actions)
- Spend limit exceeded (authority has already used its allowance)

Always call `swig.refetch()` before building new instructions to ensure you have the latest on-chain state.
