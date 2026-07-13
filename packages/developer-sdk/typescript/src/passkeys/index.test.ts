import { afterEach, describe, expect, test } from 'bun:test';

import { createSecp256r1PasskeySigningFn } from './index.js';

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
    return;
  }

  delete (globalThis as { navigator?: Navigator }).navigator;
});

describe('passkey signing helpers', () => {
  test('preserves raw clientDataJSON in the secp256r1 auth payload', async () => {
    const challenge = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const authenticatorData = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd]);
    const clientDataJSON = new TextEncoder().encode(
      '{"type":"webauthn.get","challenge":"abc","origin":"http://localhost:3000","crossOrigin":false,"topOrigin":"http://localhost:3000"}',
    );
    const r = Uint8Array.from({ length: 32 }, (_, index) => index + 17);
    const s = Uint8Array.from({ length: 32 }, (_, index) => index + 49);
    const derSignature = derSignatureBytes(r, s);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        credentials: {
          get: async (request: CredentialRequestOptions) => {
            expect(request.publicKey?.challenge).toEqual(challenge);
            return {
              response: {
                authenticatorData: toArrayBuffer(authenticatorData),
                clientDataJSON: toArrayBuffer(clientDataJSON),
                signature: toArrayBuffer(derSignature),
              },
            };
          },
        },
      },
    });

    const signingFn = createSecp256r1PasskeySigningFn({
      userVerification: 'preferred',
    });
    const result = await signingFn(challenge);
    const clientDataJSONHash = await crypto.subtle.digest(
      'SHA-256',
      toArrayBuffer(clientDataJSON),
    );

    expect(result.signature).toEqual(concatBytes(r, s));
    expect(result.message).toEqual(
      concatBytes(authenticatorData, new Uint8Array(clientDataJSONHash)),
    );

    expect(result.prefix).toBeDefined();
    const prefix = result.prefix as Uint8Array;
    const view = new DataView(
      prefix.buffer,
      prefix.byteOffset,
      prefix.byteLength,
    );
    expect(view.getUint16(0, true)).toBe(2);
    expect(view.getUint16(2, true)).toBe(authenticatorData.length);
    expect(prefix.slice(4, 4 + authenticatorData.length)).toEqual(
      authenticatorData,
    );

    const clientDataJSONLengthOffset = 4 + authenticatorData.length;
    expect(view.getUint16(clientDataJSONLengthOffset, true)).toBe(
      clientDataJSON.length,
    );
    expect(prefix.slice(clientDataJSONLengthOffset + 2)).toEqual(
      clientDataJSON,
    );
  });
});

function derSignatureBytes(r: Uint8Array, s: Uint8Array): Uint8Array {
  const encodedR = derIntegerBytes(r);
  const encodedS = derIntegerBytes(s);
  return Uint8Array.from([
    0x30,
    encodedR.length + encodedS.length,
    ...encodedR,
    ...encodedS,
  ]);
}

function derIntegerBytes(bytes: Uint8Array): Uint8Array {
  const needsLeadingZero = (bytes[0] & 0x80) !== 0;
  return Uint8Array.from([
    0x02,
    bytes.length + (needsLeadingZero ? 1 : 0),
    ...(needsLeadingZero ? [0] : []),
    ...bytes,
  ]);
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left);
  bytes.set(right, left.length);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
