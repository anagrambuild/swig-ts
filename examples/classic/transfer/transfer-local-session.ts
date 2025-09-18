import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Signer,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519SessionAuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSessionInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
} from '@swig-wallet/classic';

//
// Helpers
//
async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Signer[] = [],
) {
  const tx = new Transaction().add(...instructions);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer, ...signers], {
    commitment: 'confirmed',
  });
  console.log(`🔗 Sent tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
  return sig;
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

export function sleep(s: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

async function main() {
  console.log('🚀 starting...');

  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root authority
  const userRootKeypair = Keypair.generate();
  await connection.requestAirdrop(userRootKeypair.publicKey, LAMPORTS_PER_SOL);

  // Session authority
  const dappSessionKeypair = Keypair.generate();
  await connection.requestAirdrop(dappSessionKeypair.publicKey, LAMPORTS_PER_SOL);

  // Treasury
  const dappTreasury = Keypair.generate().publicKey;

  await sleep(2);

  const id = randomBytes(32);
  const swigAddress = findSwigPda(id);

  // Create Swig with root session authority
  const rootActions = Actions.set().all().get();
  const createSwigIx = await getCreateSwigInstruction({
    id,
    authorityInfo: createEd25519SessionAuthorityInfo(
      userRootKeypair.publicKey,
      100n,
    ),
    actions: rootActions,
    payer: userRootKeypair.publicKey,
  });

  await sendTransaction(connection, [createSwigIx], userRootKeypair);
  await sleep(2);

  const swig = await fetchSwig(connection, swigAddress);

  const rootRole = swig.findRoleById(0);
  if (!rootRole) throw new Error('Root role not found');

  // Create a session for dapp
  const createSessionIx = await getCreateSessionInstructions(
    swig,
    rootRole.id,
    dappSessionKeypair.publicKey,
    50n,
    { payer: userRootKeypair.publicKey },
  );

  await sendTransaction(connection, createSessionIx, userRootKeypair);
  await sleep(2);

  // Fund Swig
  await connection.requestAirdrop(swigAddress, LAMPORTS_PER_SOL);
  await sleep(2);

  await swig.refetch();

  console.log(
    '🔎 Roles spend SOL capability:',
    swig.roles.map((r) => ({
      id: r.id.toString(),
      canSpend01: r.actions.canSpendSol(BigInt(0.1 * LAMPORTS_PER_SOL)),
    })),
  );

  console.log(
    '💰 Swig balance (before):',
    await connection.getBalance(swigAddress),
  );
  console.log(
    '💰 Treasury balance (before):',
    await connection.getBalance(dappTreasury),
  );

  // Spend from session
  const transfer = SystemProgram.transfer({
    fromPubkey: swigAddress,
    toPubkey: dappTreasury,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });

  const sessionRole = swig.findRoleBySessionKey(dappSessionKeypair.publicKey);
  if (!sessionRole || !sessionRole.isSessionBased())
    throw new Error('Session role not found or not session based');

  const signTransferIx = await getSignInstructions(
    swig,
    sessionRole.id,
    [transfer],
    false,
    { payer: dappSessionKeypair.publicKey },
  );

  await sendTransaction(connection, signTransferIx, dappSessionKeypair);
  await sleep(2);

  console.log(
    '💰 Swig balance (after):',
    await connection.getBalance(swigAddress),
  );
  console.log(
    '💰 Treasury balance (after):',
    await connection.getBalance(dappTreasury),
  );
}

main().catch((err) => {
  console.error('❌ Error running script:', err);
});
