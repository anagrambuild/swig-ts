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
  console.log('🔍 WebAuthn Debug: Starting getWebAuthnPrefix');
  console.log('🔍 WebAuthn Debug: clientJson length:', clientJson.length);
  console.log('🔍 WebAuthn Debug: authData length:', authData.length);
  console.log('🔍 WebAuthn Debug: counter:', counter);
  
  // Parse clientDataJSON to extract origin
  let origin = '';
  
  try {
    const clientDataStr = new TextDecoder().decode(clientJson);
    console.log('🔍 WebAuthn Debug: clientDataJSON:', clientDataStr);
    const clientData = JSON.parse(clientDataStr);

    // Extract origin
    if (!clientData.origin) {
      throw new Error('No origin found in clientDataJSON');
    }
    origin = clientData.origin;
    console.log('🔍 WebAuthn Debug: extracted origin:', origin);

    // Verify that the challenge in clientDataJSON matches what we expect
    // The challenge should be base64url(computed_hash + counter)
    if (clientData.challenge) {
      console.log('🔍 WebAuthn Debug: challenge from clientData:', clientData.challenge);
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
      
      console.log('🔍 WebAuthn Debug: decoded challenge bytes length:', challengeBytes.length);
      console.log('🔍 WebAuthn Debug: challenge bytes (first 16):', Array.from(challengeBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Verify the challenge is 36 bytes (32 bytes hash + 4 bytes counter)
      if (challengeBytes.length !== 36) {
        throw new Error(`Invalid challenge length: expected 36 bytes, got ${challengeBytes.length}`);
      }
      
      // Verify the counter matches
      const challengeCounter = new DataView(challengeBytes.buffer, challengeBytes.byteOffset + 32, 4).getUint32(0, true);
      console.log('🔍 WebAuthn Debug: counter from challenge:', challengeCounter, 'expected:', counter);
      if (challengeCounter !== counter) {
        throw new Error(`Counter mismatch: expected ${counter}, got ${challengeCounter}`);
      }
    }
  } catch (error) {
    console.error('🔍 WebAuthn Debug: Error parsing clientDataJSON:', error);
    throw new Error(
      `Failed to parse clientDataJSON: ${error}`,
    );
  }

  // Import huffman encoder
  const { HuffmanEncoder } = await import('./utils/huffman');
  
  // Encode origin URL using huffman encoding
  console.log('🔍 WebAuthn Debug: Creating huffman encoder for origin:', origin);
  const encoder = new HuffmanEncoder(origin);
  const huffmanTree = encoder.getTreeData();
  const huffmanEncodedOrigin = encoder.encode(origin);

  console.log('🔍 WebAuthn Debug: huffman tree length:', huffmanTree.length);
  console.log('🔍 WebAuthn Debug: huffman tree (first 16 bytes):', Array.from(huffmanTree.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  console.log('🔍 WebAuthn Debug: huffman encoded origin length:', huffmanEncodedOrigin.length);
  console.log('🔍 WebAuthn Debug: huffman encoded origin:', Array.from(huffmanEncodedOrigin).map(b => b.toString(16).padStart(2, '0')).join(' '));

  // Test decode to verify encoding
  try {
    const testDecoded = encoder.decode(huffmanEncodedOrigin);
    console.log('🔍 WebAuthn Debug: test decode result:', testDecoded);
    if (testDecoded !== origin) {
      console.error('🔍 WebAuthn Debug: ENCODING ERROR - decoded does not match original!');
      console.error('🔍 WebAuthn Debug: original:', origin);
      console.error('🔍 WebAuthn Debug: decoded:', testDecoded);
    } else {
      console.log('🔍 WebAuthn Debug: ✅ Huffman encoding/decoding verified');
    }
  } catch (decodeError) {
    console.error('🔍 WebAuthn Debug: Error testing decode:', decodeError);
  }

  // Build the new WebAuthn prefix format:
  // [2 bytes auth_type][2 bytes auth_len][auth_data][4 bytes counter][2 bytes huffman_tree_len][huffman_tree][2 bytes huffman_encoded_len][huffman_encoded_origin]
  
  const totalSize = 
    2 + // auth_type
    2 + // auth_len
    authData.length + // auth_data
    4 + // counter
    2 + // huffman_tree_len
    huffmanTree.length + // huffman_tree
    2 + // huffman_encoded_len
    huffmanEncodedOrigin.length; // huffman_encoded_origin

  console.log('🔍 WebAuthn Debug: total payload size:', totalSize);

  const prefix = new Uint8Array(totalSize);
  let offset = 0;

  // auth_type (2 bytes, zeroed for backward compatibility)
  console.log('🔍 WebAuthn Debug: auth_type at offset', offset, '(2 bytes, zeroed)');
  offset += 2;

  // auth_len (2 bytes, little-endian)
  console.log('🔍 WebAuthn Debug: auth_len at offset', offset, ':', authData.length);
  const authDataLenView = new DataView(prefix.buffer, offset, 2);
  authDataLenView.setUint16(0, authData.length, true);
  offset += 2;

  // auth_data
  console.log('🔍 WebAuthn Debug: auth_data at offset', offset, 'length:', authData.length);
  prefix.set(authData, offset);
  offset += authData.length;

  // counter (4 bytes, little-endian)
  console.log('🔍 WebAuthn Debug: counter at offset', offset, ':', counter);
  const counterView = new DataView(prefix.buffer, offset, 4);
  counterView.setUint32(0, counter, true);
  offset += 4;

  // huffman_tree_len (2 bytes, little-endian)
  console.log('🔍 WebAuthn Debug: huffman_tree_len at offset', offset, ':', huffmanTree.length);
  const treeLen = new DataView(prefix.buffer, offset, 2);
  treeLen.setUint16(0, huffmanTree.length, true);
  offset += 2;

  // huffman_encoded_len (2 bytes, little-endian)
  console.log('🔍 WebAuthn Debug: huffman_encoded_len at offset', offset, ':', huffmanEncodedOrigin.length);
  const encodedLen = new DataView(prefix.buffer, offset, 2);
  encodedLen.setUint16(0, huffmanEncodedOrigin.length, true);
  offset += 2;

  // huffman_tree
  console.log('🔍 WebAuthn Debug: huffman_tree at offset', offset, 'length:', huffmanTree.length);
  prefix.set(huffmanTree, offset);
  offset += huffmanTree.length;

  // huffman_encoded_origin
  console.log('🔍 WebAuthn Debug: huffman_encoded_origin at offset', offset, 'length:', huffmanEncodedOrigin.length);
  prefix.set(huffmanEncodedOrigin, offset);

  console.log('🔍 WebAuthn Debug: Final payload (first 32 bytes):', Array.from(prefix.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  console.log('🔍 WebAuthn Debug: Final payload total length:', prefix.length);

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
