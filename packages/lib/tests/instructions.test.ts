import { AccountRole, type Address } from '@solana/kit';
import { AuthorityType } from '@swig-wallet/coder';
import { SolAccountMeta, SwigInstructionContext } from '../src';
import { getAddAuthorityV1BaseAccountMetas } from '../src/instructions/addAuthorityV1';
import type { CreateV1BaseAccountMetas } from '../src/instructions/createV1';
import { getCreateV1BaseAccountMetas } from '../src/instructions/createV1';
import type { RemoveAuthorityV1BaseAccountMetas } from '../src/instructions/removeAuthorityV1';
import type { SignV1BaseAccountMetas } from '../src/instructions/signV1';
import type { SubAccountCreateV1BaseAccountMetas } from '../src/instructions/subAccountCreateV1';
import type { SubAccountSignV1BaseAccountMetas } from '../src/instructions/subAccountSignV1';
import type { SubAccountToggleV1BaseAccountMetas } from '../src/instructions/subAccountToggleV1';
import type { SubAccountWithdrawV1BaseAccountMetas } from '../src/instructions/subAccountWithdrawV1';
import { SwigInstructionV1 } from '../src/instructions/SwigInstruction';

test('getCreateV1BaseAccountMetas returns correct structure', () => {
  const accounts = {
    swig: 'Swig111111111111111111111111111111111111111' as any,
    swigSystemAddress: 'SwigAcct11111111111111111111111111111111111' as any,
    payer: 'Payer11111111111111111111111111111111111111' as any,
  };
  const metas = getCreateV1BaseAccountMetas(accounts);
  expect(metas.length).toBe(4);
  expect(metas[0].publicKey.toAddress()).toBe(accounts.swig);
  expect(metas[1].publicKey.toAddress()).toBe(accounts.payer);
  expect(metas[2].publicKey.toAddress()).toBe(accounts.swigSystemAddress);
});

test('getAddAuthorityV1BaseAccountMetas returns correct structure', () => {
  const accounts = {
    swig: 'Swig111111111111111111111111111111111111111' as any,
    payer: 'Payer11111111111111111111111111111111111111' as any,
  };
  const metas = getAddAuthorityV1BaseAccountMetas(accounts);
  expect(metas.length).toBe(3);
  expect(metas[0].publicKey.toAddress()).toBe(accounts.swig);
  expect(metas[1].publicKey.toAddress()).toBe(accounts.payer);
});

// Dummy addresses for testing
const dummyAddress = (label: string) =>
  `${label}111111111111111111111111111111111111111`.slice(0, 43) as Address;

describe('SwigInstructionV1', () => {
  it('create returns an IInstruction', () => {
    const accounts = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('system'), role: AccountRole.READONLY },
    ].map(SolAccountMeta.fromKitAccountMeta) as CreateV1BaseAccountMetas;
    const data = {
      authorityType: AuthorityType.Ed25519,
      authorityData: new Uint8Array([]),
      bump: 1,
      noOfActions: 0,
      id: new Uint8Array(32),
      actions: new Uint8Array([]),
    };
    const ix = SwigInstructionV1.create(accounts, data as any);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('addAuthority returns an IInstruction', () => {
    const accounts = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('system'), role: AccountRole.READONLY },
      { address: dummyAddress('authority'), role: AccountRole.WRITABLE_SIGNER },
    ].map(SolAccountMeta.fromKitAccountMeta) as [
      ...CreateV1BaseAccountMetas,
      SolAccountMeta,
    ];
    const data = {
      actingRoleId: 0,
      newAuthorityType: AuthorityType.Ed25519,
      noOfActions: 0,
      newAuthorityData: new Uint8Array([]),
      actions: new Uint8Array([]),
      authorityPayload: new Uint8Array([]),
    };
    const ix = SwigInstructionV1.addAuthority(accounts, data as any);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('removeAuthority returns an IInstruction', () => {
    const accounts: RemoveAuthorityV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('authority'), role: AccountRole.WRITABLE_SIGNER },
    ].map(
      SolAccountMeta.fromKitAccountMeta,
    ) as RemoveAuthorityV1BaseAccountMetas;
    const data = {
      actingRoleId: 0,
      authorityToRemoveId: 0,
      authorityPayload: new Uint8Array([]),
    };
    const ix = SwigInstructionV1.removeAuthority(accounts, data as any);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('sign returns an IInstruction', () => {
    const accounts: SignV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
    ].map(SolAccountMeta.fromKitAccountMeta) as SignV1BaseAccountMetas;
    const data = {
      roleId: 0,
      authorityPayload: new Uint8Array([]),
      compactInstructions: [],
    };
    const ix = SwigInstructionV1.sign(accounts, data as any);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('createSession returns an IInstruction', () => {
    const accounts = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('session'), role: AccountRole.READONLY },
    ].map(SolAccountMeta.fromKitAccountMeta) as [
      SolAccountMeta,
      SolAccountMeta,
      SolAccountMeta,
    ];
    const data = {
      roleId: 0,
      sessionDuration: 0n,
      authorityPayload: new Uint8Array([]),
      sessionKey: new Uint8Array(32),
    };
    const ix = SwigInstructionV1.createSession(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountCreate returns an IInstruction', () => {
    const accounts: SubAccountCreateV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('subaccount'), role: AccountRole.WRITABLE },
      { address: dummyAddress('system'), role: AccountRole.READONLY },
    ].map(
      SolAccountMeta.fromKitAccountMeta,
    ) as SubAccountCreateV1BaseAccountMetas;
    const data = {
      roleId: 0,
      bump: 255,
      authorityPayload: new Uint8Array([]),
    };
    const ix = SwigInstructionV1.subAccountCreate(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountSign returns an IInstruction', () => {
    const accounts: SubAccountSignV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.READONLY },
      { address: dummyAddress('subaccount'), role: AccountRole.WRITABLE },
      { address: dummyAddress('system'), role: AccountRole.READONLY },
    ].map(
      SolAccountMeta.fromKitAccountMeta,
    ) as SubAccountSignV1BaseAccountMetas;
    const data = {
      roleId: 0,
      authorityPayload: new Uint8Array([]),
      compactInstructions: [],
    };
    const ix = SwigInstructionV1.subAccountSign(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountWithdraw returns an IInstruction', () => {
    const accounts: SubAccountWithdrawV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.WRITABLE },
      { address: dummyAddress('payer'), role: AccountRole.WRITABLE_SIGNER },
      { address: dummyAddress('subaccount'), role: AccountRole.WRITABLE },
    ].map(
      SolAccountMeta.fromKitAccountMeta,
    ) as SubAccountWithdrawV1BaseAccountMetas;
    const data = {
      roleId: 0,
      authorityPayload: new Uint8Array([]),
      amount: 0n,
    };
    const ix = SwigInstructionV1.subAccountWithdraw(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountToggle returns an IInstruction', () => {
    const accounts: SubAccountToggleV1BaseAccountMetas = [
      { address: dummyAddress('swig'), role: AccountRole.READONLY },
      { address: dummyAddress('payer'), role: AccountRole.READONLY_SIGNER },
      { address: dummyAddress('subaccount'), role: AccountRole.WRITABLE },
    ].map(
      SolAccountMeta.fromKitAccountMeta,
    ) as SubAccountToggleV1BaseAccountMetas;
    const data = {
      actingRoleId: 0,
      subAccountRoleId: 0,
      authorityPayload: new Uint8Array([]),
      enabled: true,
    };
    const ix = SwigInstructionV1.subAccountToggle(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });
});
