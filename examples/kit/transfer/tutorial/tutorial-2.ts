import {
  airdropFactory,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  lamports,
} from '@solana/kit';
import {
  Actions,
  createLegacyTransaction,
  Ed25519Authority,
} from '@swig-wallet/kit';

async function main() {
  const rpc = createSolanaRpc('http://localhost:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');

  // Generate a new keypair
  const signer = await generateKeyPairSigner();
  console.log('Generated address:', signer.address);

  // Airdrop 1 SOL
  await airdropFactory({ rpc, rpcSubscriptions })({
    recipientAddress: signer.address,
    lamports: lamports(1_000_000_000n),
    commitment: 'confirmed',
  });
  const { value: balanceBefore } = await rpc.getBalance(signer.address).send();
  console.log('Balance after airdrop:', balanceBefore.toString());

  // Minimal Swig create flow (same as tutorial-1)
  const id = new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
  const rootAuthority = new Ed25519Authority(
    Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
  );
  const rootActions = Actions.set().all().get();

  try {
    // Construct the Swig create instruction
    const instruction = await rootAuthority.create({
      payer: signer.address,
      id,
      actions: rootActions,
    });
    console.log('Swig create instruction:', instruction);

    // Build, sign, and submit the transaction using kit-native APIs
    const signedTx = await createLegacyTransaction(rpc, [instruction], signer, {
      commitment: 'confirmed',
    });
    console.log('Signed transaction:', signedTx);

    // (Optional) Send the transaction if not already sent by createLegacyTransaction
    // If createLegacyTransaction returns a signature, print it
    // Otherwise, you may need to send it using a kit-native send function
  } catch (err) {
    console.error(
      'Error creating and submitting Swig account (should show undefined address bug):',
      err,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error in minimal kit-native test:', err);
  process.exit(1);
});
