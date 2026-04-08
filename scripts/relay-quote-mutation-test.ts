import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/classic';
import { randomBytes } from 'node:crypto';

const SURFPOOL_RPC = process.env.SURFPOOL_RPC ?? 'http://127.0.0.1:18999';

const RELAY_API = 'https://api.relay.link';
const RELAY_SOLANA_CHAIN_ID = 792703809;
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const BASE_CHAIN_ID = 8453;
const BASE_USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

interface RelayInstruction {
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string;
}

function toWeb3Instruction(ix: RelayInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(ix.data, 'hex'),
  });
}

function cloneRelayInstruction(ix: RelayInstruction): RelayInstruction {
  return {
    programId: ix.programId,
    data: ix.data,
    keys: ix.keys.map((k) => ({ ...k })),
  };
}

function replacePubkey(ix: RelayInstruction, from: string, to: string): number {
  let count = 0;
  for (const key of ix.keys) {
    if (key.pubkey === from) {
      key.pubkey = to;
      count += 1;
    }
  }
  return count;
}

async function buildTx(
  connection: Connection,
  feePayer: PublicKey,
  ixs: TransactionInstruction[],
): Promise<Transaction> {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (
    await connection.getLatestBlockhash('confirmed')
  ).blockhash;
  return tx;
}

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    !PublicKey.isOnCurve(owner),
  );
  const account = await connection.getAccountInfo(ata, 'confirmed');
  if (account) {
    return ata;
  }

  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
  );
  const tx = await buildTx(connection, payer.publicKey, [createAtaIx]);
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return ata;
}

async function callRelayQuote(user: string): Promise<RelayInstruction[]> {
  const quoteBody = {
    user,
    originChainId: RELAY_SOLANA_CHAIN_ID,
    destinationChainId: BASE_CHAIN_ID,
    originCurrency: USDT_MINT.toBase58(),
    destinationCurrency: BASE_USDT,
    amount: '1000000',
    tradeType: 'EXACT_INPUT',
    recipient: '0x000000000000000000000000000000000000dEaD',
  };

  const response = await fetch(`${RELAY_API}/quote/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteBody),
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(
      `Relay quote failed for user=${user}: ${JSON.stringify(data)}`,
    );
  }

  const instructions: RelayInstruction[] = (data.steps ?? [])
    .flatMap((step: any) => step.items ?? [])
    .flatMap((item: any) => item.data?.instructions ?? []);

  if (!instructions.length) {
    throw new Error('Relay quote returned no raw instructions');
  }

  return instructions;
}

async function simulate(
  connection: Connection,
  tx: Transaction,
  label: string,
): Promise<void> {
  try {
    tx.serialize();
  } catch (error: any) {
    console.log(`${label}: serialize FAILED -> ${error.message}`);
    return;
  }

  const sim = await connection.simulateTransaction(tx);
  console.log(`${label}: simulation err -> ${JSON.stringify(sim.value.err)}`);
  if (sim.value.logs?.length) {
    for (const line of sim.value.logs.slice(0, 10)) {
      console.log(`  ${line}`);
    }
  }
}

async function main() {
  const connection = new Connection(SURFPOOL_RPC, 'confirmed');

  const authority = Keypair.generate();
  const quoteUser = Keypair.generate();

  for (const kp of [authority, quoteUser]) {
    const sig = await connection.requestAirdrop(kp.publicKey, 2_000_000_000);
    await connection.confirmTransaction(sig, 'confirmed');
  }

  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);

  const createSwigIx = await getCreateSwigInstruction({
    payer: authority.publicKey,
    id: swigId,
    actions: Actions.set().all().get(),
    authorityInfo: createEd25519AuthorityInfo(authority.publicKey),
  });

  const createTx = await buildTx(connection, authority.publicKey, [
    createSwigIx,
  ]);
  createTx.sign(authority);
  const createSig = await connection.sendRawTransaction(createTx.serialize());
  await connection.confirmTransaction(createSig, 'confirmed');

  const swig = await fetchSwig(connection as any, swigAddress);
  const swigWallet = await getSwigWalletAddress(swig);
  const role = swig.findRolesByEd25519SignerPk(authority.publicKey)[0];
  if (!role) throw new Error('Could not find authority role on swig');

  console.log(`Surfpool:         ${SURFPOOL_RPC}`);
  console.log(`Quote user:       ${quoteUser.publicKey.toBase58()} (on-curve)`);
  console.log(
    `Swig wallet:      ${swigWallet.toBase58()} (on-curve=${PublicKey.isOnCurve(swigWallet.toBytes())})`,
  );

  const relayIxs = await callRelayQuote(quoteUser.publicKey.toBase58());
  const relayIx = cloneRelayInstruction(relayIxs[0]!);

  const quoteUserAta = getAssociatedTokenAddressSync(
    USDT_MINT,
    quoteUser.publicKey,
    false,
  );
  const swigAta = getAssociatedTokenAddressSync(USDT_MINT, swigWallet, true);

  await ensureAta(connection, authority, quoteUser.publicKey, USDT_MINT);
  await ensureAta(connection, authority, swigWallet, USDT_MINT);

  console.log(`Quote user ATA:   ${quoteUserAta.toBase58()}`);
  console.log(`Swig wallet ATA:  ${swigAta.toBase58()}`);

  const userSignerIndexes = relayIx.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => k.pubkey === quoteUser.publicKey.toBase58())
    .map(({ i }) => i);

  const sourceAtaIndexes = relayIx.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => k.pubkey === quoteUserAta.toBase58())
    .map(({ i }) => i);

  console.log(
    `User pubkey indexes in quote ix: ${JSON.stringify(userSignerIndexes)}`,
  );
  console.log(
    `Source ATA indexes in quote ix:  ${JSON.stringify(sourceAtaIndexes)}`,
  );

  const originalTx = await buildTx(connection, quoteUser.publicKey, [
    toWeb3Instruction(relayIx),
  ]);
  originalTx.sign(quoteUser);
  await simulate(
    connection,
    originalTx,
    'Original quote (direct, quote user signer)',
  );

  const swapUserOnly = cloneRelayInstruction(relayIx);
  replacePubkey(
    swapUserOnly,
    quoteUser.publicKey.toBase58(),
    swigWallet.toBase58(),
  );

  const wrappedUserOnly = await getSignInstructions(swig, role.id, [
    toWeb3Instruction(swapUserOnly),
  ]);
  const wrappedUserOnlyTx = await buildTx(
    connection,
    authority.publicKey,
    wrappedUserOnly,
  );
  wrappedUserOnlyTx.sign(authority);
  await simulate(
    connection,
    wrappedUserOnlyTx,
    'Mutated quote A (swap user only, wrapped with swig)',
  );

  const swapUserAndAta = cloneRelayInstruction(relayIx);
  replacePubkey(
    swapUserAndAta,
    quoteUser.publicKey.toBase58(),
    swigWallet.toBase58(),
  );
  replacePubkey(swapUserAndAta, quoteUserAta.toBase58(), swigAta.toBase58());

  const wrappedUserAndAta = await getSignInstructions(swig, role.id, [
    toWeb3Instruction(swapUserAndAta),
  ]);
  const wrappedUserAndAtaTx = await buildTx(
    connection,
    authority.publicKey,
    wrappedUserAndAta,
  );
  wrappedUserAndAtaTx.sign(authority);
  await simulate(
    connection,
    wrappedUserAndAtaTx,
    'Mutated quote B (swap user + source ATA, wrapped with swig)',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
