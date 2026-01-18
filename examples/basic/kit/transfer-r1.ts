import { p256 } from '@noble/curves/nist';
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
  createSecp256r1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSigningFnForSecp256r1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

// ------------------ Helpers ------------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

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

console.log('Starting Kit secp256r1 (P256/WebAuthn) transfer example...');

// ------------------ RPC Setup ------------------
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const connection = { rpc, rpcSubscriptions };

// ------------------ P256 Keypair (secp256r1 authority) ------------------
const r1PrivateKey = p256.utils.randomPrivateKey();
const r1PublicKey = p256.getPublicKey(r1PrivateKey);
console.log('Generated secp256r1 (P256) authority');

// ------------------ Fee payer ------------------
const payer = await generateKeyPairSigner();
await confirmAirdrop(rpc, payer.address, 1n * LAMPORTS_PER_SOL);

// Recipient
const recipient = await generateKeyPairSigner();

// ------------------ Swig ID and PDA ------------------
const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// ------------------ Create Swig ------------------
console.log('Creating SWIG with P256 authority...');
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256r1AuthorityInfo(r1PublicKey),
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

// Find role by compressed P256 public key
const r1CompressedPub = p256.getPublicKey(r1PrivateKey, true);
const roles = swig.findRolesByAuthoritySigner(r1CompressedPub);
if (roles.length === 0) {
  throw new Error('Role not found for secp256r1 authority');
}
const rootRole = roles[0];
console.log('Using root role ID:', rootRole.id);

// ------------------ Prepare transfer instruction ------------------
const TRANSFER_AMOUNT = 100_000_000n; // 0.1 SOL

const transfer = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: swigWalletAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: recipient.address, role: AccountRole.WRITABLE },
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

// ------------------ Sign using secp256r1 signer ------------------
const currentSlotNumber = await rpc.getSlot({ commitment: 'finalized' }).send();
const signingFn = getSigningFnForSecp256r1PrivateKey(r1PrivateKey);

// Refetch before signing
swig = await fetchSwig(rpc, swigAccountAddress);

console.log('Signing transfer...');
const signIx = await getSignInstructions(swig, rootRole.id, [transfer], false, {
  payer: payer.address,
  currentSlot: BigInt(currentSlotNumber),
  signingFn,
});

// ------------------ Send signed transaction ------------------
await sendTransaction(connection, signIx, payer);

console.log(
  'Balance after transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);
console.log(
  'Recipient balance:',
  (await rpc.getBalance(recipient.address).send()).value,
);

console.log('Done!');
