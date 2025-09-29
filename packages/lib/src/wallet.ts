import { p256 } from '@noble/curves/nist';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { keccak_256 } from '@noble/hashes/sha3';
import { utf8ToBytes } from '@noble/hashes/utils';
import {
  HuffmanEncoder,
  R1AuthenticationType,
  WebAuthnField,
} from '@swig-wallet/coder';
import type { SigningFn, SigningResult } from './authority';
import { getUnprefixedSecpBytes } from './utils';

/**
 * Get {@link SigningFn} for Secp268k1-based Private key
 * @param privateKey Secp256k1 Private key
 * @returns SigningFn
 */
export function getSigningFnForSecp256k1PrivateKey(
  privateKey: Uint8Array | string,
): SigningFn {
  return async (message: Uint8Array) => {
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

/**
 * this function does nothing. just implementing the interface of [SigningFn]
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function dummySigningFn(_: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(0);
}

export function getSigningFnForSecp256r1PrivateKey(
  privateKey: Uint8Array | string,
): SigningFn {
  return async (message: Uint8Array) => {
    const sig = p256.sign(
      sha256(message),
      getUnprefixedSecpBytes(privateKey, 32),
      {
        lowS: true,
      },
    );

    return { signature: sig.toBytes('compact') };
  };
}

export function getSecp256r1WebAuthnSigningFn(
  publicKeyCredentialRequestOptions: Omit<
    PublicKeyCredentialRequestOptions,
    'challenge'
  >,
): SigningFn {
  return (message) =>
    signWithSecp256r1Webauthn({
      ...publicKeyCredentialRequestOptions,
      challenge: message.slice(),
    });
}

export async function signWithSecp256r1Webauthn(
  publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions,
): Promise<SigningResult> {
  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;

  if (!assertion || !assertion.response) {
    throw new Error('Failed to get passkey assertion');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  // Convert DER signature to raw 64-byte format for secp256r1 precompile
  const derSignature = new Uint8Array(response.signature);
  const rawSignature = secp256r1DerToRawSignature(derSignature);

  // Calculate the actual message that WebAuthn signed
  // WebAuthn signs: hash(authenticatorData + SHA256(clientDataJSON))
  const clientDataJSONHash = await crypto.subtle.digest(
    'SHA-256',
    response.clientDataJSON,
  );

  const authenticatorData = new Uint8Array(response.authenticatorData);

  // Concatenate authenticatorData + clientDataJSONHash to get message that
  // was hashed and signed, to use with secp256r1 precompile
  const webAuthnMessage = new Uint8Array(
    authenticatorData.length + clientDataJSONHash.byteLength,
  );
  webAuthnMessage.set(authenticatorData, 0);
  webAuthnMessage.set(
    new Uint8Array(clientDataJSONHash),
    authenticatorData.length,
  );

  const prefix = await getWebAuthnPrefix(
    new Uint8Array(response.clientDataJSON),
    new Uint8Array(response.authenticatorData),
  );

  return {
    signature: rawSignature,
    prefix,
    message: webAuthnMessage,
  };
}

export async function getWebAuthnPrefix(
  clientJson: Uint8Array,
  authData: Uint8Array,
): Promise<Uint8Array> {
  // Parse clientDataJSON to extract origin
  let origin = '';
  let fieldOrder: Uint8Array = new Uint8Array(4);

  try {
    const clientDataStr = new TextDecoder().decode(clientJson);
    fieldOrder = clientDataFieldOrder(clientDataStr);
    const clientData = JSON.parse(clientDataStr);

    // Extract origin
    if (!clientData.origin) {
      throw new Error('No origin found in clientDataJSON');
    }
    origin = clientData.origin;
  } catch (error) {
    throw new Error(`Failed to parse clientDataJSON: ${error}`);
  }

  // Encode origin URL using huffman encoding
  const encoder = new HuffmanEncoder(origin);
  const huffmanTree = encoder.getTreeData();
  const huffmanEncodedOrigin = encoder.encode(origin);

  // Build the new WebAuthn prefix format:
  // [2 bytes auth_type]
  // [2 bytes auth_len][auth_data]
  // [4 bytes client json field_order]
  // [2 bytes origin_len]
  // [2 bytes huffman_tree_len][huffman_tree]
  // [2 bytes huffman_encoded_len][huffman_encoded_origin]

  const totalSize =
    2 + // auth_type
    2 + // auth_len
    authData.length + // auth_data
    4 + // client json field order
    2 + // origin_len
    2 + // huffman_tree_len
    huffmanTree.length + // huffman_tree
    2 + // huffman_encoded_len
    huffmanEncodedOrigin.length; // huffman_encoded_origin

  const prefix = new Uint8Array(totalSize);
  const prefixView = new DataView(prefix.buffer);

  let offset = 0;

  prefixView.setUint16(offset, R1AuthenticationType.WebAuthn, true);
  offset += 2;

  prefixView.setUint16(offset, authData.length, true);
  offset += 2;

  prefix.set(authData, offset);
  offset += authData.length;

  prefix.set(fieldOrder, offset);
  offset += 4;

  prefixView.setUint16(offset, origin.length, true);
  offset += 2;

  prefixView.setUint16(offset, huffmanTree.length, true);
  offset += 2;

  prefixView.setUint16(offset, huffmanEncodedOrigin.length, true);
  offset += 2;

  prefix.set(huffmanTree, offset);
  offset += huffmanTree.length;

  prefix.set(huffmanEncodedOrigin, offset);

  return prefix;
}

function clientDataFieldOrder(jsonStr: string): Uint8Array {
  const keyToEnum: Record<string, WebAuthnField> = {
    type: WebAuthnField.Type,
    challenge: WebAuthnField.Challenge,
    origin: WebAuthnField.Origin,
    crossOrigin: WebAuthnField.CrossOrigin,
  };

  const json = JSON.parse(jsonStr);
  const keysInOrder = Object.keys(json);

  const result = new Uint8Array(4);

  keysInOrder.forEach((key, index) => {
    if (index < 4 && key in keyToEnum) {
      result[index] = keyToEnum[key];
    }
  });

  return result;
}

export function secp256r1DerToRawSignature(
  derSignature: Uint8Array,
): Uint8Array {
  const signature = p256.Signature.fromBytes(derSignature, 'der');
  const normalizedSignature = signature.normalizeS();
  const rawSignature = normalizedSignature.toBytes('compact');

  return rawSignature;
}
