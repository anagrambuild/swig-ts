# @swig-wallet/paymaster-core

## 1.1.0

### Minor Changes

- 9225c99: Add explicit, ALT-safe Jito bundle preparation and submission support to the paymaster SDK.

### Patch Changes

- Updated dependencies [9225c99]
  - @swig-wallet/api@1.4.0

## 1.0.5

### Patch Changes

- Updated dependencies [446bb16]
  - @swig-wallet/api@1.3.0

## 1.0.4

### Patch Changes

- f796830: Update all published packages to Apache-2.0 licensing metadata and align repository
  license notices with Apache 2.0.
- Updated dependencies [f796830]
  - @swig-wallet/api@1.2.1

## 1.0.3

### Patch Changes

- Updated dependencies [2b1a7fb]
  - @swig-wallet/api@1.2.0

## 1.0.2

### Patch Changes

- Updated dependencies [5a01842]
  - @swig-wallet/api@1.1.0

## 1.0.1

### Patch Changes

- 3636769: Refactor to use @swig-wallet/api internally
- Updated dependencies [3636769]
  - @swig-wallet/api@2.0.0

## 1.0.0

### Major Changes

- 16e4be5: Initial release of `@swig-wallet/paymaster-*` packages.

## 0.2.0

### Minor Changes

- 822411f: Initial release of @swig-wallet/paymaster-classic - paymaster client for @solana/web3.js 1.x.

  High-level API for creating and signing transactions with paymaster fee payment:
  - `createLegacyTransaction`: Create traditional transactions without address lookup tables
  - `createTransaction`: Create versioned transactions (v0) with optional address lookup tables
  - `sign`: Add paymaster signature to a transaction
  - `signAndSend`: Sign with paymaster and submit to network in one operation

  Supports both legacy and versioned transactions for maximum compatibility.

- 822411f: Initial release of @swig-wallet/paymaster-core - the foundation package for Solana gasless transactions.

  Provides `PaymasterClient` with low-level methods to sign and send serialized transactions with paymaster fee payment:
  - `signSerializedTransaction`: Sign a serialized transaction with the paymaster
  - `signAndSendSerializedTransaction`: Sign and submit a transaction to the Solana network
  - `isPaymasterFeePayer`: Helper to verify if a transaction uses the paymaster as fee payer

- 822411f: Initial release of @swig-wallet/paymaster-kit - paymaster client for @solana/kit (web3.js 2.0).

  Modern API with full TypeScript type safety for gasless Solana transactions:
  - `createTransaction`: Create transactions with automatic blockhash and fee payer setup
  - `sign`: Add paymaster signature with type-safe return values
  - `fullySign`: Sign and assert all required signatures are present
  - `signAndSend`: Sign with paymaster and submit to network
  - `signTransactionMessage`: Sign compilable transaction messages

  Built for the new @solana/kit API with improved developer experience and compile-time safety.
