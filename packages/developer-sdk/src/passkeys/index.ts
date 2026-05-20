import type { PasskeySigningFn } from '../types/index.js';

const R1_AUTHENTICATION_TYPE_WEBAUTHN_RAW_CLIENT_DATA_JSON = 2;
const SECP256R1_SCALAR_SIZE = 32;
const P256_ORDER = BigInt(
  '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551',
);
const P256_HALF_ORDER = P256_ORDER >> 1n;

export function createSecp256r1PasskeySigningFn(
  options: Omit<PublicKeyCredentialRequestOptions, 'challenge'>,
): PasskeySigningFn {
  return (message) =>
    signWithSecp256r1WebAuthn({
      ...options,
      challenge: message.slice(),
    });
}

async function signWithSecp256r1WebAuthn(
  publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions,
) {
  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;

  if (!assertion || !assertion.response) {
    throw new Error('Failed to get passkey assertion');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new Uint8Array(response.clientDataJSON);
  const clientDataJSONHash = await crypto.subtle.digest(
    'SHA-256',
    response.clientDataJSON,
  );
  const message = concatBytes(
    authenticatorData,
    new Uint8Array(clientDataJSONHash),
  );

  return {
    signature: secp256r1DerToRawSignature(new Uint8Array(response.signature)),
    prefix: getRawWebAuthnPrefix(clientDataJSON, authenticatorData),
    message,
  };
}

function getRawWebAuthnPrefix(
  clientJson: Uint8Array,
  authData: Uint8Array,
): Uint8Array {
  if (authData.length > 0xffff) {
    throw new Error('WebAuthn authenticatorData is too large');
  }
  if (clientJson.length > 0xffff) {
    throw new Error('WebAuthn clientDataJSON is too large');
  }

  const prefix = new Uint8Array(
    2 + 2 + authData.length + 2 + clientJson.length,
  );
  const view = new DataView(
    prefix.buffer,
    prefix.byteOffset,
    prefix.byteLength,
  );
  let offset = 0;

  view.setUint16(
    offset,
    R1_AUTHENTICATION_TYPE_WEBAUTHN_RAW_CLIENT_DATA_JSON,
    true,
  );
  offset += 2;

  view.setUint16(offset, authData.length, true);
  offset += 2;

  prefix.set(authData, offset);
  offset += authData.length;

  view.setUint16(offset, clientJson.length, true);
  offset += 2;

  prefix.set(clientJson, offset);

  return prefix;
}

function secp256r1DerToRawSignature(derSignature: Uint8Array): Uint8Array {
  const signature = parseDerSignature(derSignature);
  const s =
    signature.s > P256_HALF_ORDER ? P256_ORDER - signature.s : signature.s;
  return concatBytes(
    bigIntToFixedBytes(signature.r, SECP256R1_SCALAR_SIZE),
    bigIntToFixedBytes(s, SECP256R1_SCALAR_SIZE),
  );
}

function parseDerSignature(derSignature: Uint8Array): {
  r: bigint;
  s: bigint;
} {
  let offset = 0;

  if (derSignature[offset] !== 0x30) {
    throw new Error('Invalid secp256r1 DER signature');
  }
  offset += 1;

  const sequenceLength = readDerLength(derSignature, offset);
  offset = sequenceLength.offset;

  if (offset + sequenceLength.length !== derSignature.length) {
    throw new Error('Invalid secp256r1 DER signature length');
  }

  const r = readDerInteger(derSignature, offset);
  offset = r.offset;

  const s = readDerInteger(derSignature, offset);

  if (s.offset !== derSignature.length) {
    throw new Error('Invalid secp256r1 DER signature trailing data');
  }

  return { r: bytesToBigInt(r.bytes), s: bytesToBigInt(s.bytes) };
}

function readDerInteger(
  derSignature: Uint8Array,
  offset: number,
): {
  bytes: Uint8Array;
  offset: number;
} {
  if (derSignature[offset] !== 0x02) {
    throw new Error('Invalid secp256r1 DER signature integer');
  }

  const integerLength = readDerLength(derSignature, offset + 1);
  const start = integerLength.offset;
  const end = start + integerLength.length;

  if (end > derSignature.length || integerLength.length === 0) {
    throw new Error('Invalid secp256r1 DER signature integer length');
  }

  return {
    bytes: derSignature.slice(start, end),
    offset: end,
  };
}

function readDerLength(
  derSignature: Uint8Array,
  offset: number,
): {
  length: number;
  offset: number;
} {
  const first = derSignature[offset];
  if (first === undefined) {
    throw new Error('Invalid secp256r1 DER signature length');
  }

  if (first < 0x80) {
    return {
      length: first,
      offset: offset + 1,
    };
  }

  const lengthBytes = first & 0x7f;
  if (lengthBytes === 0 || lengthBytes > 2) {
    throw new Error('Unsupported secp256r1 DER signature length');
  }

  if (offset + lengthBytes >= derSignature.length) {
    throw new Error('Invalid secp256r1 DER signature length');
  }

  let length = 0;
  for (let index = 0; index < lengthBytes; index++) {
    length = (length << 8) | derSignature[offset + 1 + index];
  }

  return {
    length,
    offset: offset + 1 + lengthBytes,
  };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

function bigIntToFixedBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n) {
    throw new Error('Secp256r1 signature integers must be positive');
  }

  const bytes = new Uint8Array(length);
  let remaining = value;

  for (let index = length - 1; index >= 0; index--) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  if (remaining !== 0n) {
    throw new Error('Secp256r1 signature integer is too large');
  }

  return bytes;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left);
  bytes.set(right, left.length);
  return bytes;
}
