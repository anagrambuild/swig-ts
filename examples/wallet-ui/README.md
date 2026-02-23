# SWiG Wallet UI

A Linear-inspired Solana wallet cockpit built with React, Vite, Tailwind, and shadcn/ui. The app is optimised for local development against a localhost Solana RPC endpoint and demonstrates SWiG wallet orchestration.

## Features

- Embedded ed25519 keypair persisted in local storage with quick rotation and airdrops.
- One-click SWiG PDA creation, QR export for cross-device pairing, and SOL funding helpers.
- Transaction history table with success/failure badges and SOL deltas.
- Permission management panel to add, edit, and revoke delegated authorities via presets.

## Getting Started

```bash
bun install
bun --filter 'wallet-ui' dev
```

The app expects a local Solana validator on `http://127.0.0.1:8899`. Adjust the RPC endpoint from the connection panel if needed.

Run `bun --filter 'wallet-ui' build` to produce an optimised bundle.
