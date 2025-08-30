import { getAddressDecoder } from '@solana/kit';
import { SolInstruction, SwigInstructionContext } from '../src';
import { Ed25519Instruction } from '../src/authority/instructions/ed25519';
import { Secp256k1Instruction } from '../src/authority/instructions/secp256k1';

// Dummy data helpers
const dummyAddress = (label: string) =>
  getAddressDecoder().decode(Buffer.from(label.padEnd(32, '1')));

const dummyUint8 = (len = 32) => new Uint8Array(len).fill(1);

const dummyOptions = {
  signingFn: async () => ({ signature: dummyUint8(64) }),
  currentSlot: 123n,
};

const dummyKitIx = {
  programAddress: dummyAddress('prog'),
  accounts: [],
  data: dummyUint8(8),
};

const dummyInnerInstructions = [dummyKitIx];

describe('Ed25519Instruction', () => {
  const authorityData = dummyUint8(32);

  it('addAuthorityV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData,
      actingRoleId: 1,
      actions: dummyUint8(),
      newAuthorityData: dummyUint8(),
      newAuthorityType: 0,
      noOfActions: 1,
    };
    const ix = await Ed25519Instruction.addAuthorityV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('removeAuthorityV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = { authorityData, actingRoleId: 1, authorityToRemoveId: 2 };
    const ix = await Ed25519Instruction.removeAuthorityV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('signV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData,
      roleId: 1,
      innerInstructions: dummyInnerInstructions.map(SolInstruction.from),
    };
    const ix = await Ed25519Instruction.signV1Instruction(accounts, data);
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('createSessionV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData,
      roleId: 1,
      sessionDuration: 10n,
      sessionKey: dummyUint8(),
    };
    const ix = await Ed25519Instruction.createSessionV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountCreateV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData,
      subAccountId: dummyUint8(),
      authorityType: 0,
      actions: dummyUint8(),
      noOfActions: 1,
      subAccountData: dummyUint8(),
      roleId: 1,
      bump: 1,
    };
    const ix = await Ed25519Instruction.subAccountCreateV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountWithdrawV1SolInstruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData,
      subAccountId: dummyUint8(),
      amount: 1n,
      roleId: 1,
    };
    const ix = await Ed25519Instruction.subAccountWithdrawV1SolInstruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountWithdrawV1TokenInstruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
      subAccountToken: dummyAddress('tok'),
      swigToken: dummyAddress('stok'),
      tokenProgram: dummyAddress('prog'),
    };
    const data = {
      authorityData,
      subAccountId: dummyUint8(),
      amount: 1n,
      roleId: 1,
    };
    const ix = await Ed25519Instruction.subAccountWithdrawV1TokenInstruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountToggleV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData,
      subAccountId: dummyUint8(),
      enabled: true,
      roleId: 1,
    };
    const ix = await Ed25519Instruction.subAccountToggleV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountSignV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData,
      roleId: 1,
      innerInstructions: dummyInnerInstructions.map(SolInstruction.from),
    };
    const ix = await Ed25519Instruction.subAccountSignV1Instruction(
      accounts,
      data,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });
});

describe('Secp256k1Instruction', () => {
  it('addAuthorityV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData: dummyUint8(32),
      actingRoleId: 1,
      newAuthorityType: 0,
      noOfActions: 1,
      newAuthorityData: dummyUint8(32),
      actions: dummyUint8(32),
    };
    const ix = await Secp256k1Instruction.addAuthorityV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('removeAuthorityV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData: dummyUint8(32),
      actingRoleId: 1,
      authorityToRemoveId: 2,
    };
    const ix = await Secp256k1Instruction.removeAuthorityV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('signV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      innerInstructions: dummyInnerInstructions.map(SolInstruction.from),
    };
    const ix = await Secp256k1Instruction.signV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('createSessionV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      sessionDuration: 10n,
      sessionKey: dummyUint8(32),
    };
    const ix = await Secp256k1Instruction.createSessionV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountCreateV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      bump: 1,
    };
    const ix = await Secp256k1Instruction.subAccountCreateV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountWithdrawV1SolInstruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      amount: 1n,
    };
    const ix = await Secp256k1Instruction.subAccountWithdrawV1SolInstruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountWithdrawV1TokenInstruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
      subAccountToken: dummyAddress('tok'),
      swigToken: dummyAddress('stok'),
      tokenProgram: dummyAddress('prog'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      amount: 1n,
    };
    const ix = await Secp256k1Instruction.subAccountWithdrawV1TokenInstruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountToggleV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData: dummyUint8(32),
      enabled: true,
      roleId: 1,
    };
    const ix = await Secp256k1Instruction.subAccountToggleV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });

  it('subAccountSignV1Instruction', async () => {
    const accounts = {
      swig: dummyAddress('swig'),
      payer: dummyAddress('payer'),
      subAccount: dummyAddress('sub'),
    };
    const data = {
      authorityData: dummyUint8(32),
      roleId: 1,
      innerInstructions: dummyInnerInstructions.map(SolInstruction.from),
    };
    const ix = await Secp256k1Instruction.subAccountSignV1Instruction(
      accounts,
      data,
      dummyOptions,
    );
    expect(ix).toBeInstanceOf(SwigInstructionContext);
  });
});
