import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import {
  createAssociatedTokenAccountInstruction,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const ONE_DAY_SECS = 86_400;

function sleep(s: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
  signers: Keypair[] = [],
) {
  const tx = new Transaction().add(...instructions);
  const sig = await connection.sendTransaction(tx, [payer, ...signers]);

  const confirmation = await connection.confirmTransaction(sig, 'confirmed');
  if (confirmation.value.err) {
    console.error('❌ Transaction failed:', confirmation.value.err);
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  console.log('✅ Transaction confirmed:', sig);
  return sig;
}

(async () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root setup
  const root = Keypair.generate();
  console.log('👤 Root authority:', root.publicKey.toBase58());

  await connection.requestAirdrop(root.publicKey, 2 * LAMPORTS_PER_SOL);
  await sleep(2);

  // Swig creation
  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  const rootActions = Actions.set().all().get();
  const createIx = await getCreateSwigInstruction({
    actions: rootActions,
    id: swigId,
    authorityInfo: createEd25519AuthorityInfo(root.publicKey),
    payer: root.publicKey,
  });

  await sendTransaction(connection, [createIx], root);
  await sleep(2);

  const swig = await fetchSwig(connection, swigAddress);
  const swigWallet = await getSwigWalletAddress(swig);

  console.log('📦 Swig PDA:', swigAddress.toBase58());
  console.log('🏦 Swig wallet address:', swigWallet.toBase58());

  const rootRole = swig.findRolesByEd25519SignerPk(root.publicKey)[0];
  if (!rootRole) throw new Error('Root role not found');

  // === Create SPL mint & SWIG ATA ===
  const decimals = 6;
  const tokenMint = await createMint(
    connection,
    root,
    root.publicKey,
    root.publicKey,
    decimals,
    undefined,
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID,
  );
  console.log('🪙 Mint created:', tokenMint.toBase58());

  const swigAta = getAssociatedTokenAddressSync(tokenMint, swigAddress, true);
  const createAtaIx = createAssociatedTokenAccountInstruction(
    root.publicKey,
    swigAta,
    swigAddress,
    tokenMint,
  );
  await sendTransaction(connection, [createAtaIx], root);
  console.log('🏦 Swig ATA created:', swigAta.toBase58());

  const initialAmount = 10n * BigInt(10 ** decimals);
  await mintTo(
    connection,
    root,
    tokenMint,
    swigAta,
    root,
    Number(initialAmount),
  );
  console.log('💧 Minted tokens to Swig ATA:', initialAmount.toString());

  // === Provision roles ===
  const rolesToCreate = [
    { name: 'data-entry', sol: 0.05, token: 100 },
    { name: 'finance', sol: 0.1, token: 200 },
    { name: 'developer', sol: 0.2, token: 500 },
    { name: 'moderator', sol: 0.05, token: 50 },
  ];

  for (const { name, sol, token } of rolesToCreate) {
    const role = Keypair.generate();

    const builder = Actions.set()
      .solLimit({ amount: BigInt(sol * LAMPORTS_PER_SOL) })
      .tokenLimit({ mint: tokenMint, amount: BigInt(token) })
      .solRecurringLimit({
        recurringAmount: BigInt(sol * LAMPORTS_PER_SOL),
        window: BigInt(ONE_DAY_SECS),
      });

    // Example: enable token recurring if needed
    const enableTokenRecurring = false;
    if (enableTokenRecurring) {
      builder.tokenRecurringLimit({
        mint: tokenMint,
        recurringAmount: BigInt(token),
        window: BigInt(ONE_DAY_SECS),
      });
    }

    const roleActions = builder.get();
    const addIx = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      createEd25519AuthorityInfo(role.publicKey),
      roleActions,
    );

    const sig = await sendTransaction(connection, addIx, root);
    console.log(`[${name}] role added with tx: ${sig}`);
    console.log(`[${name}] pubkey: ${role.publicKey.toBase58()}`);
  }

  console.log('🎉 All roles created successfully');
})();
