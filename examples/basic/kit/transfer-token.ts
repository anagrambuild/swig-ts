import {
  addSignersToTransactionMessage,
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
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';

import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

import { getCreateAccountInstruction } from '@solana-program/system';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const LAMPORTS_PER_SOL = 1_000_000_000n;
const DECIMALS = 6;

// ---------- helpers ----------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: Rpc<SolanaRpcApi>,
  to: Address,
  amount: bigint,
) {
  const sig = await rpc.requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(2000);
}

function getTransactionMessage<Inst extends IInstruction[]>(
  instructions: Inst,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  feePayer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );
}

async function sendTransaction<T extends IInstruction[]>(
  connection: {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  },
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });

  const sig = getSignatureFromTransaction(signed).toString();
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

// ---------- main ----------
console.log('Starting Kit SPL token transfer example...');

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const connection = {
  rpc: createSolanaRpc(RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
};

// Create signers
const root = await generateKeyPairSigner();
const manager = await generateKeyPairSigner();
const dapp = await generateKeyPairSigner();
const tokenMint = await generateKeyPairSigner();
const recipient = await generateKeyPairSigner();

// Fund accounts
await confirmAirdrop(connection.rpc, root.address, 1n * LAMPORTS_PER_SOL);
await confirmAirdrop(connection.rpc, manager.address, 1n * LAMPORTS_PER_SOL);
await confirmAirdrop(connection.rpc, dapp.address, 1n * LAMPORTS_PER_SOL);
await confirmAirdrop(connection.rpc, recipient.address, 1n * LAMPORTS_PER_SOL);

// Create Swig
const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

console.log('Creating SWIG...');
const createSwigIx = await getCreateSwigInstruction({
  payer: root.address,
  id,
  authorityInfo: createEd25519AuthorityInfo(root.address),
  actions: Actions.set().all().get(),
});
await sendTransaction(connection, [createSwigIx], root);

const swig = await fetchSwig(connection.rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress);

const rootRole = swig.findRolesByEd25519SignerPk(root.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Add manager role
console.log('Adding manager role...');
const mgrIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(manager.address),
  Actions.set().manageAuthority().get(),
  { payer: root.address },
);
await sendTransaction(connection, mgrIxs, root);
await swig.refetch();

const managerRole = swig.findRolesByEd25519SignerPk(manager.address)[0];
if (!managerRole) throw new Error('Manager role not found');

// Create token mint
console.log('Creating token mint...');
const mintSize = BigInt(getMintSize());
const rent = await connection.rpc
  .getMinimumBalanceForRentExemption(mintSize)
  .send();

const createMintIx = getCreateAccountInstruction({
  payer: dapp,
  newAccount: tokenMint,
  lamports: rent,
  space: mintSize,
  programAddress: TOKEN_PROGRAM_ADDRESS,
});

const initMintIx = getInitializeMintInstruction({
  mint: tokenMint.address,
  decimals: DECIMALS,
  mintAuthority: dapp.address,
});

// Create ATAs
const [swigAta] = await findAssociatedTokenPda({
  mint: tokenMint.address,
  owner: swigWalletAddress,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const [recipientAta] = await findAssociatedTokenPda({
  mint: tokenMint.address,
  owner: recipient.address,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const createSwigAtaIx = await getCreateAssociatedTokenInstructionAsync({
  payer: dapp,
  mint: tokenMint.address,
  owner: swigWalletAddress,
});

const createRecipientAtaIx = await getCreateAssociatedTokenInstructionAsync({
  payer: dapp,
  mint: tokenMint.address,
  owner: recipient.address,
});

// Mint tokens to Swig ATA
const mintAmount = 1_000_000n; // 1.000000 with 6 decimals
const mintToIx = getMintToCheckedInstruction({
  mint: tokenMint.address,
  token: swigAta,
  mintAuthority: dapp,
  amount: mintAmount,
  decimals: DECIMALS,
});

await sendTransaction(
  connection,
  [createMintIx, initMintIx, createSwigAtaIx, createRecipientAtaIx, mintToIx],
  dapp,
);
console.log('Token mint created:', tokenMint.address);
console.log('Minted 1.0 tokens to Swig wallet');

// Add dapp with token limit
console.log('Adding dapp with token limit...');
await swig.refetch();

const devIxs = await getAddAuthorityInstructions(
  swig,
  managerRole.id,
  createEd25519AuthorityInfo(dapp.address),
  Actions.set()
    .tokenLimit({ mint: tokenMint.address, amount: mintAmount })
    .get(),
  { payer: manager.address },
);
await sendTransaction(connection, devIxs, manager);
await swig.refetch();

const dappRole = swig.findRolesByEd25519SignerPk(dapp.address)[0];
if (!dappRole) throw new Error('Dapp role not found');

// Transfer 0.250000 tokens from Swig to recipient
console.log('Transferring 0.25 tokens to recipient...');
const transferAmount = 250_000n; // 0.250000

const transferIx = getTransferCheckedInstruction({
  source: swigAta,
  destination: recipientAta,
  mint: tokenMint.address,
  authority: swigWalletAddress,
  amount: transferAmount,
  decimals: DECIMALS,
});

const currentSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const signIxs = await getSignInstructions(
  swig,
  dappRole.id,
  [transferIx],
  false,
  { payer: dapp.address, currentSlot },
);

await sendTransaction(connection, signIxs, dapp);
console.log('First transfer succeeded (0.25 tokens)');

// Second transfer
console.log('Transferring another 0.25 tokens...');
await swig.refetch();

const currentSlot2 = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

const transferIx2 = getTransferCheckedInstruction({
  source: swigAta,
  destination: recipientAta,
  mint: tokenMint.address,
  authority: swigWalletAddress,
  amount: transferAmount,
  decimals: DECIMALS,
});

const signIxs2 = await getSignInstructions(
  swig,
  dappRole.id,
  [transferIx2],
  false,
  { payer: dapp.address, currentSlot: currentSlot2 },
);

await sendTransaction(connection, signIxs2, dapp);
console.log('Second transfer succeeded (0.25 tokens)');

// Check balances (would need token account fetch to show exact amounts)
console.log('Done!');
