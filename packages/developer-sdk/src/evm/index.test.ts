import { describe, expect, test } from 'bun:test';

import { createSecp256k1EvmSigningFn } from './index.js';

describe('EVM signing helpers', () => {
  test('creates a personal_sign based secp256k1 signing function', async () => {
    const address = '0x1234567890123456789012345678901234567890';
    const message = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
    const signature = Uint8Array.from({ length: 65 }, (_, index) => index);
    signature[64] = 1;

    const signingFn = createSecp256k1EvmSigningFn({
      address,
      provider: {
        request: async ({ method, params }) => {
          expect(method).toBe('personal_sign');
          expect(params).toEqual(['0xdeadbeef', address]);
          return bytesToHex(signature);
        },
      },
    });

    const result = await signingFn(message);

    const normalizedSignature = signature.slice();
    normalizedSignature[64] = 28;
    expect(result.signature).toEqual(normalizedSignature);
    expect(result.prefix).toEqual(
      asciiToBytes('\x19Ethereum Signed Message:\n4'),
    );
  });

  test('rejects malformed EVM signatures', async () => {
    const signingFn = createSecp256k1EvmSigningFn({
      address: '0x1234567890123456789012345678901234567890',
      provider: {
        request: async () => '0x1234',
      },
    });

    await expect(signingFn(Uint8Array.from([1]))).rejects.toThrow(
      'EVM signature must be 65 bytes',
    );
  });
});

function bytesToHex(bytes: Uint8Array): string {
  return `0x${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function asciiToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}
