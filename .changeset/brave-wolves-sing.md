---
'@swig-paymaster/classic': minor
'@swig-paymaster/core': minor
---

Initial release of @swig-paymaster/classic - paymaster client for @solana/web3.js 1.x.

High-level API for creating and signing transactions with paymaster fee payment:

- `createLegacyTransaction`: Create traditional transactions without address lookup tables
- `createTransaction`: Create versioned transactions (v0) with optional address lookup tables
- `sign`: Add paymaster signature to a transaction
- `signAndSend`: Sign with paymaster and submit to network in one operation

Supports both legacy and versioned transactions for maximum compatibility.
