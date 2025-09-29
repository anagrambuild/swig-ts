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
} from '@swig-wallet/classic';

function sleep(s: number) {
  return new Promise((r) => setTimeout(r, s * 1000));
}

function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

(async () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Root payer for fees
  const payer = Keypair.generate();
  await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
  await sleep(2);

  const evmWallet = Wallet.generate();
  // createSecp256k1AuthorityInfo now supports both compressed and uncompressed pubkeys
  // This example uses uncompressed pubkey (64 bytes without prefix)
  // See transfer-svm-secp.ts for an example using compressed pubkeys
  const authorityInfo = createSecp256k1AuthorityInfo(evmWallet.getPublicKey());
  const signingFn = getSigningFnForSecp256k1PrivateKey(
    evmWallet.getPrivateKey(),
  );

  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  // Create Swig
  const ix = await getCreateSwigInstruction({
    id: swigId,
    payer: payer.publicKey,
    authorityInfo,
    actions: Actions.set().all().get(),
  });

  const createTx = new Transaction().add(ix);
  await sendAndConfirmTransaction(connection, createTx, [payer]);
  console.log('Swig created at:', swigAddress.toBase58());

  // Fetch Swig and get root role
  await sleep(2);
  const swig = await fetchSwig(connection, swigAddress);
  const rootRoles = swig.findRolesBySecp256k1SignerAddress(
    evmWallet.getAddress(),
  );
  if (!rootRoles) throw new Error('Root role not found');
  const rootRole = rootRoles[0];

  const rolesToCreate = [
    { name: 'data-entry', amount: 0.05 },
    { name: 'finance', amount: 0.1 },
    { name: 'developer', amount: 0.2 },
    { name: 'moderator', amount: 0.05 },
  ];

  for (const { name, amount } of rolesToCreate) {
    await sleep(2);

    const roleAuthorityInfo = createSecp256k1AuthorityInfo(
      Wallet.generate().getPublicKey(),
    );

    const actions = Actions.set()
      .solLimit({ amount: BigInt(amount * LAMPORTS_PER_SOL) })
      .get();

    const ix = await getAddAuthorityInstructions(
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

    const tx = new Transaction().add(...ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

    console.log(`Role '${name}' added`);
    console.log(` Tx: https://explorer.solana.com/tx/${sig}?cluster=custom`);
  }

  console.log('All roles created using the same EVM wallet.');
})();
