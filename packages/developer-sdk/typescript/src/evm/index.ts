import type {
  CreateSecp256k1EvmSigningFnOptions,
  Secp256k1SigningFn,
} from '../types/index.js';

export function createSecp256k1EvmSigningFn(
  options: CreateSecp256k1EvmSigningFnOptions,
): Secp256k1SigningFn {
  return async (message) => {
    const signature = await options.provider.request({
      method: 'personal_sign',
      params: [bytesToHex(message), options.address],
    });

    if (typeof signature !== 'string') {
      throw new Error('EVM provider returned a non-string signature');
    }

    return {
      signature: parseEvmSignature(signature),
      prefix: evmPersonalSignPrefix(message.length),
    };
  };
}

function parseEvmSignature(signature: string): Uint8Array {
  const bytes = hexToBytes(signature);
  if (bytes.length !== 65) {
    throw new Error('EVM signature must be 65 bytes');
  }

  bytes[64] = normalizeRecoveryByte(bytes[64]);
  return bytes;
}

function normalizeRecoveryByte(value: number): number {
  if (value === 0 || value === 1) {
    return value + 27;
  }

  if (value === 27 || value === 28) {
    return value;
  }

  if (value >= 35) {
    return ((value - 35) % 2) + 27;
  }

  throw new Error('EVM signature has an invalid recovery byte');
}

function evmPersonalSignPrefix(messageLength: number): Uint8Array {
  return asciiToBytes(`\x19Ethereum Signed Message:\n${messageLength}`);
}

function hexToBytes(value: string): Uint8Array {
  const normalized = normalizeHex(value);
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex strings must contain an even number of characters');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[\da-fA-F]+$/.test(normalized)) {
    throw new Error('Invalid hex string');
  }
  return normalized.toLowerCase();
}

function asciiToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}
