import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
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
  getSwigWalletAddress,
} from '@swig-wallet/classic';
import { randomBytes } from 'node:crypto';
import {
  buildUserAndAtaRewrites,
  fetchRelayQuote,
  prepareRelayRouteForSwig,
  resolveRelayQuoteInstructions,
  type RelayQuoteRequest,
} from './lib/relay-swig-adapter';

const SURFPOOL_RPC = process.env.SURFPOOL_RPC ?? 'http://127.0.0.1:18999';

const DEFAULT_ORIGIN_CHAIN_ID = 792703809;
const DEFAULT_DESTINATION_CHAIN_ID = 8453;
const DEFAULT_ORIGIN_CURRENCY = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Solana USDC
const DEFAULT_DESTINATION_CURRENCY =
  '0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913'; // Base USDC
const DEFAULT_AMOUNT = '1000000'; // 1 USDC
const INITIAL_FUNDED_AMOUNT = 4_000_000; // 4 USDC

interface RpcResponse<T = unknown> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
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

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  label: string,
): Promise<string> {
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    throw new Error(
      `${label} simulation failed: ${JSON.stringify(sim.value.err)}\n${(sim.value.logs ?? []).join('\n')}`,
    );
  }

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
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
    !PublicKey.isOnCurve(owner.toBytes()),
  );
  const existing = await connection.getAccountInfo(ata, 'confirmed');
  if (existing) return ata;

  const ix = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
  );
  const tx = await buildTx(connection, payer.publicKey, [ix]);
  tx.sign(payer);
  await sendAndConfirm(connection, tx, 'create ATA');
  return ata;
}

async function surfnetSetTokenAccount(args: {
  rpcUrl: string;
  owner: PublicKey;
  mint: PublicKey;
  amount: number;
}): Promise<void> {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'surfnet_setTokenAccount',
    params: [
      args.owner.toBase58(),
      args.mint.toBase58(),
      {
        amount: args.amount,
        state: 'initialized',
      },
      TOKEN_PROGRAM_ID.toBase58(),
    ],
  };

  const response = await fetch(args.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: RpcResponse = await response.json();
  if (!response.ok || json.error) {
    throw new Error(
      `surfnet_setTokenAccount failed for owner=${args.owner.toBase58()}: ${JSON.stringify(json.error ?? json)}`,
    );
  }
}

async function getTokenBalance(
  connection: Connection,
  ata: PublicKey,
): Promise<number> {
  const bal = await connection.getTokenAccountBalance(ata, 'confirmed');
  return Number(bal.value.amount);
}

function getRelayRequestForUser(user: PublicKey): RelayQuoteRequest {
  return {
    user: user.toBase58(),
    originChainId: Number(
      process.env.RELAY_ORIGIN_CHAIN_ID ?? DEFAULT_ORIGIN_CHAIN_ID,
    ),
    destinationChainId: Number(
      process.env.RELAY_DESTINATION_CHAIN_ID ?? DEFAULT_DESTINATION_CHAIN_ID,
    ),
    originCurrency:
      process.env.RELAY_ORIGIN_CURRENCY ?? DEFAULT_ORIGIN_CURRENCY,
    destinationCurrency:
      process.env.RELAY_DESTINATION_CURRENCY ?? DEFAULT_DESTINATION_CURRENCY,
    amount: process.env.RELAY_AMOUNT ?? DEFAULT_AMOUNT,
    tradeType: 'EXACT_INPUT',
    recipient:
      process.env.RELAY_RECIPIENT ??
      '0x000000000000000000000000000000000000dEaD',
  };
}

function parseOriginMint(originCurrency: string): PublicKey {
  try {
    return new PublicKey(originCurrency);
  } catch {
    throw new Error(
      `This validation script requires a Solana SPL-token origin currency. Got: ${originCurrency}`,
    );
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

  const createSwigTx = await buildTx(connection, authority.publicKey, [
    createSwigIx,
  ]);
  createSwigTx.sign(authority);
  await sendAndConfirm(connection, createSwigTx, 'create swig');

  const swig = await fetchSwig(connection as any, swigAddress);
  const swigWallet = await getSwigWalletAddress(swig);
  const role = swig.findRolesByEd25519SignerPk(authority.publicKey)[0];
  if (!role) throw new Error('Could not find authority role on swig');

  const relayRequest = getRelayRequestForUser(quoteUser.publicKey);
  const originMint = parseOriginMint(relayRequest.originCurrency);
  const relayAmount = Number(relayRequest.amount);

  const quoteUserAta = await ensureAta(
    connection,
    authority,
    quoteUser.publicKey,
    originMint,
  );
  const swigAta = await ensureAta(
    connection,
    authority,
    swigWallet,
    originMint,
  );

  await surfnetSetTokenAccount({
    rpcUrl: SURFPOOL_RPC,
    owner: quoteUser.publicKey,
    mint: originMint,
    amount: INITIAL_FUNDED_AMOUNT,
  });
  await surfnetSetTokenAccount({
    rpcUrl: SURFPOOL_RPC,
    owner: swigWallet,
    mint: originMint,
    amount: INITIAL_FUNDED_AMOUNT,
  });

  console.log(`Surfpool RPC:               ${SURFPOOL_RPC}`);
  console.log(`Relay route origin chain:   ${relayRequest.originChainId}`);
  console.log(`Relay route destination:    ${relayRequest.destinationChainId}`);
  console.log(`Relay origin currency:      ${relayRequest.originCurrency}`);
  console.log(
    `Relay destination currency: ${relayRequest.destinationCurrency}`,
  );
  console.log(`Relay input amount:         ${relayRequest.amount}`);
  console.log(`Quote user:                 ${quoteUser.publicKey.toBase58()}`);
  console.log(`Quote user ATA:             ${quoteUserAta.toBase58()}`);
  console.log(`Swig wallet:                ${swigWallet.toBase58()}`);
  console.log(`Swig wallet ATA:            ${swigAta.toBase58()}`);
  console.log(
    `Funded each ATA with:       ${INITIAL_FUNDED_AMOUNT} base units`,
  );

  const quote = await fetchRelayQuote(relayRequest);
  const quoteBatches = await resolveRelayQuoteInstructions(quote, {
    connection,
  });
  if (quoteBatches.length === 0) {
    throw new Error(
      'Relay quote did not contain executable Solana instructions',
    );
  }

  const baselineBefore = await getTokenBalance(connection, quoteUserAta);
  const baselineSigs: string[] = [];
  for (const batch of quoteBatches) {
    const baselineTx = await buildTx(
      connection,
      quoteUser.publicKey,
      batch.instructions,
    );
    baselineTx.sign(quoteUser);
    baselineSigs.push(
      await sendAndConfirm(
        connection,
        baselineTx,
        `baseline step=${batch.stepIndex} item=${batch.itemIndex}`,
      ),
    );
  }
  const baselineAfter = await getTokenBalance(connection, quoteUserAta);

  const rewrites = buildUserAndAtaRewrites({
    fromUser: quoteUser.publicKey,
    toUser: swigWallet,
    mints: [originMint],
  });
  const prepared = await prepareRelayRouteForSwig({
    quote,
    swig,
    roleId: role.id,
    rewrites,
    resolveOptions: { connection },
  });
  if (prepared.batches.length === 0) {
    throw new Error('Swig preparation produced no instruction batches');
  }

  const mutatedBefore = await getTokenBalance(connection, swigAta);
  const mutatedSigs: string[] = [];
  for (const batch of prepared.batches) {
    const mutatedTx = await buildTx(
      connection,
      authority.publicKey,
      batch.swigSignInstructions,
    );
    mutatedTx.sign(authority);
    mutatedSigs.push(
      await sendAndConfirm(
        connection,
        mutatedTx,
        `swig step=${batch.stepIndex} item=${batch.itemIndex}`,
      ),
    );
  }
  const mutatedAfter = await getTokenBalance(connection, swigAta);

  const baselineSpent = baselineBefore - baselineAfter;
  const mutatedSpent = mutatedBefore - mutatedAfter;
  if (baselineSpent <= 0 || mutatedSpent <= 0) {
    throw new Error(
      `Expected positive token spend. baselineSpent=${baselineSpent}, mutatedSpent=${mutatedSpent}`,
    );
  }

  console.log();
  console.log('Validation Results:');
  console.log(`- baseline signatures: ${baselineSigs.join(', ')}`);
  console.log(
    `  quote user ATA delta: ${baselineBefore} -> ${baselineAfter} (spent ${baselineSpent})`,
  );
  console.log(`- swig signatures:     ${mutatedSigs.join(', ')}`);
  console.log(
    `  swig ATA delta:       ${mutatedBefore} -> ${mutatedAfter} (spent ${mutatedSpent})`,
  );
  console.log(
    `- replacements applied: ${prepared.totalReplacements} across ${prepared.batches.length} batch(es)`,
  );
  console.log(
    `- expected per-tx spend target: ${relayAmount} (baseline actual ${baselineSpent}, swig actual ${mutatedSpent})`,
  );
  console.log(
    'Success: modified Relay quote executed via reusable Swig adapter.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
