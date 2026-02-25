# Swig Dashboard Workshop

A **live coding demo** where Claude Code (with the `swig-smart-wallet` skill installed) writes a React frontend from scratch that:

1. Generates an ephemeral keypair in the browser
2. Creates a Swig wallet from a **policy template** via the Swig Developer Portal API
3. Uses the **paymaster** so the user never needs SOL for gas
4. Airdrops SOL to the Swig wallet
5. Crafts a SOL transfer from the Swig wallet to another address, again using the paymaster

Everything runs on **localhost** - local Solana validator and local paymaster endpoint.

## How the Demo Works

### Before the demo (you do this)

1. Set up the Swig Developer Portal (API key, paymaster, policy ID)
2. Start local Solana validator + local paymaster
3. Install the `swig-smart-wallet` skill into Claude Code
4. Set up environment variables

See **[SETUP.md](./SETUP.md)** for the full pre-demo checklist.

### During the demo (audience watches)

1. Open a fresh directory in Claude Code
2. Paste the prompt from **[DEMO-PROMPT.md](./DEMO-PROMPT.md)**
3. Claude Code writes the entire React app live
4. Run `bun dev` and walk through the app

### What the audience sees

- Claude Code reading the swig skill, understanding the SDK
- Claude Code scaffolding a React + Vite app
- Claude Code writing components that call the Swig Developer API and Paymaster
- A working app where you click through: Create Wallet -> Airdrop -> Transfer

## Files

| File                               | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| [SETUP.md](./SETUP.md)             | Pre-demo checklist and environment setup                  |
| [DEMO-PROMPT.md](./DEMO-PROMPT.md) | The prompt to paste into Claude Code during the live demo |
| [reference/](./reference/)         | Reference implementation of the expected output           |
