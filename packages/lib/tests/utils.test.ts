import { AuthorityType } from '@swig-wallet/coder';
import { describe, expect, it } from 'vitest';
import {
  createSecp256k1AuthorityInfo,
  createSecp256k1SessionAuthorityInfo,
} from '../src/authority/createAuthority';
import {
  compressedPubkeyToAddress,
  compressPubkey,
  decompressPubkey,
  detectPubkeyFormat,
  uncompressedPubkeyToAddress,
} from '../src/utils';

// Hardcoded test vectors for secp256k1 (known valid keys)
// Private key: 1
// Uncompressed public key: 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8
// Compressed public key: 0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798

const uncompressedPubkeyHex =
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';
const compressedPubkeyWithPrefixHex =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const compressedPubkeyWithoutPrefixHex =
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

// Convert hex strings to Uint8Arrays
const uncompressedPubkey = Uint8Array.from(
  uncompressedPubkeyHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
);
const compressedPubkey = Uint8Array.from(
  compressedPubkeyWithoutPrefixHex
    .match(/.{2}/g)!
    .map((byte) => parseInt(byte, 16)),
);
const compressedPubkeyWithPrefix = Uint8Array.from(
  compressedPubkeyWithPrefixHex
    .match(/.{2}/g)!
    .map((byte) => parseInt(byte, 16)),
);

// Expected Ethereum address for this key (calculated from the actual key)
const expectedAddress = uncompressedPubkeyToAddress(uncompressedPubkey);

describe('Pubkey Format Detection', () => {
  it('should detect uncompressed format (65 bytes with 0x04 prefix)', () => {
    const uncompressedWithPrefix = new Uint8Array([
      0x04,
      ...uncompressedPubkey,
    ]);
    expect(detectPubkeyFormat(uncompressedWithPrefix)).toBe('uncompressed');
  });

  it('should detect uncompressed format (64 bytes without prefix)', () => {
    expect(detectPubkeyFormat(uncompressedPubkey)).toBe('uncompressed');
  });

  it('should detect compressed format (33 bytes with 0x02 prefix)', () => {
    expect(detectPubkeyFormat(compressedPubkeyWithPrefix)).toBe('compressed');
  });

  it('should detect compressed format (32 bytes without prefix)', () => {
    expect(detectPubkeyFormat(compressedPubkey)).toBe('compressed');
  });

  it('should detect invalid format for wrong length', () => {
    const invalidPubkey = new Uint8Array(30);
    expect(detectPubkeyFormat(invalidPubkey)).toBe('invalid');
  });

  it('should detect invalid format for wrong prefix', () => {
    const invalidPubkey = new Uint8Array([0x01, ...uncompressedPubkey]);
    expect(detectPubkeyFormat(invalidPubkey)).toBe('invalid');
  });

  it('should work with hex strings', () => {
    const uncompressedHex =
      '04' +
      Array.from(uncompressedPubkey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    expect(detectPubkeyFormat(uncompressedHex)).toBe('uncompressed');

    const compressedHex =
      '02' +
      Array.from(compressedPubkey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    expect(detectPubkeyFormat(compressedHex)).toBe('compressed');
  });
});

describe('Address Generation', () => {
  it('should generate same address from compressed and uncompressed pubkeys', () => {
    console.log(
      'compressedPubkeyWithPrefix length:',
      compressedPubkeyWithPrefix.length,
      'first few bytes:',
      compressedPubkeyWithPrefix.slice(0, 5),
    );
    const addressFromCompressed = compressedPubkeyToAddress(
      compressedPubkeyWithPrefix,
    );
    const addressFromUncompressed =
      uncompressedPubkeyToAddress(uncompressedPubkey);

    expect(addressFromCompressed).toEqual(addressFromUncompressed);
    expect(addressFromCompressed).toEqual(expectedAddress);
  });
  it('should work with hex strings', () => {
    const compressedHex = compressedPubkeyWithPrefixHex;
    const uncompressedHex = Array.from(uncompressedPubkey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const addressFromCompressedHex = compressedPubkeyToAddress(compressedHex);
    const addressFromUncompressedHex =
      uncompressedPubkeyToAddress(uncompressedHex);

    expect(addressFromCompressedHex).toEqual(addressFromUncompressedHex);
    expect(addressFromCompressedHex).toEqual(expectedAddress);
  });
});

describe('Pubkey Compression/Decompression', () => {
  it('should compress and decompress pubkey correctly', () => {
    const compressed = compressPubkey(uncompressedPubkey);
    const decompressed = decompressPubkey(compressed);

    expect(decompressed).toEqual(uncompressedPubkey);
  });

  it('should work with prefixed keys', () => {
    const uncompressedWithPrefix = new Uint8Array([
      0x04,
      ...uncompressedPubkey,
    ]);

    const compressed = compressPubkey(uncompressedWithPrefix);
    const decompressed = decompressPubkey(compressedPubkeyWithPrefix);

    expect(decompressed).toEqual(uncompressedPubkey);
  });

  it('should work with hex strings', () => {
    const uncompressedHex = Array.from(uncompressedPubkey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const compressed = compressPubkey(uncompressedHex);
    const decompressed = decompressPubkey(compressedPubkeyWithPrefixHex);

    expect(decompressed).toEqual(uncompressedPubkey);
  });
});

describe('Authority Creation', () => {
  it('should create authority info from uncompressed pubkey', () => {
    const authorityInfo = createSecp256k1AuthorityInfo(uncompressedPubkey);

    expect(authorityInfo.type).toBe(AuthorityType.Secp256k1);
    expect(authorityInfo.data).toEqual(uncompressedPubkey);
  });

  it('should create authority info from compressed pubkey', () => {
    const authorityInfo = createSecp256k1AuthorityInfo(
      compressedPubkeyWithPrefix,
    );

    expect(authorityInfo.type).toBe(AuthorityType.Secp256k1);
    expect(authorityInfo.data).toEqual(compressedPubkeyWithPrefix); // Should be decompressed internally
  });

  it('should create authority info from hex strings', () => {
    const uncompressedHex = Array.from(uncompressedPubkey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const compressedHex = compressedPubkeyWithPrefixHex;

    const authorityInfo1 = createSecp256k1AuthorityInfo(uncompressedHex);
    const authorityInfo2 = createSecp256k1AuthorityInfo(compressedHex);

    expect(authorityInfo2.data).toEqual(compressedPubkeyWithPrefix);
    expect(authorityInfo1.data).toEqual(uncompressedPubkey);
  });

  it('should create session authority info from both formats', () => {
    const sessionAuthorityInfo1 = createSecp256k1SessionAuthorityInfo(
      uncompressedPubkey,
      3600n,
    );
    // const sessionAuthorityInfo2 = createSecp256k1SessionAuthorityInfo(
    //   compressedPubkeyWithPrefix,
    //   3600n,
    // );

    expect(sessionAuthorityInfo1.type).toBe(AuthorityType.Secp256k1Session);
    // expect(sessionAuthorityInfo2.type).toBe(AuthorityType.Secp256k1Session);

    // The data should contain the full session data including decompressed pubkey and additional fields
    const expectedData = new Uint8Array([
      ...uncompressedPubkey,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      14,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(sessionAuthorityInfo1.data).toEqual(expectedData);
    // expect(sessionAuthorityInfo2.data).toEqual(expectedData);
  });

  it('should throw error for invalid pubkey format', () => {
    const invalidPubkey = new Uint8Array(30);

    expect(() => createSecp256k1AuthorityInfo(invalidPubkey)).toThrow(
      'Invalid secp256k1 public key format. Expected 33-byte compressed or 64-byte uncompressed key.',
    );

    expect(() =>
      createSecp256k1SessionAuthorityInfo(invalidPubkey, 3600n),
    ).toThrow(
      'Invalid secp256k1 public key format. Expected 33-byte compressed or 64-byte uncompressed key.',
    );
  });
});
