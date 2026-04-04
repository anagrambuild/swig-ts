import { address } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import {
  Actions,
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
  createEd25519AuthorityInfo,
  findSwigPdaRaw,
  getAddAuthorityInstructionContext,
  getCreateSwigInstructionContext,
  getSignInstructionContext,
  getSwigWalletAddressRaw,
} from '../../src';
import { fetchSwig, getFundedKeys, getSvm } from '../context';
import {
  getTransferSolInstruction,
  randomBytes,
  sendSwigSVMTransaction,
  toPublicKey,
} from '../helpers';

const SOL = 1_000_000_000n;

describe('SignV2 ProgramCurated', () => {
  test('allows curated program signing with ProgramCurated action', async () => {
    const svm = getSvm();
    const [root, restricted] = getFundedKeys(svm, 2);
    const recipient = Keypair.generate();
    const swigId = randomBytes(32);

    const [swigAddress] = await findSwigPdaRaw(swigId);

    const createIx = await getCreateSwigInstructionContext({
      authorityInfo: createEd25519AuthorityInfo(root.publicKey),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSwigSVMTransaction(svm, createIx, root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.roles[0];

    const restrictedActions = Actions.set()
      .programCurated()
      .solLimit({ amount: SOL })
      .get();
    const addIx = await getAddAuthorityInstructionContext(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(restricted.publicKey),
      restrictedActions,
    );
    sendSwigSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const restrictedRole = swig.findRolesByEd25519SignerPk(restricted.publicKey)[0];
    expect(restrictedRole).toBeDefined();

    const roleActionBytes = restrictedRole.actions.bytes();
    // ProgramCurated (8 + 32) + SolLimit (8 + 8)
    expect(roleActionBytes.length).toBe(56);
    // ProgramCurated action length u16 little-endian = 32
    expect(roleActionBytes[2]).toBe(32);
    expect(roleActionBytes[3]).toBe(0);

    const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));
    svm.airdrop(walletAddress, SOL);

    const transferAmount = SOL / 10n;
    const transfer = getTransferSolInstruction({
      source: address(walletAddress.toBase58()),
      destination: address(recipient.publicKey.toBase58()),
      amount: transferAmount,
    });

    const signIx = await getSignInstructionContext(
      swig,
      restrictedRole.id,
      [transfer].map(SolInstruction.from),
      false,
      { payer: restricted.publicKey },
    );

    sendSwigSVMTransaction(svm, signIx, restricted);
    expect(svm.getBalance(recipient.publicKey)).toBe(transferAmount);
  });

  test('rejects non-curated program signing when only ProgramCurated is present', async () => {
    const svm = getSvm();
    const [root, restricted] = getFundedKeys(svm, 2);
    const swigId = randomBytes(32);

    const [swigAddress] = await findSwigPdaRaw(swigId);

    const createIx = await getCreateSwigInstructionContext({
      authorityInfo: createEd25519AuthorityInfo(root.publicKey),
      id: swigId,
      payer: root.publicKey,
      actions: Actions.set().all().get(),
    });
    sendSwigSVMTransaction(svm, createIx, root);

    let swig = fetchSwig(svm, swigAddress);
    const rootRole = swig.roles[0];

    const restrictedActions = Actions.set()
      .programCurated()
      .solLimit({ amount: SOL })
      .get();
    const addIx = await getAddAuthorityInstructionContext(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(restricted.publicKey),
      restrictedActions,
    );
    sendSwigSVMTransaction(svm, addIx, root);

    swig = fetchSwig(svm, swigAddress);
    const restrictedRole = swig.findRolesByEd25519SignerPk(restricted.publicKey)[0];
    const walletAddress = toPublicKey(await getSwigWalletAddressRaw(swig));

    const nonCuratedProgram = Keypair.generate().publicKey;
    const uncuratedInstruction = new SolInstruction({
      program: new SolPublicKey(nonCuratedProgram),
      accounts: [
        SolAccountMeta.readonlySigner(new SolPublicKey(walletAddress)),
      ],
      data: new Uint8Array([1]),
    });

    const signIx = await getSignInstructionContext(
      swig,
      restrictedRole.id,
      [uncuratedInstruction],
      false,
      { payer: restricted.publicKey },
    );

    expect(() => sendSwigSVMTransaction(svm, signIx, restricted)).toThrow();
  });
});
