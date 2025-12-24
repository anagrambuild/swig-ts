# @swig-wallet/paymaster-kit

## 0.2.0

### Minor Changes

- 822411f: Initial release of @swig-wallet/paymaster-kit - paymaster client for @solana/kit (web3.js 2.0).

  Modern API with full TypeScript type safety for gasless Solana transactions:
  - `createTransaction`: Create transactions with automatic blockhash and fee payer setup
  - `sign`: Add paymaster signature with type-safe return values
  - `fullySign`: Sign and assert all required signatures are present
  - `signAndSend`: Sign with paymaster and submit to network
  - `signTransactionMessage`: Sign compilable transaction messages

  Built for the new @solana/kit API with improved developer experience and compile-time safety.

### Patch Changes

- Updated dependencies [822411f]
- Updated dependencies [822411f]
- Updated dependencies [822411f]
  - @swig-wallet/paymaster-core@0.2.0
