# @swig-wallet/paymaster-classic

## 0.2.0

### Minor Changes

- 822411f: Initial release of @swig-wallet/paymaster-classic - paymaster client for @solana/web3.js 1.x.

  High-level API for creating and signing transactions with paymaster fee payment:
  - `createLegacyTransaction`: Create traditional transactions without address lookup tables
  - `createTransaction`: Create versioned transactions (v0) with optional address lookup tables
  - `sign`: Add paymaster signature to a transaction
  - `signAndSend`: Sign with paymaster and submit to network in one operation

  Supports both legacy and versioned transactions for maximum compatibility.

### Patch Changes

- Updated dependencies [822411f]
- Updated dependencies [822411f]
- Updated dependencies [822411f]
  - @swig-wallet/paymaster-core@0.2.0
