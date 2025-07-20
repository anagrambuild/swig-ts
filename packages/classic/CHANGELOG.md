# @swig-wallet/classic

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

- 4fdb43b: update program id and discriminator

### Minor Changes

- 322dea1: Remove unneeded argument of authority payload length for crateSessionV1Args

### Patch Changes

- Updated dependencies [322dea1]
- Updated dependencies [286f8c4]
- Updated dependencies [4fdb43b]
  - @swig-wallet/coder@1.0.0
  - @swig-wallet/lib@1.0.0

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
