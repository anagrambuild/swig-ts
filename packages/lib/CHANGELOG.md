# @swig-wallet/classic

## 1.9.0

### Minor Changes

- 446bb16: Add `RentDestination` action support across the TypeScript SDK so APIs, action builders, payload decoding, and MCP permission parsing can encode and accept rent-destination configs.

### Patch Changes

- 446bb16: Fix `ProgramCurated` action encoding to include the reserved 32-byte payload so generated SignV2 instructions match on-chain expectations.
- Updated dependencies [446bb16]
- Updated dependencies [446bb16]
  - @swig-wallet/coder@1.9.0

## 1.8.2

### Patch Changes

- 5b2643a: Fix `allButManageAuthority` action checks in the TypeScript SDK so it correctly allows unlimited SOL and SPL token spending and program interactions, while still disallowing authority management.
  - @swig-wallet/coder@1.8.2

## 1.8.1

### Patch Changes

- f796830: Update all published packages to Apache-2.0 licensing metadata and align repository
  license notices with Apache 2.0.
- Updated dependencies [f796830]
  - @swig-wallet/coder@1.8.1

## 1.8.0

### Minor Changes

- 135b3aa: - Add `address`, `addressString`, `signerAddress`, `signerAddressString` properties and `matchesAddress()` method to Authority.
  - Add `address()` and `addressString()` to AuthorityInfo for converting policy-level pubkey bytes to on-chain authority address representation.
  - Add `findRolesByAuthorityAddress()` to Swig for looking up roles by authority address. Deprecate `id` and `signer` in favor of `address` and `signerAddress`.
  - Fix `Ox` typo to `0x` in `secp256k1AddressString`.

### Patch Changes

- @swig-wallet/coder@1.8.0

## 1.7.1

### Patch Changes

- c522b47: Added k1/r1 validation
  - @swig-wallet/coder@1.7.1

## 1.7.0

### Minor Changes

- 77cb698: Fix fee payer is_signer mismatch in message hash computation for secp256r1/secp256k1 authorities. When the fee payer appeared as a transfer destination in inner instructions, the client computed the hash with is_signer=false while the on-chain program saw is_signer=true, causing error 0xbd2 (PermissionDeniedSecp256r1InvalidMessageHash). The payer is now correctly marked as a signer in the accounts list before hash computation.

### Patch Changes

- @swig-wallet/coder@1.7.0

## 1.6.0

### Minor Changes

- 11e1a52: - Add ProgramExec authority support for program-based authentication
  - Add preInstructions/postInstructions support to SwigOptions for transaction composition
- d06ec30: Adds support for new CloseSwig set of instructions

### Patch Changes

- Updated dependencies [11e1a52]
- Updated dependencies [d06ec30]
  - @swig-wallet/coder@1.6.0

## 1.5.0

### Minor Changes

- 814aebd: - UpdateAuthorityV1InstructionContext
  - WithdrawFromSubAccountV1 with AccountV2 changes
  - R1 Instruction accounts patch
  - SubAccountSignV1/ToggleV1 account role fixes for Secp256k1/Secp256r1
- 3636769: Export AuthorityInfo class for SDK integration

### Patch Changes

- Updated dependencies [814aebd]
  - @swig-wallet/coder@1.5.0

## 1.4.2

### Patch Changes

- d320aa4: Fix: Writable flag not set properly when account defined multiple times and readonly in first instance
  - @swig-wallet/coder@1.4.2

## 1.4.1

### Patch Changes

- @swig-wallet/coder@1.4.1

## 1.4.0

### Minor Changes

- ad962ee: Refactor to allow both compressed and uncompressed evm pubkeys to be used in secp256k1 authentication method.
- 56e46d5: - `getWithdrawFromSubAccountCheckedInstructionContext`
  - fix account meta for `SubAccountWithdrawV1`
- 4dc32d9: - Migrate SubAccount from account to action
  - SignV2 support
  - TransferAssetV1 support
  - Swig Account V2, separating wallet & config account
  - ToggleSubAccountV1 includes actingRoleId
- 0fec553: Add SOL and Token destination limits + Recurring Destination Limts for SOL and Tokens

  The following PR addresses:
  - solDestinationLimit
  - tokenDestinationLimit
  - solDestinationRecurringLimit
  - tokenDestinationRecurringLimit

### Patch Changes

- Updated dependencies [4dc32d9]
- Updated dependencies [0fec553]
  - @swig-wallet/coder@1.4.0

## 1.3.0

### Minor Changes

- 5889be0: - `AddMultipleAuthoritiesInstructionContextBuilder` for building multiple authority instructions
  - `getCreateSwigWithMultipleAuthoritiesInstructionContextBuilder`, `getAddMultipleAuthoritiesInstructionsContextBuilder` helpers for building multi-authoirity add instructions for new and exsisting swig respectively.
  - Fix odometer conditions in Authority methods

### Patch Changes

- 6f3a25c: fix stakes for the decoding of the payload
  - @swig-wallet/coder@1.3.0

## 1.2.1

### Patch Changes

- 405ff61: Fixes `UnbalancedTransfer` bug due to strict CPI restrictions with SOL/wSOL transfers.
  - @swig-wallet/coder@1.2.1

## 1.2.0

### Minor Changes

- 28298bf: `AllButManageAuthority`, `StakeAll`, `StakeLimit`, `StakeRecurringLimit` action builder

### Patch Changes

- Updated dependencies [7a87665]
  - @swig-wallet/coder@1.2.0

## 1.1.1

### Patch Changes

- 6c4afdd: Fix TokenRecurring spelling
- Updated dependencies [a6671df]
  - @swig-wallet/coder@1.1.1

## 1.1.0

### Minor Changes

- 3c1437e: Add R1 to lib package. `isSecp256k1BasedAuthority` patch fix

### Patch Changes

- d6411d4: Remove `Buffer` from @/lib and @/kit packages to eliminate need for Node polyfills
- Updated dependencies [cb54f9d]
  - @swig-wallet/coder@1.1.0

## 1.0.0

### Major Changes

- 286f8c4: v1.0 Prod Release.

  ### Key Changes
  1. **Modular Architecture**: Core logic moved to `@swig-wallet/lib`
  2. **Instruction-Based API**: Functions return `TransactionInstruction[]` instead of single instructions
  3. **Simplified Package Structure**: `@swig-wallet/classic` now acts as a thin wrapper
  4. **Updated Dependencies**: Moved from `@solana/spl-token` to `@solana-program/token`

  ## Package Changes

  ### Before (Beta)

  ```typescript
  import {
    Actions,
    createSwig,
    Ed25519Authority,
    addAuthorityInstruction,
    signInstruction,
  } from '@swig-wallet/classic';
  ```

  ### After (v1.0)

  #### For Web3.js 1.x applications:

  ```typescript
  import {
    Actions,
    getCreateSwigInstruction,
    createEd25519AuthorityInfo,
    getAddAuthorityInstructions,
    getSignInstructions,
  } from '@swig-wallet/classic';
  ```

  #### For Web3.js 2.0 applications:

  ```typescript
  import {
    Actions,
    getCreateSwigInstruction,
    createEd25519AuthorityInfo,
    getAddAuthorityInstructions,
    getSignInstructions,
  } from '@swig-wallet/kit';
  ```

  ### After (v1.0)

  ```typescript
  import {
    Actions,
    getCreateSwigInstruction,
    createEd25519AuthorityInfo,
    getAddAuthorityInstructions,
    getSignInstructions,
  } from '@swig-wallet/classic';
  ```

  ## Function Migrations

  ### Creating a Swig

  #### Before (Beta)

  ```typescript
  const rootAuthority = Ed25519Authority.fromPublicKey(user.publicKey);
  const rootActions = Actions.set().manageAuthority().get();
  const tx = await createSwig(
    connection,
    id,
    rootAuthority,
    rootActions,
    user.publicKey,
    [user],
  );
  ```

  #### After (v1.0)

  ```typescript
  const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey);
  const rootActions = Actions.set().manageAuthority().get();

  const createSwigIx = await getCreateSwigInstruction({
    payer: user.publicKey,
    id,
    actions: rootActions,
    authorityInfo: rootAuthorityInfo,
  });

  const transaction = new Transaction().add(createSwigIx);
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    user,
  ]);
  ```

  ### Adding Authorities

  #### Before (Beta)

  ```typescript
  const addAuthorityIx = await addAuthorityInstruction(
    rootRole,
    rootUser.publicKey,
    createEd25519AuthorityInfo(newAuthority.publicKey),
    actions,
  );

  const transaction = new Transaction().add(addAuthorityIx);
  ```

  #### After (v1.0)

  ```typescript
  const addAuthorityInstructions = await getAddAuthorityInstructions(
    swig,
    rootRole.id,
    createEd25519AuthorityInfo(newAuthority.publicKey),
    actions,
  );

  const transaction = new Transaction().add(...addAuthorityInstructions);
  ```

  ### Signing Instructions

  #### Before (Beta)

  ```typescript
  const signedTransfer = await signInstruction(
    tokenRole,
    tokenAuthority.publicKey,
    [transferIx],
  );

  const transaction = new Transaction().add(signedTransfer);
  ```

  #### After (v1.0)

  ```typescript
  const signedTransferInstructions = await getSignInstructions(
    swig,
    tokenRole.id,
    [transferIx],
  );

  const transaction = new Transaction().add(...signedTransferInstructions);
  ```

  ### PDA Derivation

  #### Before (Beta)

  ```typescript
  const [swigAddress] = findSwigPda(id);
  ```

  #### After (v1.0)

  ```typescript
  const swigAddress = findSwigPda(id);
  ```

  ## Authority Creation Changes

  ### Before (Beta)

  ```typescript
  const rootAuthority = Ed25519Authority.fromPublicKey(user.publicKey);
  ```

  ### After (v1.0)

  ```typescript
  const rootAuthorityInfo = createEd25519AuthorityInfo(user.publicKey);
  ```

  ## Import Changes

  ### Core Classes
  - `Actions` class is now imported from `@swig-wallet/lib` (re-exported by `@swig-wallet/classic`)
  - `Swig` class is now imported from `@swig-wallet/lib` (re-exported by `@swig-wallet/classic`)
  - Authority classes have been replaced with info creation functions

  ### Function Naming
  - `createSwig()` → `getCreateSwigInstruction()`
  - `addAuthorityInstruction()` → `getAddAuthorityInstructions()`
  - `signInstruction()` → `getSignInstructions()`
  - `removeAuthorityInstruction()` → `getRemoveAuthorityInstructions()`

  ## Dependency Updates

  ### For Web3.js 1.x applications:

  ```json
  {
    "dependencies": {
      "@swig-wallet/classic": "^1.0.0",
      "@solana-program/token": "^0.5.1",
      "@solana/web3.js": "^1.98.0"
    }
  }
  ```

  ### For Web3.js 2.0 applications:

  ```json
  {
    "dependencies": {
      "@swig-wallet/kit": "^1.0.0",
      "@solana-program/token": "^0.5.1",
      "@solana/kit": "^2.1.0"
    }
  }
  ```

  Remove old dependencies:

  ```bash
  npm uninstall @solana/spl-token
  ```

  Remove old dependencies:

  ```bash
  npm uninstall @solana/spl-token
  ```

  ## Migration Checklist
  - [ ] Update package dependencies
  - [ ] Replace single instruction functions with instruction array functions
  - [ ] Update authority creation from classes to info functions
  - [ ] Update PDA derivation calls
  - [ ] Replace `Ed25519Authority.fromPublicKey()` with `createEd25519AuthorityInfo()`
  - [ ] Update transaction building to spread instruction arrays
  - [ ] Test all functionality with the new API
  - [ ] Update error handling for new function signatures

  ## Common Migration Issues

  ### Issue: Functions returning arrays instead of single instructions

  **Solution**: Use the spread operator when adding to transactions:

  ```typescript
  // Before
  transaction.add(instruction);

  // After
  transaction.add(...instructions);
  ```

  ### Issue: Authority class methods no longer available

  **Solution**: Use the Swig instance methods instead:

  ```typescript
  // Before
  const role = authority.findRole();

  // After
  const swig = await fetchSwig(connection, swigAddress);
  const role = swig.findRolesByEd25519SignerPk(publicKey)[0];
  ```

  ### Issue: Import errors for removed classes

  **Solution**: Replace with new function-based API:

  ```typescript
  // Before
  import { Ed25519Authority } from '@swig-wallet/classic';
  const auth = Ed25519Authority.fromPublicKey(pk);

  // After
  import { createEd25519AuthorityInfo } from '@swig-wallet/classic';
  const authInfo = createEd25519AuthorityInfo(pk);
  ```

  ## Getting Help

  If you encounter issues during migration:
  1. Check the [API documentation](https://anagrambuild.github.io/swig-ts/modules.html)
  2. Review the updated [tutorials](./index)
  3. Examine the [example code](https://github.com/anagrambuild/swig-ts/tree/main/examples/classic/transfer/tutorial)
  4. Open an issue on the [GitHub repository](https://github.com/anagrambuild/swig-ts/issues)

  The v1.0 release is designed to be more consistent and composable, making it easier to build complex Swig applications once you've completed the migration.

### Patch Changes

- Updated dependencies [322dea1]
- Updated dependencies [286f8c4]
- Updated dependencies [4fdb43b]
  - @swig-wallet/coder@1.0.0

## 0.2.0-beta.6

### Patch Changes

- 89a9c9c: fix internal 'coder' dependency version
  - @swig-wallet/coder@0.2.0-beta.6

## 0.2.0-beta.5

### Patch Changes

- 0adc80b: SubAccounts & Secp256K1 Hardening
- Updated dependencies [147493f]
- Updated dependencies [0adc80b]
  - @swig-wallet/coder@0.2.0-beta.5

## 0.2.0-beta.4

### Patch Changes

- 43fcc49: Fix internal depeendency install: @swig-wallet/coder

## 0.2.0-beta.3

### Patch Changes

- c1571a8: Update Secp sign, AuthorityInfo

## 0.2.0-beta.2

### Patch Changes

- aa696bd: fix @swig-wallet/coder imports
- Updated dependencies [aa696bd]
  - @swig-wallet/coder@0.2.0-beta.2
