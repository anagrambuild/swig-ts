import { Buffer } from 'buffer';

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

export function randomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
    return buffer;
  }
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}
