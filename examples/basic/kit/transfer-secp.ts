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
  await delay(2000);
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

  const sig = getSignatureFromTransaction(signedTransaction).toString();
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

console.log('Starting Kit secp256k1 transfer example...');

// ------------------ RPC Setup ------------------
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const connection = { rpc, rpcSubscriptions };

// ------------------ EVM Wallet (secp256k1 authority) ------------------
const userWallet = Wallet.generate();
console.log(`Generated secp256k1 authority: ${userWallet.getAddressString()}`);

// ------------------ Fee payers/signers ------------------
const payer = await generateKeyPairSigner();
await confirmAirdrop(rpc, payer.address, 1n * LAMPORTS_PER_SOL);

const signer = await generateKeyPairSigner();
await confirmAirdrop(rpc, signer.address, 1n * LAMPORTS_PER_SOL);

// Dapp treasury (receiver)
const dappTreasury = await generateKeyPairSigner();

// ------------------ Swig ID and PDA ------------------
const id = Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// ------------------ Create Swig ------------------
console.log('Creating SWIG...');
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(userWallet.getPublicKey()),
  id,
  payer: payer.address,
  actions: rootActions,
});
await sendTransaction(connection, [createSwigIx], payer);

// ------------------ Fetch Swig + Root Role ------------------
let swig = await fetchSwig(rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress);

// Fund Swig
await confirmAirdrop(rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

const rootRole = swig.findRolesBySecp256k1SignerAddress(
  userWallet.getAddress(),
)?.[0];
if (!rootRole) throw new Error('Role not found for authority');
console.log('Using root role ID:', rootRole.id);

// ------------------ Prepare transfer instruction ------------------
const TRANSFER_AMOUNT = 100_000_000n; // 0.1 SOL

const transfer = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: swigWalletAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: dappTreasury.address, role: AccountRole.WRITABLE },
  ],
  data: new Uint8Array(
    getTransferSolInstructionDataEncoder().encode({
      amount: TRANSFER_AMOUNT,
    }),
  ),
} satisfies IInstruction;

console.log(
  'Balance before transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);

// ------------------ Sign using secp256k1 signer ------------------
const currentSlotNumber = await rpc.getSlot({ commitment: 'finalized' }).send();
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);

// Refetch before signing
swig = await fetchSwig(rpc, swigAccountAddress);

console.log('Signing transfer...');
const signIx = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  payer: signer.address,
  currentSlot: BigInt(currentSlotNumber),
  signingFn,
});

// ------------------ Send signed transaction ------------------
await sendTransaction(connection, signIx, signer);

console.log(
  'Balance after transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);

console.log('Done!');
