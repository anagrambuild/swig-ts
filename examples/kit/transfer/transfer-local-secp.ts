import {
  AccountRole,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';

import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';

import {
  Actions,
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

import { Wallet } from '@ethereumjs/wallet';

console.log('starting...');

// ------------------ Helpers ------------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint,
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(1200);
}

async function sendTransaction<T extends IInstruction[]>(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: T,
  payer: KeyPairSigner,
): Promise<string> {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  await sendAndConfirmTransactionFactory(connection as any)(signedTransaction, {
    commitment: 'confirmed',
  });

  return getSignatureFromTransaction(signedTransaction).toString();
}

// ------------------ RPC Setup ------------------
const rpc = createSolanaRpc('http://localhost:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
const connection = { rpc, rpcSubscriptions };

// ------------------ EVM Wallet (secp256k1 authority) ------------------
const userWallet = Wallet.generate();

// ------------------ Fee payers/signers ------------------
const payer = await generateKeyPairSigner();
await confirmAirdrop(rpc, payer.address, 1n * LAMPORTS_PER_SOL);

const signer = await generateKeyPairSigner();
await confirmAirdrop(rpc, signer.address, 1n * LAMPORTS_PER_SOL);

// Dapp treasury (receiver)
const dappTreasury = await generateKeyPairSigner();

// ------------------ Swig ID and PDA ------------------
const id = Uint8Array.from({ length: 32 }, () => 1);
const swigAddress = await findSwigPda(id);

// ------------------ Create Swig ------------------
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
  id,
  payer: payer.address,
  actions: rootActions,
});
await sendTransaction(connection, [createSwigIx], payer);

// ------------------ Fetch Swig + Root Role ------------------
let swig = await fetchSwig(rpc, swigAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('swig wallet address:', swigWalletAddress);

// Fund Swig
await confirmAirdrop(rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

const rootRole = swig.findRolesBySecp256k1SignerAddress(
  userWallet.getAddress(),
)?.[0];
if (!rootRole) throw new Error('Role not found for authority');

// ------------------ Prepare transfer instruction ------------------
const TRANSFER_AMOUNT = 100_000_000n; // 0.1 SOL as bigint

const transfer = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: swigWalletAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: dappTreasury.address, role: AccountRole.WRITABLE },
  ],
  data: new Uint8Array(
    getTransferSolInstructionDataEncoder().encode({
      amount: TRANSFER_AMOUNT, // bigint u64
    }),
  ),
} satisfies IInstruction;

console.log(
  'balance before transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);

// ------------------ Sign using secp256k1 signer ------------------
const currentSlotNumber = await rpc.getSlot({ commitment: 'finalized' }).send();
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);

// It’s good practice to refetch before signing to ensure fresh state.
swig = await fetchSwig(rpc, swigAddress);

const signIx = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  payer: signer.address,
  currentSlot: BigInt(currentSlotNumber),
  signingFn,
});

// ------------------ Send signed transaction ------------------
const txSig = await sendTransaction(connection, signIx, signer);

console.log(
  `Transfer sent: https://explorer.solana.com/tx/${txSig}?cluster=custom`,
);

console.log(
  'balance after transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);
