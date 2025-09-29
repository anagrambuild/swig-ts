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
import { SolPublicKey, type SolPublicKeyData } from './solana';

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

async function findSwigSystemAddressPda(swigAddress: SolPublicKeyData) {
  const swigAddressBytes = new SolPublicKey(swigAddress).toBytes();
  return await getProgramDerivedAddress({
    programAddress: address(SWIG_PROGRAM_ADDRESS_STRING),
    seeds: [
      getUtf8Encoder().encode('swig-wallet-address'),
      getBytesEncoder().encode(swigAddressBytes),
    ],
  });
}

export async function findSwigSystemAddressPdaRaw(
  swigAddress: SolPublicKeyData,
): Promise<[SolPublicKey, number]> {
  const [address, bump] = await findSwigSystemAddressPda(swigAddress);

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
