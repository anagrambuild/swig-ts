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
  createSecp256k1SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

import { Wallet } from '@ethereumjs/wallet';

// ------------------ Helpers ------------------
const LAMPORTS_PER_SOL = 1_000_000_000n;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: ReturnType<typeof createSolanaRpc>,
  to: string,
  amount: bigint,
) {
  const sig = await (rpc as any).requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(2000);
}

async function sendTransaction(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: IInstruction[],
  payer: KeyPairSigner,
): Promise<string> {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection as any)(signed, {
    commitment: 'confirmed',
  });

  const sig = getSignatureFromTransaction(signed).toString();
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

// ------------------ Main ------------------
console.log('Starting Kit secp256k1 session transfer example...');

// RPC Setup
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const connection = { rpc, rpcSubscriptions };

// Generate wallets and keypairs
const userWallet = Wallet.generate();
console.log(`Generated secp256k1 authority: ${userWallet.getAddressString()}`);

const payer = await generateKeyPairSigner();
const dappSessionKeypair = await generateKeyPairSigner();
const dappTreasury = await generateKeyPairSigner();

const id = Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// Airdrop SOL
await confirmAirdrop(rpc, payer.address, 1n * LAMPORTS_PER_SOL);
await confirmAirdrop(rpc, dappSessionKeypair.address, 1n * LAMPORTS_PER_SOL);

// Create Swig with secp256k1 session authority
console.log('Creating SWIG with secp256k1 session authority...');
const rootActions = Actions.set().all().get();
const authorityInfo = createSecp256k1SessionAuthorityInfo(
  userWallet.getPublicKey(),
  100n, // Max session duration (slots)
);

const createSwigInstruction = await getCreateSwigInstruction({
  authorityInfo,
  id,
  payer: payer.address,
  actions: rootActions,
});

await sendTransaction(connection, [createSwigInstruction], payer);

// Fetch swig
let swig = await fetchSwig(rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress);

const rootRole = swig.findRoleById(0);
if (!rootRole) throw new Error('Root role not found');
console.log(`Root role is session-based: ${rootRole.isSessionBased()}`);

// Use a finalized slot for session ops
const currentSlot = BigInt(
  await rpc.getSlot({ commitment: 'finalized' }).send(),
);
const signingFn = getSigningFnForSecp256k1PrivateKey(
  userWallet.getPrivateKey(),
);

// Create session (requires Ethereum signature)
console.log('Creating session...');
const sessionInstructions = await getCreateSessionInstructions(
  swig,
  rootRole.id,
  dappSessionKeypair.address,
  50n, // Session duration in slots
  {
    payer: payer.address,
    currentSlot,
    signingFn,
  },
);

await sendTransaction(connection, sessionInstructions, payer);
console.log('Session created');

// Refetch swig and get session role
swig = await fetchSwig(rpc, swigAccountAddress);

const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.address);
if (!sessionRole) throw new Error('Session role not found');
console.log('Session role ID:', sessionRole.id);

// Fund the SWIG wallet
await confirmAirdrop(rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

console.log(
  'Swig balance before transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);

// Create transfer instruction
const TRANSFER_AMOUNT = 100_000_000n; // 0.1 SOL

const transferIx = {
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

// Recompute a fresh finalized slot before signing
const signSlot = BigInt(
  await rpc.getSlot({ commitment: 'finalized' }).send(),
);

// Sign using session key (no signingFn needed - session key signs)
console.log('Signing transfer with session key...');
const signTransferIxs = await getSignInstructions(
  swig,
  sessionRole.id,
  [transferIx],
  false,
  {
    payer: dappSessionKeypair.address,
    currentSlot: signSlot,
  },
);

// Send signed transaction
await sendTransaction(connection, signTransferIxs, dappSessionKeypair);

console.log(
  'Swig balance after transfer:',
  (await rpc.getBalance(swigWalletAddress).send()).value,
);
console.log(
  'Treasury balance:',
  (await rpc.getBalance(dappTreasury.address).send()).value,
);

console.log('Done!');
