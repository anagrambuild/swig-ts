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
} from '@swig-wallet/kit';

import { Wallet } from '@ethereumjs/wallet';
import { sleepSync } from 'bun';
import { randomBytes } from 'crypto';

// ------------------ Setup ------------------

const rpc = createSolanaRpc('http://localhost:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
const connection = { rpc, rpcSubscriptions };

const payer = await generateKeyPairSigner();

// Airdrop
await rpc.requestAirdrop(payer.address, lamports(1_000_000_000n)).send();
sleepSync(2000); // give time to finalize

const balance = (await rpc.getBalance(payer.address).send()).value;
console.log(`Payer balance: ${balance} lamports`);

if (balance < lamports(100_000_000n)) {
  throw new Error(
    `Airdrop failed or insufficient balance: ${balance} lamports`,
  );
}

// ------------------ Authority Wallet ------------------

const evmWallet = Wallet.generate();
// createSecp256k1AuthorityInfo now supports both compressed and uncompressed pubkeys
// evmWallet.getPublicKey() returns uncompressed format (64 bytes without prefix)
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
    authorityInfo,
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

sleepSync(2);

const swig = await fetchSwig(rpc, swigAddress);
const rootRole = swig.findRolesBySecp256k1SignerAddress(
  evmWallet.getAddress(),
)?.[0];
if (!rootRole) throw new Error('Root role not found for EVM wallet');

// ------------------ Define Roles ------------------

const rolesToCreate = [
  { name: 'data-entry', amount: 0.05 },
  { name: 'finance', amount: 0.1 },
  { name: 'developer', amount: 0.2 },
  { name: 'moderator', amount: 0.05 },
];

// ------------------ Add Roles ------------------

for (const { name, amount } of rolesToCreate) {
  sleepSync(2);

  const roleWallet = Wallet.generate();
  const roleAuthorityInfo = createSecp256k1AuthorityInfo(
    roleWallet.getPublicKey(),
  );

  const lamportAmount = BigInt(Math.floor(amount * 1_000_000_000));

  const actions = Actions.set().solLimit({ amount: lamportAmount }).get();

  const slot = await rpc.getSlot().send();

  try {
    const addAuthorityIxs = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      roleAuthorityInfo,
      actions,
      {
        preFetch: true,
        currentSlot: BigInt(slot),
        signingFn,
        payer: payer.address,
      },
    );

    const sig = await sendTransaction(connection, addAuthorityIxs, payer);
    console.log(`✅ Role '${name}' added`);
    console.log(`   Tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
  } catch (err) {
    console.error(`❌ Failed to add role '${name}':`, err);
    throw err;
  }
}

console.log('🎉 All roles created using the same EVM wallet');

// ------------------ Helper ------------------

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
