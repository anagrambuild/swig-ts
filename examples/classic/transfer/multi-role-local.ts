import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  getAddAuthorityInstructions,
  createEd25519AuthorityInfo,
  getCreateSwigInstruction,
  fetchSwig,
  findSwigPda,
} from '@swig-wallet/classic';
import {
  createMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const ONE_DAY_SECS = 86400;

function sleep(s: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

async function sendTransaction(
  connection: Connection,
  instruction: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = []
) {
  const transaction = new Transaction().add(...instruction);
  const signature = await connection.sendTransaction(transaction, [payer, ...signers]);

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(
    signature,
    'confirmed',
  );

  if (confirmation.value.err) {
    console.error('Transaction failed:', confirmation.value.err);
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  } else {
    console.log('Transaction confirmed:', signature);
    return signature;
  }
}

(async () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  const rootKeypair = Keypair.generate();
  await connection.requestAirdrop(rootKeypair.publicKey, LAMPORTS_PER_SOL);

  await sleep(2);

  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  const rootActions = Actions.set().all().get();
  const ix = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(rootKeypair.publicKey),
    payer: rootKeypair.publicKey
  });

  await sendTransaction(connection, [ix], rootKeypair)

  await sleep(2);

  const swig = await fetchSwig(connection, swigAddress);
  const rootRoles = swig.findRolesByEd25519SignerPk(rootKeypair.publicKey);
  if (!rootRoles.length) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  // === Create SPL token mint & SWIG ATA ===
  const decimals = 6;
  const tokenMint = await createMint(
    connection,
    rootKeypair,
    rootKeypair.publicKey,
    rootKeypair.publicKey,
    decimals,
    undefined,
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID,
  );
  console.log('🪙 Created test SPL mint:', tokenMint.toBase58());

  const swigAta = getAssociatedTokenAddressSync(
    tokenMint,
    swigAddress,
    true,
  );
  const createAtaIx = createAssociatedTokenAccountInstruction(
    rootKeypair.publicKey,
    swigAta,
    swigAddress,
    tokenMint,
  );
  await sendTransaction(connection, [createAtaIx], rootKeypair);
  console.log('🏦 Created SWIG ATA:', swigAta.toBase58());

  const amountForAta = 10n * BigInt(10 ** decimals);
  await mintTo(
    connection,
    rootKeypair,
    tokenMint,
    swigAta,
    rootKeypair,
    Number(amountForAta),
  );
  console.log('💧 Minted to SWIG ATA:', amountForAta.toString());

  const rolesToCreate = [
    { name: 'data-entry', amount: 0.05, tokenLimit: 100 },
    { name: 'finance', amount: 0.1, tokenLimit: 200 },
    { name: 'developer', amount: 0.2, tokenLimit: 500 },
    { name: 'moderator', amount: 0.05, tokenLimit: 50 },
  ];

  for (const { name, amount, tokenLimit } of rolesToCreate) {
    const roleKeypair = Keypair.generate();

    const builder = Actions.set()
      .solLimit({ amount: BigInt(amount * LAMPORTS_PER_SOL) })
      .tokenLimit({ mint: tokenMint, amount: BigInt(tokenLimit) })
      .solRecurringLimit({
        recurringAmount: BigInt(amount * LAMPORTS_PER_SOL),
        window: BigInt(ONE_DAY_SECS),
      });

    // if token recurring is enabled
    const enableTokenRecurring = false;
    if (enableTokenRecurring) {
      builder.tokenReccuringLimit({
        mint: tokenMint,
        recurringAmount: BigInt(tokenLimit),
        window: BigInt(ONE_DAY_SECS),
      });
    }

    const actions = builder.get();

    const ix = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(roleKeypair.publicKey),
      actions,
    );

    const tx = await sendTransaction(connection, ix, rootKeypair);
    console.log(
      `[${name}] Added role with tx: https://explorer.solana.com/tx/${tx}?cluster=custom`,
    );
    console.log(`[${name}] Public Key: ${roleKeypair.publicKey.toBase58()}`);
  }

  console.log('All roles created successfully.');
})();
