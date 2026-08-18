import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/classic';
import { randomBytes } from 'node:crypto';
import {
  buildUserAndAtaRewrites,
  fetchRelayQuote,
  getBatchSignerPubkeys,
  prepareRelayRouteForSwig,
  resolveRelayQuoteInstructions,
  type RelayQuoteRequest,
} from './lib/relay-swig-adapter';

const SURFPOOL_RPC = process.env.SURFPOOL_RPC ?? 'http://127.0.0.1:18999';

function envRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseOptionalMint(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function buildRelayRequest(user: PublicKey): RelayQuoteRequest {
  return {
    user: user.toBase58(),
    originChainId: Number(envRequired('RELAY_ORIGIN_CHAIN_ID')),
    destinationChainId: Number(envRequired('RELAY_DESTINATION_CHAIN_ID')),
    originCurrency: envRequired('RELAY_ORIGIN_CURRENCY'),
    destinationCurrency: envRequired('RELAY_DESTINATION_CURRENCY'),
    amount: envRequired('RELAY_AMOUNT'),
    tradeType:
      (process.env.RELAY_TRADE_TYPE as 'EXACT_INPUT' | 'EXACT_OUTPUT') ??
      'EXACT_INPUT',
    recipient:
      process.env.RELAY_RECIPIENT ??
      '0x000000000000000000000000000000000000dEaD',
  };
}

function getRewriteMints(request: RelayQuoteRequest): PublicKey[] {
  const fromEnv = process.env.RELAY_REWRITE_MINTS;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => new PublicKey(x));
  }

  const inferred = parseOptionalMint(request.originCurrency);
  if (!inferred) return [];

  // Native SOL routes do not use ATA source accounts.
  if (inferred.equals(SystemProgram.programId)) {
    return [];
  }

  return inferred ? [inferred] : [];
}

async function buildTx(
  connection: Connection,
  feePayer: PublicKey,
  instructions: TransactionInstruction[],
): Promise<Transaction> {
  const tx = new Transaction().add(...instructions);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (
    await connection.getLatestBlockhash('confirmed')
  ).blockhash;
  return tx;
}

async function main() {
  const connection = new Connection(SURFPOOL_RPC, 'confirmed');
  const authority = Keypair.generate();
  const quoteUser = Keypair.generate();

  const airdropSig = await connection.requestAirdrop(
    authority.publicKey,
    2_000_000_000,
  );
  await connection.confirmTransaction(airdropSig, 'confirmed');

  const swigId = randomBytes(32);
  const swigAddress = findSwigPda(swigId);
  const createSwigIx = await getCreateSwigInstruction({
    payer: authority.publicKey,
    id: swigId,
    actions: Actions.set().all().get(),
    authorityInfo: createEd25519AuthorityInfo(authority.publicKey),
  });

  const createSwigTx = await buildTx(connection, authority.publicKey, [
    createSwigIx,
  ]);
  createSwigTx.sign(authority);
  const createSig = await connection.sendRawTransaction(
    createSwigTx.serialize(),
  );
  await connection.confirmTransaction(createSig, 'confirmed');

  const swig = await fetchSwig(connection as any, swigAddress);
  const swigWallet = await getSwigWalletAddress(swig);
  const role = swig.findRolesByEd25519SignerPk(authority.publicKey)[0];
  if (!role) throw new Error('Authority role not found on swig account');

  const relayRequest = buildRelayRequest(quoteUser.publicKey);
  const quote = await fetchRelayQuote(relayRequest);
  const rawBatches = await resolveRelayQuoteInstructions(quote, { connection });
  const rewriteMints = getRewriteMints(relayRequest);

  const rewrites = buildUserAndAtaRewrites({
    fromUser: quoteUser.publicKey,
    toUser: swigWallet,
    mints: rewriteMints,
  });
  const prepared = await prepareRelayRouteForSwig({
    quote,
    swig,
    roleId: role.id,
    rewrites,
    resolveOptions: { connection },
  });

  console.log(`Surfpool RPC: ${SURFPOOL_RPC}`);
  console.log(`Quote user:   ${quoteUser.publicKey.toBase58()}`);
  console.log(`Swig wallet:  ${swigWallet.toBase58()}`);
  console.log(`Route request: ${JSON.stringify(relayRequest)}`);
  console.log(`Detected batches: ${rawBatches.length}`);
  console.log(
    `Rewrite mints: ${rewriteMints.map((x) => x.toBase58()).join(', ') || '(none)'}`,
  );
  console.log(`Total replacements: ${prepared.totalReplacements}`);

  for (const batch of rawBatches) {
    console.log(
      `- raw batch step=${batch.stepIndex}/${batch.stepId ?? '?'} item=${batch.itemIndex} source=${batch.source} signers=${getBatchSignerPubkeys(batch).join(',')}`,
    );
  }

  for (const batch of prepared.batches) {
    const tx = await buildTx(
      connection,
      authority.publicKey,
      batch.swigSignInstructions,
    );
    tx.sign(authority);
    const sim = await connection.simulateTransaction(tx);
    console.log(
      `- swig batch step=${batch.stepIndex}/${batch.stepId ?? '?'} item=${batch.itemIndex} replacements=${batch.replacements} simulationErr=${JSON.stringify(sim.value.err)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
