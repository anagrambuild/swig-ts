import {
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
  Actions,
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

import { Wallet } from '@ethereumjs/wallet';
import { randomBytes } from 'crypto';

// ------------------ Constants & helpers ------------------

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
  // Nudge localnet to finalize
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

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signed = await signTransactionMessageWithSigners(txMessage);
  await sendAndConfirmTransactionFactory(connection as any)(signed, {
    commitment: 'confirmed',
  });

  return getSignatureFromTransaction(signed).toString();
}

// ------------------ Setup ------------------

const rpc = createSolanaRpc('http://localhost:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
const connection = { rpc, rpcSubscriptions };

const payer = await generateKeyPairSigner();

// Airdrop & confirm
await confirmAirdrop(rpc, payer.address, 1n * LAMPORTS_PER_SOL);

const balance = (await rpc.getBalance(payer.address).send()).value;
console.log(`Payer balance: ${balance} lamports`);

if (balance < lamports(100_000_000n)) {
  throw new Error(
    `Airdrop failed or insufficient balance: ${balance} lamports`,
  );
}

// ------------------ Authority Wallet (secp256k1 root) ------------------

const evmWallet = Wallet.generate();
const authorityInfo = createSecp256k1AuthorityInfo(evmWallet.getPublicKey());
const signingFn = getSigningFnForSecp256k1PrivateKey(evmWallet.getPrivateKey());

// ------------------ Create Swig ------------------

const swigId = randomBytes(32);
const swigAddress = await findSwigPda(swigId);

console.log('Creating Swig...');
try {
  const createSwigIx = await getCreateSwigInstruction({
    id: swigId,
    payer: payer.address,
    authorityInfo, // secp256k1 root authority
    actions: Actions.set().all().get(),
  });

  const sig = await sendTransaction(connection, [createSwigIx], payer);
  console.log(`✅ Swig created at: ${swigAddress.toString()}`);
  console.log(`   Tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
} catch (err) {
  console.error('❌ Failed to create Swig:', err);
  throw err;
}

// ------------------ Fetch Swig + Root Role ------------------

await delay(1200);

const swig = await fetchSwig(rpc, swigAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('📦 Swig wallet address:', swigWalletAddress.toString());

const rootRole = swig.findRolesBySecp256k1SignerAddress(
  evmWallet.getAddress(),
)?.[0];
if (!rootRole) throw new Error('Root role not found for EVM wallet');

// ------------------ Define Roles (percent → bigint lamports) ------------------

/**
 * Use integer percent values to avoid floating-point errors.
 * amountLamports = (LAMPORTS_PER_SOL * percent) / 100
 */
const rolesToCreate: Array<{ name: string; percent: bigint }> = [
  { name: 'data-entry', percent: 5n }, // 0.05 SOL
  { name: 'finance', percent: 10n }, // 0.10 SOL
  { name: 'developer', percent: 20n }, // 0.20 SOL
  { name: 'moderator', percent: 5n }, // 0.05 SOL
];

// ------------------ Add Roles ------------------

for (const { name, percent } of rolesToCreate) {
  await delay(800);

  const roleWallet = Wallet.generate();
  const roleAuthorityInfo = createSecp256k1AuthorityInfo(
    roleWallet.getPublicKey(),
  );

  const amountLamports = (LAMPORTS_PER_SOL * percent) / 100n;

  const actions = Actions.set().solLimit({ amount: amountLamports }).get();

  const slot = await rpc.getSlot({ commitment: 'finalized' }).send();

  try {
    const addAuthorityIxs = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      roleAuthorityInfo,
      actions,
      {
        preFetch: true,
        currentSlot: BigInt(slot),
        signingFn, // sign as the secp256k1 root
        payer: payer.address, // fee payer for the tx
      },
    );

    const sig = await sendTransaction(connection, addAuthorityIxs, payer);
    console.log(`✅ Role '${name}' added`);
    console.log(`   Tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
    console.log(
      `   Secp256k1 address: 0x${Buffer.from(roleWallet.getAddress()).toString('hex')}`,
    );
  } catch (err) {
    console.error(`❌ Failed to add role '${name}':`, err);
    throw err;
  }
}

console.log('🎉 All roles created using the same EVM (secp256k1) root');
