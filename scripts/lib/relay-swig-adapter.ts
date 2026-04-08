import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  type AddressLookupTableAccount,
  type Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { getSignInstructions, type Swig } from '@swig-wallet/classic';

const RELAY_API = 'https://api.relay.link';

export interface RelayQuoteRequest {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  recipient: string;
}

export interface RelayInstructionAccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface RelayInstruction {
  programId: string;
  keys: RelayInstructionAccountMeta[];
  data: string;
}

export interface RelayQuoteItemData {
  instructions?: RelayInstruction[];
  txData?: string;
  addressLookupTableAddresses?: string[];
  [key: string]: unknown;
}

export interface RelayQuoteItem {
  status?: string;
  data?: RelayQuoteItemData;
  [key: string]: unknown;
}

export interface RelayQuoteStep {
  id?: string;
  action?: string;
  kind?: string;
  items?: RelayQuoteItem[];
  [key: string]: unknown;
}

export interface RelayQuoteResponse {
  steps?: RelayQuoteStep[];
  requestId?: string;
  [key: string]: unknown;
}

export interface FetchRelayQuoteOptions {
  apiBaseUrl?: string;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface RelayInstructionBatch {
  stepIndex: number;
  itemIndex: number;
  stepId?: string;
  stepAction?: string;
  source: 'instructions' | 'txData';
  instructions: TransactionInstruction[];
}

export interface ResolveRelayInstructionsOptions {
  connection?: Connection;
}

export interface RelayAccountRewrite {
  from: string | PublicKey;
  to: string | PublicKey;
}

export type RelayAccountRewrites =
  | RelayAccountRewrite[]
  | Map<string, string | PublicKey>
  | Record<string, string | PublicKey>;

export interface PreparedSwigRelayBatch {
  stepIndex: number;
  itemIndex: number;
  stepId?: string;
  stepAction?: string;
  source: 'instructions' | 'txData';
  originalInstructions: TransactionInstruction[];
  rewrittenInstructions: TransactionInstruction[];
  swigSignInstructions: TransactionInstruction[];
  replacements: number;
}

export interface PrepareRelayRouteForSwigResult {
  batches: PreparedSwigRelayBatch[];
  totalReplacements: number;
}

export async function fetchRelayQuote(
  request: RelayQuoteRequest,
  options: FetchRelayQuoteOptions = {},
): Promise<RelayQuoteResponse> {
  const response = await fetch(`${options.apiBaseUrl ?? RELAY_API}/quote/v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey
        ? {
            Authorization: `Bearer ${options.apiKey}`,
          }
        : {}),
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(
      `Relay quote failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }

  return data as RelayQuoteResponse;
}

export function relayInstructionToWeb3(
  instruction: RelayInstruction,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(instruction.data, 'hex'),
  });
}

export function getBatchSignerPubkeys(batch: RelayInstructionBatch): string[] {
  return [
    ...new Set(
      batch.instructions.flatMap((ix) =>
        ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58()),
      ),
    ),
  ];
}

async function decodeRelayTxDataToInstructions(
  txData: string,
  options: ResolveRelayInstructionsOptions,
): Promise<TransactionInstruction[]> {
  const txBytes = Buffer.from(txData, 'base64');

  let versioned: VersionedTransaction | null = null;
  try {
    versioned = VersionedTransaction.deserialize(txBytes);
  } catch {
    versioned = null;
  }

  if (versioned) {
    const lookups = versioned.message.addressTableLookups;
    let lookupTableAccounts: AddressLookupTableAccount[] = [];

    if (lookups.length > 0) {
      if (!options.connection) {
        throw new Error(
          'Cannot decode Relay txData with lookup tables without a Connection',
        );
      }

      const fetched = await Promise.all(
        lookups.map((lookup) =>
          options.connection!.getAddressLookupTable(lookup.accountKey),
        ),
      );

      const missing = fetched
        .map((res, i) => ({
          value: res.value,
          accountKey: lookups[i]!.accountKey.toBase58(),
        }))
        .filter((x) => !x.value)
        .map((x) => x.accountKey);

      if (missing.length > 0) {
        throw new Error(
          `Missing lookup table accounts for txData decode: ${missing.join(', ')}`,
        );
      }

      lookupTableAccounts = fetched
        .map((res) => res.value)
        .filter(Boolean) as AddressLookupTableAccount[];
    }

    const decompiled = TransactionMessage.decompile(
      versioned.message,
      lookupTableAccounts.length
        ? { addressLookupTableAccounts: lookupTableAccounts }
        : undefined,
    );

    return decompiled.instructions;
  }

  const legacy = Transaction.from(txBytes);
  return legacy.instructions;
}

export async function resolveRelayQuoteInstructions(
  quote: RelayQuoteResponse,
  options: ResolveRelayInstructionsOptions = {},
): Promise<RelayInstructionBatch[]> {
  const steps = quote.steps ?? [];
  const batches: RelayInstructionBatch[] = [];

  for (const [stepIndex, step] of steps.entries()) {
    const items = step.items ?? [];
    for (const [itemIndex, item] of items.entries()) {
      const itemData = item.data;
      if (!itemData) continue;

      if (itemData.instructions && itemData.instructions.length > 0) {
        batches.push({
          stepIndex,
          itemIndex,
          stepId: step.id,
          stepAction: step.action,
          source: 'instructions',
          instructions: itemData.instructions.map(relayInstructionToWeb3),
        });
        continue;
      }

      if (itemData.txData) {
        const instructions = await decodeRelayTxDataToInstructions(
          itemData.txData,
          options,
        );
        batches.push({
          stepIndex,
          itemIndex,
          stepId: step.id,
          stepAction: step.action,
          source: 'txData',
          instructions,
        });
      }
    }
  }

  return batches;
}

function toPublicKey(value: string | PublicKey): PublicKey {
  return typeof value === 'string' ? new PublicKey(value) : value;
}

function normalizeRewrites(
  rewrites: RelayAccountRewrites,
): Map<string, PublicKey> {
  if (rewrites instanceof Map) {
    return new Map(
      [...rewrites.entries()].map(([from, to]) => [
        toPublicKey(from).toBase58(),
        toPublicKey(to),
      ]),
    );
  }

  if (Array.isArray(rewrites)) {
    return new Map(
      rewrites.map((x) => [toPublicKey(x.from).toBase58(), toPublicKey(x.to)]),
    );
  }

  return new Map(
    Object.entries(rewrites).map(([from, to]) => [
      toPublicKey(from).toBase58(),
      toPublicKey(to),
    ]),
  );
}

export function rewriteTransactionInstructions(
  instructions: TransactionInstruction[],
  rewrites: RelayAccountRewrites,
): { instructions: TransactionInstruction[]; replacements: number } {
  const rewriteMap = normalizeRewrites(rewrites);
  let replacements = 0;

  const rewritten = instructions.map((ix) => {
    const replacementProgramId = rewriteMap.get(ix.programId.toBase58());
    if (replacementProgramId) replacements += 1;

    const keys = ix.keys.map((key) => {
      const replacement = rewriteMap.get(key.pubkey.toBase58());
      if (!replacement) {
        return {
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        };
      }

      replacements += 1;
      return {
        pubkey: replacement,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      };
    });

    return new TransactionInstruction({
      programId: replacementProgramId ?? ix.programId,
      keys,
      data: Buffer.from(ix.data),
    });
  });

  return { instructions: rewritten, replacements };
}

export function buildUserAndAtaRewrites(args: {
  fromUser: string | PublicKey;
  toUser: string | PublicKey;
  mints?: Array<string | PublicKey>;
}): RelayAccountRewrite[] {
  const fromUser = toPublicKey(args.fromUser);
  const toUser = toPublicKey(args.toUser);
  const rewrites: RelayAccountRewrite[] = [{ from: fromUser, to: toUser }];

  for (const mintInput of args.mints ?? []) {
    const mint = toPublicKey(mintInput);
    const fromAta = getAssociatedTokenAddressSync(
      mint,
      fromUser,
      !PublicKey.isOnCurve(fromUser.toBytes()),
    );
    const toAta = getAssociatedTokenAddressSync(
      mint,
      toUser,
      !PublicKey.isOnCurve(toUser.toBytes()),
    );
    rewrites.push({ from: fromAta, to: toAta });
  }

  return rewrites;
}

export async function prepareRelayRouteForSwig(args: {
  quote: RelayQuoteResponse;
  swig: Swig;
  roleId: number;
  rewrites: RelayAccountRewrites;
  resolveOptions?: ResolveRelayInstructionsOptions;
}): Promise<PrepareRelayRouteForSwigResult> {
  const rawBatches = await resolveRelayQuoteInstructions(
    args.quote,
    args.resolveOptions,
  );

  const prepared: PreparedSwigRelayBatch[] = [];
  let totalReplacements = 0;

  for (const batch of rawBatches) {
    const rewritten = rewriteTransactionInstructions(
      batch.instructions,
      args.rewrites,
    );
    const swigSignInstructions = await getSignInstructions(
      args.swig,
      args.roleId,
      rewritten.instructions,
    );

    totalReplacements += rewritten.replacements;
    prepared.push({
      stepIndex: batch.stepIndex,
      itemIndex: batch.itemIndex,
      stepId: batch.stepId,
      stepAction: batch.stepAction,
      source: batch.source,
      originalInstructions: batch.instructions,
      rewrittenInstructions: rewritten.instructions,
      swigSignInstructions,
      replacements: rewritten.replacements,
    });
  }

  return {
    batches: prepared,
    totalReplacements,
  };
}
