# @swig-wallet/paymaster-classic

## 1.0.2

### Patch Changes

- @swig-wallet/paymaster-core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [3636769]
  - @swig-wallet/paymaster-core@1.0.1

## 1.0.0

### Major Changes

- 16e4be5: Initial release of `@swig-wallet/paymaster-*` packages.

### Patch Changes

- Updated dependencies [16e4be5]
  - @swig-wallet/paymaster-core@1.0.0

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
