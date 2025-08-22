import { hexToBytes } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  address,
  getBytesEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
} from '@solana/kit';
import { SWIG_PROGRAM_ADDRESS_STRING } from './consts';
import { SolPublicKey } from './solana';

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Utility for deriving a Swig PDA (async)
 * @param id Swig ID
 * @returns Promise<[Address, number]> (address, bump)
 */
async function findSwigPda(id: Uint8Array) {
  return await getProgramDerivedAddress({
    programAddress: address(SWIG_PROGRAM_ADDRESS_STRING),
    seeds: [getUtf8Encoder().encode('swig'), getBytesEncoder().encode(id)],
  });
}

/**
 * Utility for deriving a Swig PDA (async)
 * @param id Swig ID
 * @returns Promise<[Address, number]> (address, bump)
 */
export async function findSwigPdaRaw(
  id: Uint8Array,
): Promise<[SolPublicKey, number]> {
  const [address, bump] = await findSwigPda(id);

  return [new SolPublicKey(address), bump];
}

/**
 * Utility for deriving a Swig SubAccount PDA (async)
 * @param swigId Swig ID
 * @param roleId number
 * @returns Promise<[Address, number]> (address, bump)
 */
async function findSwigSubAccountPda(swigId: Uint8Array, roleId: number) {
  const roleIdU32 = new Uint8Array(4);

  const view = new DataView(roleIdU32.buffer);
  view.setUint32(0, roleId, true);

  return await getProgramDerivedAddress({
    programAddress: address(SWIG_PROGRAM_ADDRESS_STRING),
    seeds: [
      getUtf8Encoder().encode('sub-account'),
      getBytesEncoder().encode(swigId),
      getBytesEncoder().encode(roleIdU32),
    ],
  });
}

/**
 * Utility for deriving a Swig SubAccount PDA (async)
 * @param swigId Swig ID
 * @param roleId number
 * @returns Promise<[Address, number]> (address, bump)
 */
export async function findSwigSubAccountPdaRaw(
  swigId: Uint8Array,
  roleId: number,
): Promise<[SolPublicKey, number]> {
  const [address, bump] = await findSwigSubAccountPda(swigId, roleId);
  return [new SolPublicKey(address), bump];
}

export function compressedPubkeyToAddress(
  compressed: Uint8Array | string,
): Uint8Array {
  const bytes =
    typeof compressed === 'string'
      ? hexToBytes(unprefixedHexString(compressed))
      : compressed;

  // Handle both 32-byte (without prefix) and 33-byte (with prefix) compressed keys
  const compressedBytes =
    bytes.length === 32
      ? new Uint8Array([0x02, ...bytes]) // Add prefix for 32-byte keys
      : bytes.length === 33
        ? bytes // Use as-is for 33-byte keys (already has prefix)
        : getUnprefixedSecpBytes(compressed, 33);

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

/**
 * Detects the format of an EVM public key
 * @param pubkey Public key as Uint8Array or hex string
 * @returns 'compressed' | 'uncompressed' | 'invalid'
 */
export function detectPubkeyFormat(
  pubkey: Uint8Array | string,
): 'compressed' | 'uncompressed' | 'invalid' {
  const bytes =
    typeof pubkey === 'string'
      ? hexToBytes(unprefixedHexString(pubkey))
      : pubkey;

  // Check for uncompressed format: 65 bytes starting with 0x04
  if (bytes.length === 65 && bytes[0] === 0x04) {
    return 'uncompressed';
  }

  // Check for uncompressed format: 64 bytes without prefix
  if (bytes.length === 64) {
    return 'uncompressed';
  }

  // Check for compressed format: 33 bytes starting with 0x02 or 0x03
  if (bytes.length === 33 && (bytes[0] === 0x02 || bytes[0] === 0x03)) {
    return 'compressed';
  }

  // Check for compressed format: 32 bytes without prefix
  if (bytes.length === 32) {
    return 'compressed';
  }

  return 'invalid';
}

/**
 * Converts a compressed EVM public key to an Ethereum address
 * @param compressed Compressed public key (32 bytes without prefix or 33 bytes with 0x02/0x03 prefix)
 * @returns 20-byte Ethereum address
 */
export function uncompressedPubkeyToAddress(
  uncompressed: Uint8Array | string,
): Uint8Array {
  const uncompressedBytes = getUnprefixedSecpBytes(uncompressed, 64);

  const hash = keccak_256(uncompressedBytes);

  return hash.slice(12);
}

/**
 * Compresses an uncompressed EVM public key
 * @param uncompressed Uncompressed public key (64 bytes without prefix or 65 bytes with 0x04 prefix)
 * @returns 33-byte compressed public key
 */
export function compressPubkey(uncompressed: Uint8Array | string): Uint8Array {
  const uncompressedBytes = getUnprefixedSecpBytes(uncompressed, 64);

  const point = secp256k1.ProjectivePoint.fromHex(
    new Uint8Array([0x04, ...uncompressedBytes]),
  );

  return point.toRawBytes(true);
}

/**
 * Decompresses a compressed EVM public key
 * @param compressed Compressed public key (32 bytes without prefix or 33 bytes with 0x02/0x03 prefix)
 * @returns 64-byte uncompressed public key (without 0x04 prefix)
 */
export function decompressPubkey(compressed: Uint8Array | string): Uint8Array {
  const bytes =
    typeof compressed === 'string'
      ? hexToBytes(unprefixedHexString(compressed))
      : compressed;

  // Handle both 32-byte (without prefix) and 33-byte (with prefix) compressed keys
  const compressedBytes =
    bytes.length === 32
      ? new Uint8Array([0x02, ...bytes]) // Add prefix for 32-byte keys
      : bytes.length === 33
        ? bytes // Use as-is for 33-byte keys (already has prefix)
        : getUnprefixedSecpBytes(compressed, 33);

  const point = secp256k1.ProjectivePoint.fromHex(compressedBytes);

  return point.toRawBytes(false).slice(1);
}
