import { Wallet } from '@ethereumjs/wallet';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSigningFnForSecp256k1PrivateKey,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

function sleep(s: number) {
  return new Promise((r) => setTimeout(r, s * 1000));
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

(async () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root payer (funds tx fees)
  const payer = Keypair.generate();
  await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
  await sleep(2);

  // Secp256k1 wallet root authority
  const evmWallet = Wallet.generate();
  // createSecp256k1AuthorityInfo now supports both compressed and uncompressed pubkeys
  // This example uses uncompressed pubkey (64 bytes without prefix)
  // See transfer-svm-secp.ts for an example using compressed pubkeys
  const authorityInfo = createSecp256k1AuthorityInfo(evmWallet.getPublicKey());
  const signingFn = getSigningFnForSecp256k1PrivateKey(
    evmWallet.getPrivateKey(),
  );

  // Create Swig PDA
  const swigId = randomBytes(32);
  const swigAccountAddress = findSwigPda(swigId);

  // Create Swig account
  const createIx = await getCreateSwigInstruction({
    id: swigId,
    payer: payer.publicKey,
    authorityInfo,
    actions: Actions.set().all().get(),
  });

  const createTx = new Transaction().add(createIx);
  const createSig = await sendAndConfirmTransaction(connection, createTx, [
    payer,
  ]);
  console.log('✅ Swig created');
  console.log('   PDA:', swigAccountAddress.toBase58());
  console.log(
    '   Explorer:',
    `https://explorer.solana.com/address/${swigAccountAddress.toBase58()}?cluster=custom`,
  );
  console.log('   Tx:', createSig);

  // Fetch Swig
  await sleep(2);
  const swig = await fetchSwig(connection, swigAccountAddress);
  const swigWalletAddress = await getSwigWalletAddress(swig);
  console.log('🏦 Swig wallet:', swigWalletAddress.toBase58());

  // Root role lookup
  const rootRoles = swig.findRolesBySecp256k1SignerAddress(
    evmWallet.getAddress(),
  );
  if (!rootRoles.length) throw new Error('❌ Root role not found');
  const rootRole = rootRoles[0];
  console.log('🔑 Root role found with id:', rootRole.id.toString());

  // Roles to create
  const rolesToCreate = [
    { name: 'data-entry', amount: 0.05 },
    { name: 'finance', amount: 0.1 },
    { name: 'developer', amount: 0.2 },
    { name: 'moderator', amount: 0.05 },
  ];

  for (const { name, amount } of rolesToCreate) {
    await sleep(1);

    const newWallet = Wallet.generate();
    const roleAuthorityInfo = createSecp256k1AuthorityInfo(
      newWallet.getPublicKey(),
    );

    const actions = Actions.set()
      .solLimit({ amount: BigInt(amount * LAMPORTS_PER_SOL) })
      .get();

    const addIxs = await getAddAuthorityInstructions(
      swig,
      rootRole.id,
      roleAuthorityInfo,
      actions,
      {
        preFetch: true,
        currentSlot: BigInt(await connection.getSlot()),
        signingFn,
        payer: payer.publicKey,
      },
    );

    const tx = new Transaction().add(...addIxs);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

    console.log(`✅ Role '${name}' added`);
    console.log(
      '   Pubkey:',
      Buffer.from(newWallet.getPublicKey()).toString('hex'),
    );
    console.log(
      '   Tx:',
      `https://explorer.solana.com/tx/${sig}?cluster=custom`,
    );
  }

  console.log('🎉 All roles created using the same EVM wallet root authority.');
})();
