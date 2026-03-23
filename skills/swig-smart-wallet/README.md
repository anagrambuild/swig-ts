# swig-smart-wallet

An [Agent Skill](https://skills.sh) that teaches AI agents how to create and manage [Swig](https://swig.so) smart wallets on Solana using the Swig TypeScript SDK.

## What this skill does

When installed, the skill gives an AI coding agent (Claude Code, Cursor, Codex, OpenClaw, Cline, etc.) the procedural knowledge to:

- **Create Swig wallets** on Solana with on-chain programmable authority and permission controls
- **Manage authorities** — add, remove, and update keys with granular permissions (SOL limits, token limits, program access, recurring allowances, and more)
- **Execute transactions** through the Swig wallet using `getSignInstructions` to wrap any Solana instruction
- **Handle gas fees** via the Swig Paymaster API, a custom gas sponsorship server, or self-funded SOL
- **Generate keypairs** for agent identity when self-funding
- **Choose the right SDK** — code examples for both `@swig-wallet/classic` (web3.js v1.x) and `@swig-wallet/kit` (@solana/kit v2.x)

The agent writes its own TypeScript scripts using the Swig SDK. The skill is a reference document, not executable code.

## Install

> **Source:** [github.com/anagrambuild/swig-ts/skills/swig-smart-wallet](https://github.com/anagrambuild/swig-ts/tree/main/skills/swig-smart-wallet)

```bash
npx skills add https://github.com/anagrambuild/swig-ts/tree/main/skills/swig-smart-wallet
```

Or install for a specific agent:

```bash
npx skills add https://github.com/anagrambuild/swig-ts/tree/main/skills/swig-smart-wallet
```

### Manual install

Download [`SKILL.md`](https://github.com/anagrambuild/swig-ts/blob/main/skills/swig-smart-wallet/SKILL.md) into the skills directory for your agent:

| Agent       | Path                                          |
| ----------- | --------------------------------------------- |
| Claude Code | `.claude/skills/swig-smart-wallet/SKILL.md`   |
| Cursor      | `.agents/skills/swig-smart-wallet/SKILL.md`   |
| OpenClaw    | `skills/swig-smart-wallet/SKILL.md`           |
| Cline       | `.cline/skills/swig-smart-wallet/SKILL.md`    |
| Codex       | `.agents/skills/swig-smart-wallet/SKILL.md`   |
| Windsurf    | `.windsurf/skills/swig-smart-wallet/SKILL.md` |
| Roo Code    | `.roo/skills/swig-smart-wallet/SKILL.md`      |

For example, to install manually for Claude Code:

```bash
mkdir -p .claude/skills/swig-smart-wallet
curl -sL "https://raw.githubusercontent.com/anagrambuild/swig-ts/main/skills/swig-smart-wallet/SKILL.md" \
  -o .claude/skills/swig-smart-wallet/SKILL.md
```

For the full list of supported agents and paths, see the [skills CLI documentation](https://github.com/vercel-labs/skills#supported-agents).

## What the agent will ask

When the skill activates, the agent follows a structured setup flow before writing any code:

### 1. Solana RPC

The agent asks which RPC endpoint to use. Accepts a URL, or shortcuts like "devnet", "mainnet", or "localnet".

### 2. Gas strategy

The agent presents three options:

| Option                | What the agent needs                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **Swig Paymaster**    | API key and paymaster public key from [dashboard.onswig.com](https://dashboard.onswig.com) |
| **Custom gas server** | The URL of your sponsorship server                                                         |
| **Self-funded**       | The agent generates a keypair and asks you to send it a small amount of SOL                |

### 3. SDK choice

The agent picks `@swig-wallet/classic` or `@swig-wallet/kit` based on your project. Defaults to classic for broader compatibility.

## Covered operations

The skill includes complete, copy-paste-ready code examples for every operation:

| Operation           | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| Create wallet       | Generate ID, derive PDA, send `getCreateSwigInstruction`            |
| Fetch wallet        | `fetchSwig` + inspect roles, version, wallet address                |
| Add authority       | `getAddAuthorityInstructions` with any permission set               |
| Remove authority    | `getRemoveAuthorityInstructions` by role ID                         |
| Update authority    | `getUpdateAuthorityInstructions` with replace/add/remove semantics  |
| SOL transfer        | `SystemProgram.transfer` wrapped in `getSignInstructions`           |
| Token transfer      | SPL `createTransferInstruction` wrapped in `getSignInstructions`    |
| Paymaster (classic) | `createPaymasterClient` + `createLegacyTransaction` + `signAndSend` |
| Paymaster (kit)     | `createPaymasterClient` + `createTransaction` + `fullySign`         |
| Custom gas sponsor  | POST serialized transaction to sponsor URL                          |
| Keypair management  | Generate, save, and load Ed25519 keypairs                           |

## Permissions reference

The skill documents all 16+ permission types available in the `Actions` builder:

| Permission                                               | Description                            |
| -------------------------------------------------------- | -------------------------------------- |
| `all()`                                                  | Full root control                      |
| `manageAuthority()`                                      | Add/remove/update other authorities    |
| `solLimit({ amount })`                                   | One-time SOL spend limit               |
| `solRecurringLimit({ recurringAmount, window })`         | Recurring SOL limit                    |
| `solDestinationLimit({ amount, destination })`           | SOL to specific recipient              |
| `tokenLimit({ mint, amount })`                           | One-time token spend limit             |
| `tokenRecurringLimit({ mint, recurringAmount, window })` | Recurring token limit                  |
| `tokenDestinationLimit({ mint, amount, destination })`   | Token to specific recipient            |
| `programLimit({ programId })`                            | Access to one program                  |
| `programAll()`                                           | Access to any program                  |
| `programCurated()`                                       | Access to curated programs             |
| `subAccount()`                                           | Sub-account management                 |
| `stakeAll()`                                             | Full staking                           |
| `stakeLimit({ amount })`                                 | Staking with limit                     |
| `allButManageAuthority()`                                | Everything except authority management |
| `closeSwigAuthority()`                                   | Can close the wallet                   |

Permissions are composable — chain them to create precise permission sets:

```typescript
const actions = Actions.set()
  .solLimit({ amount: 1_000_000_000n })
  .tokenLimit({ mint: usdcMint, amount: 100_000_000n })
  .programLimit({ programId: jupiterProgram })
  .get();
```

## Authority types

| Type            | Function                                                 | Use case                |
| --------------- | -------------------------------------------------------- | ----------------------- |
| Ed25519         | `createEd25519AuthorityInfo(pubkey)`                     | Standard Solana keypair |
| Ed25519 Session | `createEd25519SessionAuthorityInfo(pubkey, maxDuration)` | Time-limited access     |
| Secp256k1       | `createSecp256k1AuthorityInfo(pubkey)`                   | Ethereum-style keys     |
| Secp256r1       | `createSecp256r1AuthorityInfo(pubkey)`                   | Passkeys / WebAuthn     |

## Related

- **[@swig-wallet/mcp-server](../packages/mcp-server/)** — MCP server that exposes Swig operations as tools agents can call directly (no code generation needed)
- **[@swig-wallet/classic](../packages/classic/)** — Swig SDK for web3.js v1.x
- **[@swig-wallet/kit](../packages/kit/)** — Swig SDK for @solana/kit v2.x
- **[Swig Paymaster Dashboard](https://dashboard.onswig.com)** — Get API keys for gasless transactions
- **[Swig documentation](https://swig.so)** — Protocol documentation

## Compatibility

This skill follows the [Agent Skills specification](https://agentskills.io). It is compatible with any agent that supports `SKILL.md` files, including:

Claude Code, Cursor, Codex, OpenClaw, Cline, Windsurf, Roo Code, Goose, Kilo, GitHub Copilot, Amp, Antigravity, Gemini CLI, and [many more](https://github.com/vercel-labs/skills#supported-agents).

## License

Apache-2.0
