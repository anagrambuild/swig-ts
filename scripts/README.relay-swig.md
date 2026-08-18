# Relay + Swig reusable adapter

This folder now includes a reusable adapter for converting Relay quote routes into
Swig-signable instructions.

## Module

- `scripts/lib/relay-swig-adapter.ts`

Core functions:

- `fetchRelayQuote(request, options)`
- `resolveRelayQuoteInstructions(quote, { connection })`
- `buildUserAndAtaRewrites({ fromUser, toUser, mints })`
- `prepareRelayRouteForSwig({ quote, swig, roleId, rewrites, resolveOptions })`

The adapter keeps per-step/per-item batch boundaries so multi-step Relay routes
can be executed sequentially.

## Validation script (USDC + cheatcode funding)

- `scripts/relay-usdc-cheatcode-validation.ts`

Runs baseline (quote user) and mutated (Swig) executions and compares token
spend deltas.

Example:

```bash
SURFPOOL_RPC=http://127.0.0.1:18999 bun scripts/relay-usdc-cheatcode-validation.ts
```

## One-command end-to-end runner

- `scripts/run-relay-swig-validation.sh`

This script:

- starts Surfpool (mainnet fork) on custom ports
- runs the full USDC cheatcode validation flow
- prints Explorer links using `cluster=custom` + Surfpool RPC
- leaves Surfpool running for manual inspection

Example:

```bash
./scripts/run-relay-swig-validation.sh
```

Optional env overrides:

- `SURFPOOL_HOST` (default `127.0.0.1`)
- `SURFPOOL_PORT` (default `18999`)
- `SURFPOOL_WS_PORT` (default `SURFPOOL_PORT + 1`)

## Generic route runner

- `scripts/relay-generic-route-runner.ts`

Environment variables:

- `RELAY_ORIGIN_CHAIN_ID`
- `RELAY_DESTINATION_CHAIN_ID`
- `RELAY_ORIGIN_CURRENCY`
- `RELAY_DESTINATION_CURRENCY`
- `RELAY_AMOUNT`
- optional `RELAY_TRADE_TYPE`, `RELAY_RECIPIENT`, `RELAY_REWRITE_MINTS`

Example:

```bash
RELAY_ORIGIN_CHAIN_ID=792703809 \
RELAY_DESTINATION_CHAIN_ID=8453 \
RELAY_ORIGIN_CURRENCY=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
RELAY_DESTINATION_CURRENCY=0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913 \
RELAY_AMOUNT=1000000 \
SURFPOOL_RPC=http://127.0.0.1:18999 \
bun scripts/relay-generic-route-runner.ts
```
