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

const SURFPOOL_RPC = process.env.SURFPOOL_RPC ?? 'http://127.0.0.1:8899';

const RELAY_API = 'https://api.relay.link';
const RELAY_SOLANA_CHAIN_ID = 792703809;
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL_MINT = '11111111111111111111111111111111';
const BASE_CHAIN_ID = 8453;
const BASE_USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const SWIG_PROGRAM_ID = new PublicKey(
  'swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB',
);

interface RelayQuoteBody {
  user: string;
  originCurrency: string;
  amount: string;
}

type RelayQuoteResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number; data: any };

interface RelayInstruction {
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string;
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

function instructionSigners(instructions: RelayInstruction[]): string[] {
  return [
    ...new Set(
      instructions.flatMap((ix) =>
        ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey),
      ),
    ),
  ];
}

function toWeb3Instruction(ix: RelayInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.keys.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(ix.data, 'hex'),
  });
}

async function callRelayQuote(body: RelayQuoteBody): Promise<RelayQuoteResult> {
  const quoteBody = {
    user: body.user,
    originChainId: RELAY_SOLANA_CHAIN_ID,
    destinationChainId: BASE_CHAIN_ID,
    originCurrency: body.originCurrency,
    destinationCurrency: BASE_USDT,
    amount: body.amount,
    tradeType: 'EXACT_INPUT',
    recipient: '0x000000000000000000000000000000000000dEaD',
  };

  const response = await fetch(`${RELAY_API}/quote/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteBody),
  });

  const data: any = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function extractInstructions(data: any): RelayInstruction[] {
  return (data?.steps ?? [])
    .flatMap((step: any) => step.items ?? [])
    .flatMap((item: any) => item.data?.instructions ?? []);
}

function printQuoteResult(label: string, result: RelayQuoteResult): void {
  if (result.ok) {
    const ixs = extractInstructions(result.data);
    if (!ixs.length) {
      console.log(`${label}: OK (no raw instructions returned)`);
      return;
    }
    console.log(
      `${label}: OK (${ixs.length} ix, signers: ${instructionSigners(ixs).join(', ')})`,
    );
    return;
  }

  const errorCode = result.data?.errorCode ?? 'UNKNOWN';
  const message = result.data?.message ?? 'Unknown error';
  console.log(`${label}: FAILED (${result.status} ${errorCode} - ${message})`);
}

async function main() {
  const connection = new Connection(SURFPOOL_RPC, 'confirmed');
  const authority = Keypair.generate();

  console.log(`Surfpool RPC: ${SURFPOOL_RPC}`);
  console.log(`Authority:    ${authority.publicKey.toBase58()}`);

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
  const swigWalletAddress = await getSwigWalletAddress(swig);

  const fundSwigSig = await connection.requestAirdrop(
    swigWalletAddress,
    1_000_000_000,
  );
  await connection.confirmTransaction(fundSwigSig, 'confirmed');

  console.log(`Swig PDA:      ${swigAddress.toBase58()}`);
  console.log(`Swig wallet:   ${swigWalletAddress.toBase58()}`);
  console.log(
    `Swig wallet on curve: ${PublicKey.isOnCurve(swigWalletAddress.toBytes())}`,
  );
  console.log();

  console.log('USDT quote behavior (mainnet route lookup):');
  const randomOnCurveUser = Keypair.generate().publicKey;
  const randomOffCurveUser = PublicKey.findProgramAddressSync(
    [Buffer.from('relay-offcurve-check'), authority.publicKey.toBuffer()],
    SWIG_PROGRAM_ID,
  )[0];

  const usdtRandomOnCurveQuote = await callRelayQuote({
    user: randomOnCurveUser.toBase58(),
    originCurrency: USDT_MINT,
    amount: '1000000',
  });
  const usdtRandomOffCurveQuote = await callRelayQuote({
    user: randomOffCurveUser.toBase58(),
    originCurrency: USDT_MINT,
    amount: '1000000',
  });
  const usdtAuthorityQuote = await callRelayQuote({
    user: authority.publicKey.toBase58(),
    originCurrency: USDT_MINT,
    amount: '1000000',
  });
  const usdtSwigQuote = await callRelayQuote({
    user: swigWalletAddress.toBase58(),
    originCurrency: USDT_MINT,
    amount: '1000000',
  });
  printQuoteResult('- random on-curve user', usdtRandomOnCurveQuote);
  printQuoteResult('- random off-curve user', usdtRandomOffCurveQuote);
  printQuoteResult('- user = authority', usdtAuthorityQuote);
  printQuoteResult('- user = swig wallet', usdtSwigQuote);
  console.log();

  console.log(
    'SOL quote behavior (same Relay program, off-curve user accepted):',
  );
  const solSwigQuote = await callRelayQuote({
    user: swigWalletAddress.toBase58(),
    originCurrency: SOL_MINT,
    amount: '1000000',
  });
  printQuoteResult('- user = swig wallet', solSwigQuote);
  console.log();

  if (!solSwigQuote.ok) {
    console.log('Cannot continue execution tests because SOL quote failed.');
    return;
  }

  const relayIxs = extractInstructions(solSwigQuote.data);
  if (!relayIxs.length) {
    console.log(
      'SOL quote returned no raw instructions; cannot test execution.',
    );
    return;
  }

  const directTx = await buildTx(
    connection,
    authority.publicKey,
    relayIxs.map(toWeb3Instruction),
  );
  directTx.sign(authority);

  try {
    directTx.serialize();
    console.log(
      'Direct submit (swig wallet user): serialize unexpectedly succeeded',
    );
  } catch (error: any) {
    console.log(
      `Direct submit (swig wallet user): serialize failed as expected -> ${error.message}`,
    );
  }

  const authorityRole = swig.findRolesByEd25519SignerPk(authority.publicKey)[0];
  if (!authorityRole) {
    throw new Error('Authority role not found on newly created swig account');
  }

  const wrappedIxs = await getSignInstructions(
    swig,
    authorityRole.id,
    relayIxs.map(toWeb3Instruction),
  );

  const wrappedTx = await buildTx(connection, authority.publicKey, wrappedIxs);
  wrappedTx.sign(authority);

  try {
    wrappedTx.serialize();
    console.log('Wrapped submit (swig getSignInstructions): serialize OK');
  } catch (error: any) {
    console.log(
      `Wrapped submit (swig getSignInstructions): serialize FAILED -> ${error.message}`,
    );
  }

  const simulation = await connection.simulateTransaction(wrappedTx);

  console.log(
    `Wrapped submit (swig getSignInstructions): simulation err -> ${JSON.stringify(simulation.value.err)}`,
  );
  if (simulation.value.logs?.length) {
    console.log('Simulation logs (first 8):');
    for (const line of simulation.value.logs.slice(0, 8)) {
      console.log(`  ${line}`);
    }
  }

  if (simulation.value.err === null) {
    try {
      const sig = await connection.sendRawTransaction(wrappedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');
      console.log(`Wrapped submit (swig getSignInstructions): sent tx ${sig}`);
    } catch (error: any) {
      console.log(
        `Wrapped submit (swig getSignInstructions): send failed -> ${error.message}`,
      );
    }
  }
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
