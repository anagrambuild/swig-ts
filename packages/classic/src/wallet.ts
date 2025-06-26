import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { utf8ToBytes } from '@noble/hashes/utils';
import type { SigningFn } from './authority';
import type { SigningResult } from './authority/instructions/interface';
import { getUnprefixedSecpBytes } from './utils';

/**
 * Get {@link SigningFn} for Secp268k1-based Private key
 * @param privateKey Secp256k1 Private key
 * @returns SigningFn
 */
export function getSigningFnForSecp256k1PrivateKey(
  privateKey: Uint8Array | string,
): SigningFn {
  return async (message: Uint8Array, counter?: number) => {
    const hash = keccak_256(message);
    const sig = secp256k1.sign(hash, getUnprefixedSecpBytes(privateKey, 32), {
      lowS: true,
    });

    const signature = new Uint8Array(65);
    signature.set(sig.toCompactRawBytes()); // 64-bytes
    signature.set(Uint8Array.from([sig.recovery + 27]), 64);

    return { signature };
  };
}

/**
 * Get `personal-sign` prefix for evm based wallets
 * @param messageLen Length of the message to be signed
 * @returns Prefix bytes
 */
export function getEvmPersonalSignPrefix(messageLen: number): Uint8Array {
  return utf8ToBytes(`\x19Ethereum Signed Message:\n${messageLen}`);
}

export async function getWebAuthnPrefix(
  clientJson: Uint8Array,
  authData: Uint8Array,
  counter: number,
): Promise<Uint8Array> {
  // Compute SHA256 of clientDataJSON instead of sending the full JSON
  const clientDataJsonHash = await crypto.subtle.digest('SHA-256', clientJson);
  const clientDataJsonHashBytes = new Uint8Array(clientDataJsonHash);

  // Parse clientDataJSON to extract challenge for counter verification
  let challengeExcerpt = new Uint8Array(0);
  try {
    const clientDataStr = new TextDecoder().decode(clientJson);
    const clientData = JSON.parse(clientDataStr);

    if (clientData.challenge) {
      // Decode base64url challenge
      const challengeB64 = clientData.challenge
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const challengePadded =
        challengeB64 + '='.repeat((4 - (challengeB64.length % 4)) % 4);
      const challengeBytes = new Uint8Array(
        atob(challengePadded)
          .split('')
          .map((c) => c.charCodeAt(0)),
      );

      // Extract the full challenge that should contain our counter
      // We'll send the entire challenge to ensure the counter is found
      challengeExcerpt = challengeBytes;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse clientDataJSON for counter verification: ${error}`,
    );
  }

  if (challengeExcerpt.length === 0) {
    throw new Error(
      'No challenge found in clientDataJSON for counter verification',
    );
  }

  // Calculate total size: 2 (auth_type) + 2 (auth_len) + authData + 32 (hash) + 4 (counter) + 2 (excerpt_len) + excerpt
  const totalSize = 4 + authData.length + 32 + 4 + 2 + challengeExcerpt.length;
  const prefix = new Uint8Array(totalSize);

  const authDataLen = new Uint8Array(2);
  const authDataLenView = new DataView(authDataLen.buffer);
  authDataLenView.setUint16(0, authData.length, true);

  let offset = 0;
  // Skip auth_type (2 bytes, already zeroed)
  offset += 2;

  // Set auth_len
  prefix.set(authDataLen, offset);
  offset += 2;

  // Set auth_data
  prefix.set(authData, offset);
  offset += authData.length;

  // Set clientDataJSON hash
  prefix.set(clientDataJsonHashBytes, offset);
  offset += 32;

  // Add counter (4 bytes, little-endian)
  const counterBytes = new Uint8Array(4);
  const counterView = new DataView(counterBytes.buffer);
  counterView.setUint32(0, counter, true);
  prefix.set(counterBytes, offset);
  offset += 4;

  // Add challenge excerpt length (2 bytes, little-endian)
  const excerptLenBytes = new Uint8Array(2);
  const excerptLenView = new DataView(excerptLenBytes.buffer);
  excerptLenView.setUint16(0, challengeExcerpt.length, true);
  prefix.set(excerptLenBytes, offset);
  offset += 2;

  // Add challenge excerpt
  prefix.set(challengeExcerpt, offset);

  return prefix;
}

/**
 * this function does nothing. just implementing the interface of [SigningFn]
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function dummySigningFn(
  _: Uint8Array,
  __?: number,
): Promise<SigningResult> {
  return { signature: new Uint8Array(0) };
}
