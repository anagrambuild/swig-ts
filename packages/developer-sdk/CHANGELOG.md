# @swig-wallet/developer-sdk

## 0.4.3

### Patch Changes

- 1da14a6: Add IDP paymaster balance reads for One Business funding views.
- 40d8565: Add One Business grant-access URL and callback helpers.

## 0.4.2

### Patch Changes

- 21191af: Add API-key scoped Swig wallet balance, token activity, and paymaster balance read helpers.
- de93161: Update the documented recovery setup flow to feed the create-time `recoverySetup` plan directly into `wallet.recovery.prepareSetup`, and avoid defaulting `targetRoleId` into that plan unless explicitly provided.
- Updated dependencies [c172c01]
  - @swig-wallet/lib@2.1.0

## 0.4.1

### Patch Changes

- bdd0862: Add grouped wallet operation preparation through `wallet.prepare` and the framework proxy, plus a `destinationAccount` swap override.
- 3e331aa: Add client helpers for signing prepared secp256r1 Swig transactions and route transaction sponsorship through the deployed paymaster endpoint.
- b673767: Fix passkey signing to preserve raw WebAuthn `clientDataJSON` in the secp256r1 authority payload.
- eb6b9c4: Simplify Jupiter swap destination arguments to a single recipient owner account.

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
