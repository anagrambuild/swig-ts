/**
 * Create Swig Multi-Authority Test (Kit)
 *
 * Demonstrates the authority bootstrap pattern for integrators:
 * 1. Create a Swig and add multiple authorities in one transaction.
 * 2. Only the initial authority signs that creation transaction.
 * 3. Initial authority cannot remove itself.
 * 4. The root/bootstrap role cannot be removed (even by another manager role).
 * 5. The manager role can still remove non-root authorities.
 * 6. Root role can be downgraded from All to narrower permissions.
 * 7. Root role cannot be updated to an empty permission set.
 */

import { describe, expect, test } from 'bun:test';
import {
  Actions,
  AddMultipleAuthoritiesInstructionBuilder,
  createEd25519AuthorityInfo,
  findSwigPda,
  getRemoveAuthorityInstructions,
  getUpdateAuthorityInstructions,
  updateAuthorityReplaceAllActions,
} from '../src';
import { fetchSwig, getFundedKeys, getSvm } from './context';
import { randomBytes, sendKitTransaction } from './utils';

describe('create-swig-multi-authority', () => {
  test('creates with one signer and enforces root-role removal rules', async () => {
    const svm = getSvm();
    const [bootstrapAuthority, managerAuthority, appAuthority] = getFundedKeys(
      svm,
      3,
    );
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: bootstrapAuthority.address,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(bootstrapAuthority.address),
        options: {},
      });

    createBuilder
      .addAuthority(
        createEd25519AuthorityInfo(managerAuthority.address),
        Actions.set().manageAuthority().get(),
      )
      .addAuthority(
        createEd25519AuthorityInfo(appAuthority.address),
        Actions.set().solLimit({ amount: 100_000_000n }).get(),
      );

    const createIxs = await createBuilder.getInstructions();

    // Only bootstrapAuthority signs this transaction.
    sendKitTransaction(svm, createIxs, bootstrapAuthority);

    let swig = fetchSwig(svm, swigAddress);

    expect(swig.roles.length).toBe(3);
    expect(
      swig.findRolesByEd25519SignerPk(bootstrapAuthority.publicKey).length,
    ).toBe(1);
    expect(
      swig.findRolesByEd25519SignerPk(managerAuthority.publicKey).length,
    ).toBe(1);
    expect(swig.findRolesByEd25519SignerPk(appAuthority.publicKey).length).toBe(
      1,
    );

    const bootstrapRole = swig.findRolesByEd25519SignerPk(
      bootstrapAuthority.publicKey,
    )[0]!;

    const removeSelfIxs = await getRemoveAuthorityInstructions(
      swig,
      bootstrapRole.id,
      bootstrapRole.id,
    );

    expect(() =>
      sendKitTransaction(svm, removeSelfIxs, bootstrapAuthority),
    ).toThrow();

    swig = fetchSwig(svm, swigAddress);
    const managerRole = swig.findRolesByEd25519SignerPk(
      managerAuthority.publicKey,
    )[0]!;
    const appRole = swig.findRolesByEd25519SignerPk(appAuthority.publicKey)[0]!;
    expect(managerRole.actions.canManageAuthority()).toBe(true);

    const removeBootstrapIxs = await getRemoveAuthorityInstructions(
      swig,
      managerRole.id,
      bootstrapRole.id,
    );
    expect(() =>
      sendKitTransaction(svm, removeBootstrapIxs, managerAuthority),
    ).toThrow();

    const removeAppIxs = await getRemoveAuthorityInstructions(
      swig,
      managerRole.id,
      appRole.id,
    );
    sendKitTransaction(svm, removeAppIxs, managerAuthority);

    swig = fetchSwig(svm, swigAddress);
    expect(
      swig.findRolesByEd25519SignerPk(bootstrapAuthority.publicKey).length,
    ).toBe(1);
    expect(
      swig.findRolesByEd25519SignerPk(managerAuthority.publicKey).length,
    ).toBe(1);
    expect(swig.findRolesByEd25519SignerPk(appAuthority.publicKey).length).toBe(
      0,
    );
  });

  test('allows root downgrade but rejects full permission removal', async () => {
    const svm = getSvm();
    const [rootAuthority, managerAuthority] = getFundedKeys(svm, 2);
    const swigId = randomBytes(32);
    const swigAddress = await findSwigPda(swigId);

    const createBuilder =
      AddMultipleAuthoritiesInstructionBuilder.withCreateSwigInstruction({
        payer: rootAuthority.address,
        swigAddress,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo: createEd25519AuthorityInfo(rootAuthority.address),
        options: {},
      });

    createBuilder.addAuthority(
      createEd25519AuthorityInfo(managerAuthority.address),
      Actions.set().manageAuthority().get(),
    );

    const createIxs = await createBuilder.getInstructions();
    sendKitTransaction(svm, createIxs, rootAuthority);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.findRoleById(0)!;
    const managerRole = swig.findRolesByEd25519SignerPk(
      managerAuthority.publicKey,
    )[0]!;

    const removeAllRootActionsIxs = await getUpdateAuthorityInstructions(
      swig,
      rootRole.id,
      rootRole.id,
      updateAuthorityReplaceAllActions(Actions.set().get()),
    );
    expect(() =>
      sendKitTransaction(svm, removeAllRootActionsIxs, rootAuthority),
    ).toThrow();

    const downgradeToManagerIxs = await getUpdateAuthorityInstructions(
      swig,
      rootRole.id,
      rootRole.id,
      updateAuthorityReplaceAllActions(Actions.set().manageAuthority().get()),
    );
    sendKitTransaction(svm, downgradeToManagerIxs, rootAuthority);

    swig = fetchSwig(svm, swigAddress);
    const managerOnlyRoot = swig.findRoleById(0)!;
    expect(managerOnlyRoot.actions.isRoot()).toBe(false);
    expect(managerOnlyRoot.actions.canManageAuthority()).toBe(true);

    const downgradeToZeroLimitIxs = await getUpdateAuthorityInstructions(
      swig,
      managerOnlyRoot.id,
      managerOnlyRoot.id,
      updateAuthorityReplaceAllActions(
        Actions.set().solLimit({ amount: 0n }).get(),
      ),
    );
    sendKitTransaction(svm, downgradeToZeroLimitIxs, rootAuthority);

    swig = fetchSwig(svm, swigAddress);
    const minimalRoot = swig.findRoleById(0)!;
    expect(minimalRoot.actions.isRoot()).toBe(false);
    expect(minimalRoot.actions.canManageAuthority()).toBe(false);
    expect(minimalRoot.actions.solSpendLimit()).toBe(0n);

    const rootRemoveManagerIxs = await getRemoveAuthorityInstructions(
      swig,
      minimalRoot.id,
      managerRole.id,
    );
    expect(() =>
      sendKitTransaction(svm, rootRemoveManagerIxs, rootAuthority),
    ).toThrow();
  });
});
