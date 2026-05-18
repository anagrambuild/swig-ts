# @swig-wallet/developer-sdk

## 0.4.0

### Minor Changes

- 2c40fad: Return explicit ordered wallet creation transactions, expose per-transaction signature requests, and use requesterAuthority across create, transfer, token transfer, and swap preparation.
- 3fd1a55: Remove internal intent IDs from prepared transaction and wallet creation SDK responses to match the transaction API.

## 0.3.0

### Minor Changes

- 9defe86: Update developer SDK transaction flows for API-prepared wallet creation responses with optional policy IDs, inline initial users, multiple unsigned transactions, add-authority challenges, opinionated SOL/token transfer and Jupiter swap helpers, Jupiter swap proxy support, and local Surfpool smoke coverage.
- 40d1218: Remove `swigId` from wallet handles, wallet references, and prepared wallet responses so SDK consumers use the Swig config address as the wallet identifier.

## 0.2.0

### Minor Changes

- 94ba0f8: Update developer SDK transaction flows for API-prepared wallet creation responses with multiple unsigned transactions, add-authority challenges, Jupiter swap proxy support, and local Surfpool smoke coverage.

## 0.1.1

### Patch Changes

- d55b973: Publish the developer SDK package publicly.

## 0.1.0

### Minor Changes

- Initial API-key developer SDK scaffold.
