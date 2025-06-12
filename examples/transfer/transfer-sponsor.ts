import {
  createMint,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  addAuthorityInstruction,
  createEd25519AuthorityInfo,
  createSwig,
  fetchSwig,
  findSwigPda,
  signInstruction,
} from '@swig-wallet/classic';

//helpers
async function sendAndConfirm(
  conn: Connection,
  ix: TransactionInstruction,
  feePayer: Keypair,
  extra: Keypair[] = [],
) {
  const tx = new Transaction().add(ix);
  tx.feePayer = feePayer.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(feePayer, ...extra);

  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed',
  );
  return sig;
}

//config
const conn = new Connection('http://localhost:8899', 'confirmed');
const userRoot = Keypair.generate();
const userMgr = Keypair.generate();
const devWallet = Keypair.generate();
const recipient = Keypair.generate();

for (const kp of [userRoot, userMgr, devWallet, recipient])
  await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
await new Promise((r) => setTimeout(r, 3_000));

//swig setup
const id = crypto.getRandomValues(new Uint8Array(32));
const [swigAddr] = findSwigPda(id);

await createSwig(
  conn,
  id,
  createEd25519AuthorityInfo(userRoot.publicKey),
  Actions.set().all().get(),
  userRoot.publicKey,
  [userRoot],
);
await new Promise((r) => setTimeout(r, 3_000));
let swig = await fetchSwig(conn, swigAddr);

//manage role
const mgrIx = await addAuthorityInstruction(
  swig.findRolesByEd25519SignerPk(userRoot.publicKey)[0],
  userRoot.publicKey,
  createEd25519AuthorityInfo(userMgr.publicKey),
  Actions.set().manageAuthority().get(),
);
await sendAndConfirm(conn, mgrIx, userRoot);

//create a test-USDC mint
const DECIMALS = 6;
const usdcMint = await createMint(
  conn,
  devWallet,
  devWallet.publicKey,
  null,
  DECIMALS,
);

const swigUsdcAta = await getOrCreateAssociatedTokenAccount(
  conn,
  devWallet,
  usdcMint,
  swigAddr,
  true,
);
const recipUsdcAta = await getOrCreateAssociatedTokenAccount(
  conn,
  devWallet,
  usdcMint,
  recipient.publicKey,
);

await mintTo(
  conn,
  devWallet,
  usdcMint,
  swigUsdcAta.address,
  devWallet.publicKey,
  1_000 * 10 ** DECIMALS,
);

await swig.refetch(conn);

const devRoleIx = await addAuthorityInstruction(
  swig.findRolesByEd25519SignerPk(userMgr.publicKey)[0],
  userMgr.publicKey,
  createEd25519AuthorityInfo(devWallet.publicKey),
  Actions.set()
    .tokenLimit({
      mint: usdcMint,
      amount: BigInt(1_000 * 10 ** DECIMALS),
    })
    .get(),
);
await sendAndConfirm(conn, devRoleIx, userMgr);

//transfer USDC to recipient
await swig.refetch(conn);

const devRole = swig.findRolesByEd25519SignerPk(devWallet.publicKey)[0];
const xferIx = createTransferInstruction(
  swigUsdcAta.address,
  recipUsdcAta.address,
  swigAddr,
  250 * 10 ** DECIMALS,
  [],
  TOKEN_PROGRAM_ID,
);
const signed = await signInstruction(devRole, devWallet.publicKey, [xferIx]);

const sig = await sendAndConfirm(conn, signed, devWallet);
console.log(`https://explorer.solana.com/tx/${sig}?cluster=custom`);

console.log(
  'Swig USDC balance:',
  (await conn.getTokenAccountBalance(swigUsdcAta.address)).value.uiAmount,
);
console.log(
  'Recipient USDC balance:',
  (await conn.getTokenAccountBalance(recipUsdcAta.address)).value.uiAmount,
);
