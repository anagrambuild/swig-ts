import { hexToBytes } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getProgramDerivedAddress,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Commitment,
  type IAccountMeta,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from '@solana/kit';
import bs58 from 'bs58';
import { SWIG_PROGRAM_ADDRESS } from './consts';

/**
 * Creates a SWIG Instruction with the swig program address
 */
export function swigInstruction<T extends IAccountMeta[]>(
  accounts: T,
  data: Uint8Array,
) {
  return {
    programAddress: SWIG_PROGRAM_ADDRESS,
    keys: accounts,
    data,
  };
}

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

// Conversion utility: kit-native { address, role } to Solana-compatible { pubkey, isSigner, isWritable }
function convertKitAccountMeta(meta: { address: string; role: number }) {
  if (
    !meta.address ||
    meta.address === 'undefined' ||
    (typeof meta.address === 'string' && meta.address.length < 32)
  ) {
    console.error(
      '[kit][FATAL] Invalid address in convertKitAccountMeta:',
      JSON.stringify(meta),
      'stack:',
      new Error().stack,
    );
    throw new Error(
      '[kit][FATAL] Invalid address in convertKitAccountMeta: ' +
        JSON.stringify(meta) +
        ' stack: ' +
        new Error().stack,
    );
  }
  console.log('[kit][debug] convertKitAccountMeta address:', meta.address);
  let pubkey;
  if (typeof meta.address === 'string') {
    try {
      pubkey = bs58.decode(meta.address);
    } catch (e) {
      throw e;
    }
  } else {
    throw new Error('Invalid address type for bs58.decode');
  }
  // AccountRole: 0 = READONLY, 1 = WRITABLE, 2 = READONLY_SIGNER, 3 = WRITABLE_SIGNER
  const isWritable = meta.role === 1 || meta.role === 3;
  const isSigner = meta.role === 2 || meta.role === 3;
  return {
    pubkey,
    isSigner,
    isWritable,
  };
}

// Validation utility: ensure all kit-native account metas are valid before conversion
function validateKitAccountMetas(metas: { address: string; role: number }[]) {
  metas.forEach((meta, i) => {
    if (
      !meta ||
      typeof meta.address !== 'string' ||
      meta.address === undefined ||
      meta.address === 'undefined' ||
      meta.address.trim() === ''
    ) {
      throw new Error(
        `[kit][error] Invalid kit account meta at index ${i}: ${JSON.stringify(meta)}`,
      );
    }
  });
}

function convertKitInstruction(ix: {
  programAddress: string;
  keys: { address: string; role: number }[];
  data: Uint8Array;
}) {
  ix.keys.forEach((meta, i) => {
    if (
      !meta.address ||
      meta.address === 'undefined' ||
      (typeof meta.address === 'string' && meta.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] Invalid address in convertKitInstruction:',
        JSON.stringify(meta),
        'at index',
        i,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] Invalid address in convertKitInstruction: ' +
          JSON.stringify(meta) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  validateKitAccountMetas(ix.keys);
  return {
    programId: ix.programAddress,
    keys: ix.keys.map(convertKitAccountMeta),
    data: ix.data,
  };
}

function logAllFields(obj: any, prefix = '[kit][debug][deep]') {
  // This function is for deep debugging and can be removed if not needed
}

export async function createLegacyTransaction(
  rpc: Rpc<SolanaRpcApi>,
  instructions: any[], // kit-native instructions
  feePayer: TransactionSigner,
  options?: { commitment?: Commitment },
) {
  // Guard: log and check all meta.address values in all instructions
  instructions.forEach(function (ix, i) {
    if (ix && Array.isArray(ix.keys)) {
      (ix.keys as Array<{ address: string; role: number }>).forEach(
        function (m, j) {
          console.log(
            `[kit][debug] createLegacyTransaction meta.address [ix ${i} key ${j}]:`,
            m.address,
          );
          if (
            !m.address ||
            m.address === 'undefined' ||
            (typeof m.address === 'string' && m.address.length < 32)
          ) {
            throw new Error(
              `[kit][guard] Invalid address in createLegacyTransaction: ${m.address}`,
            );
          }
        },
      );
    }
  });

  const {
    value: { blockhash, lastValidBlockHeight },
  } = await rpc.getLatestBlockhash(options).send();

  // Patch: log and guard the full array of account metas for every instruction before building the transaction message
  instructions.forEach((ix, i) => {
    if (ix && Array.isArray(ix.keys)) {
      ix.keys.forEach((meta: any, j: number) => {
        if (
          !meta.address ||
          meta.address === 'undefined' ||
          (typeof meta.address === 'string' && meta.address.length < 32)
        ) {
          console.error(
            '[kit][FATAL] createLegacyTransaction: FINAL meta.address is undefined:',
            meta,
            'at ix',
            i,
            'key',
            j,
            'stack:',
            new Error().stack,
          );
          throw new Error(
            '[kit][FATAL] createLegacyTransaction: FINAL meta.address is undefined: ' +
              JSON.stringify(meta) +
              ' at ix ' +
              i +
              ' key ' +
              j +
              ' stack: ' +
              new Error().stack,
          );
        }
      });
    }
  });

  // Convert kit-native instructions to Solana-compatible instructions
  const solanaInstructions: any[] = instructions.map(convertKitInstruction);

  // Patch: log and guard all addresses in all solanaInstructions before building the transaction message
  solanaInstructions.forEach((ix, i) => {
    if (ix && Array.isArray(ix.keys)) {
      ix.keys.forEach((m: any, j: number) => {
        if (
          !m.pubkey ||
          m.pubkey === 'undefined' ||
          (typeof m.pubkey === 'string' && m.pubkey.length < 32)
        ) {
          console.error(
            '[kit][FATAL] createLegacyTransaction: solanaInstructions meta.pubkey is undefined:',
            m,
            'at ix',
            i,
            'key',
            j,
            'stack:',
            new Error().stack,
          );
          throw new Error(
            '[kit][FATAL] createLegacyTransaction: solanaInstructions meta.pubkey is undefined: ' +
              JSON.stringify(m) +
              ' at ix ' +
              i +
              ' key ' +
              j +
              ' stack: ' +
              new Error().stack,
          );
        }
      });
    }
  });

  // Build the transaction message
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        tx,
      ),
    (tx) => appendTransactionMessageInstructions(solanaInstructions, tx),
  );

  const signers: TransactionSigner[] = [feePayer];

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  return signedTransaction;
}

/**
 * Utility for deriving a Swig PDA (async)
 * @param id Swig ID
 * @returns Promise<[Address, number]> (address, bump)
 */
export async function findSwigPda(id: Uint8Array): Promise<[Address, number]> {
  const result = await getProgramDerivedAddress({
    programAddress: SWIG_PROGRAM_ADDRESS,
    seeds: [Buffer.from('swig'), Buffer.from(id)],
  });
  if (
    !result[0] ||
    result[0] === 'undefined' ||
    (typeof result[0] === 'string' && result[0].length < 32)
  ) {
    console.error(
      '[kit][FATAL] findSwigPda: returned address is undefined:',
      result,
      'stack:',
      new Error().stack,
    );
    throw new Error(
      '[kit][FATAL] findSwigPda: returned address is undefined: ' +
        JSON.stringify(result) +
        ' stack: ' +
        new Error().stack,
    );
  }
  return result as unknown as [Address, number];
}

/**
 * Utility for deriving a Swig SubAccount PDA (async)
 * @param swigId Swig ID
 * @param roleId number
 * @returns Promise<[Address, number]> (address, bump)
 */
export async function findSwigSubAccountPda(
  swigId: Uint8Array,
  roleId: number,
): Promise<[Address, number]> {
  const roleIdU32 = new Uint8Array(4);

  const view = new DataView(roleIdU32.buffer);
  view.setUint32(0, roleId, true);

  return (await getProgramDerivedAddress({
    programAddress: SWIG_PROGRAM_ADDRESS,
    seeds: [
      Buffer.from('sub-account'),
      Buffer.from(swigId),
      Buffer.from(roleIdU32),
    ],
  })) as unknown as [Address, number];
}

export function compressedPubkeyToAddress(
  compressed: Uint8Array | string,
): Uint8Array {
  const compressedBytes = getUnprefixedSecpBytes(compressed, 33);

  const point = secp256k1.ProjectivePoint.fromHex(compressedBytes);

  const uncompressed = point.toRawBytes(false).slice(1);

  const hash = keccak_256(uncompressed);

  return hash.slice(12);
}

export function getUnprefixedSecpBytes(
  hexOrBytes: Uint8Array | string,
  length: 64 | 33 | 32 | 20,
): Uint8Array {
  const bytes =
    typeof hexOrBytes === 'string'
      ? hexToBytes(unprefixedHexString(hexOrBytes))
      : hexOrBytes;
  return bytes.length === length + 1 ? bytes.slice(1) : bytes;
}

export function unprefixedHexString(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
