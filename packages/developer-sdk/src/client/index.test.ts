import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { describe, expect, test } from 'bun:test';

import type { PreparedTransaction } from '../types/index.js';
import {
  signPreparedSwigTransaction,
  signPreparedSwigTransactions,
  signPreparedTransaction,
} from './index.js';

const prepared: PreparedTransaction = {
  transaction: 'base64-prepared-tx',
  transactionEncoding: 'base64',
  network: 'devnet',
  signatureRequests: [],
};

describe('client signing helpers', () => {
  test('signPreparedTransaction signs the transaction and preserves preparation metadata', async () => {
    await expect(
      signPreparedTransaction(prepared, {
        signTransaction: async (transaction) => `${transaction}.signed`,
      }),
    ).resolves.toEqual({
      transaction: 'base64-prepared-tx.signed',
      transactionEncoding: 'base64',
      network: 'devnet',
    });
  });

  test('signPreparedSwigTransaction patches secp256r1 instructions with passkey signing data', async () => {
    const publicKey = Uint8Array.from({ length: 33 }, (_, index) =>
      index === 0 ? 2 : index,
    );
    const messageHash = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 1,
    );
    const signature = Uint8Array.from(
      { length: 64 },
      (_, index) => 255 - index,
    );
    const passkeyMessage = Uint8Array.from([9, 8, 7, 6]);
    const passkeyPrefix = Uint8Array.from([1, 3, 5, 7]);
    const prepared = preparedSwigTransaction(publicKey, messageHash);

    const signed = await signPreparedSwigTransaction(prepared, {
      secp256r1: async (challenge) => {
        expect(challenge).toEqual(messageHash);
        return {
          signature,
          message: passkeyMessage,
          prefix: passkeyPrefix,
        };
      },
    });

    const transaction = Transaction.from(base64ToBytes(signed.transaction));
    const secpData = parseSecp256r1InstructionData(
      transaction.instructions[0].data,
    );
    const swigData = new Uint8Array(transaction.instructions[1].data);

    expect(secpData.publicKey).toEqual(publicKey);
    expect(secpData.signature).toEqual(signature);
    expect(secpData.message).toEqual(passkeyMessage);
    expect(readAuthorityPayload(swigData)).toEqual(
      concatBytes(baseAuthorityPayload(), passkeyPrefix),
    );
    expect(signed.transactionEncoding).toBe('base64');
    expect(signed.network).toBe('devnet');
  });

  test('signPreparedSwigTransaction leaves the authority payload unchanged for raw secp256r1 signatures', async () => {
    const publicKey = Uint8Array.from({ length: 33 }, (_, index) =>
      index === 0 ? 3 : index + 10,
    );
    const messageHash = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 33,
    );
    const signature = Uint8Array.from({ length: 64 }, (_, index) => index + 1);
    const prepared = preparedSwigTransaction(publicKey, messageHash);

    const signed = await signPreparedSwigTransaction(prepared, {
      secp256r1: async () => ({ signature }),
    });

    const transaction = Transaction.from(base64ToBytes(signed.transaction));
    const secpData = parseSecp256r1InstructionData(
      transaction.instructions[0].data,
    );
    const swigData = new Uint8Array(transaction.instructions[1].data);

    expect(secpData.publicKey).toEqual(publicKey);
    expect(secpData.signature).toEqual(signature);
    expect(secpData.message).toEqual(messageHash);
    expect(readAuthorityPayload(swigData)).toEqual(baseAuthorityPayload());
  });

  test('signPreparedSwigTransactions signs prepared transactions sequentially', async () => {
    const firstPublicKey = Uint8Array.from({ length: 33 }, (_, index) =>
      index === 0 ? 2 : index + 1,
    );
    const secondPublicKey = Uint8Array.from({ length: 33 }, (_, index) =>
      index === 0 ? 3 : index + 2,
    );
    const firstMessageHash = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 1,
    );
    const secondMessageHash = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 40,
    );
    const challenges: Uint8Array[] = [];

    const signed = await signPreparedSwigTransactions(
      [
        preparedSwigTransaction(firstPublicKey, firstMessageHash),
        preparedSwigTransaction(secondPublicKey, secondMessageHash),
      ],
      {
        secp256r1: async (challenge) => {
          challenges.push(challenge);
          return {
            signature: Uint8Array.from({ length: 64 }, (_, index) => index),
          };
        },
      },
    );

    expect(signed).toHaveLength(2);
    expect(challenges).toEqual([firstMessageHash, secondMessageHash]);
  });
});

const SECP256R1_PROGRAM_ID = new PublicKey(
  'Secp256r1SigVerify1111111111111111111111111',
);
const SWIG_PROGRAM_ID = new PublicKey(
  'swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB',
);
const FEE_PAYER = new PublicKey('2bDoQTvcRuAL8bA7igx6cjSZHH3wJqVg1vsYrUjeTWyP');

function preparedSwigTransaction(
  publicKey: Uint8Array,
  messageHash: Uint8Array,
): PreparedTransaction {
  const transaction = new Transaction({
    feePayer: FEE_PAYER,
    recentBlockhash: '11111111111111111111111111111111',
  }).add(
    new TransactionInstruction({
      programId: SECP256R1_PROGRAM_ID,
      keys: [],
      data: Buffer.from(
        encodeSecp256r1InstructionData({
          publicKey,
          signature: new Uint8Array(64),
          message: messageHash,
        }),
      ),
    }),
    new TransactionInstruction({
      programId: SWIG_PROGRAM_ID,
      keys: [],
      data: Buffer.from(signV2InstructionData()),
    }),
  );

  return {
    transaction: bytesToBase64(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    ),
    transactionEncoding: 'base64',
    network: 'devnet',
    signatureRequests: [
      {
        scheme: 'secp256r1',
        signer: bytesToHex(publicKey),
        messageHash: bytesToHex(messageHash),
        slot: 1,
        counter: 1,
      },
    ],
  };
}

function encodeSecp256r1InstructionData(args: {
  publicKey: Uint8Array;
  signature: Uint8Array;
  message: Uint8Array;
}): Uint8Array {
  const headerSize = 16;
  const messageOffset =
    headerSize + args.publicKey.length + args.signature.length;
  const data = new Uint8Array(messageOffset + args.message.length);
  const view = new DataView(data.buffer);

  data[0] = 1;
  view.setUint16(2, headerSize + args.publicKey.length, true);
  view.setUint16(4, 65535, true);
  view.setUint16(6, headerSize, true);
  view.setUint16(8, 65535, true);
  view.setUint16(10, messageOffset, true);
  view.setUint16(12, args.message.length, true);
  view.setUint16(14, 65535, true);
  data.set(args.publicKey, headerSize);
  data.set(args.signature, headerSize + args.publicKey.length);
  data.set(args.message, messageOffset);

  return data;
}

function parseSecp256r1InstructionData(data: Uint8Array): {
  publicKey: Uint8Array;
  signature: Uint8Array;
  message: Uint8Array;
} {
  const signatureOffset = readU16(data, 2);
  const publicKeyOffset = readU16(data, 6);
  const messageOffset = readU16(data, 10);
  const messageSize = readU16(data, 12);

  return {
    publicKey: data.slice(publicKeyOffset, publicKeyOffset + 33),
    signature: data.slice(signatureOffset, signatureOffset + 64),
    message: data.slice(messageOffset, messageOffset + messageSize),
  };
}

function signV2InstructionData(): Uint8Array {
  const compactInstructionPayload = Uint8Array.from([11, 22, 33]);
  const authorityPayload = baseAuthorityPayload();
  const data = new Uint8Array(8 + compactInstructionPayload.length + 17);
  const view = new DataView(data.buffer);

  view.setUint16(0, 11, true);
  view.setUint16(2, compactInstructionPayload.length, true);
  view.setUint32(4, 0, true);
  data.set(compactInstructionPayload, 8);
  data.set(authorityPayload, 8 + compactInstructionPayload.length);

  return data;
}

function baseAuthorityPayload(): Uint8Array {
  return Uint8Array.from({ length: 17 }, (_, index) => index + 1);
}

function readAuthorityPayload(data: Uint8Array): Uint8Array {
  const instructionPayloadLength = readU16(data, 2);
  return data.slice(8 + instructionPayloadLength);
}

function readU16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(
    offset,
    true,
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left);
  bytes.set(right, left.length);
  return bytes;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}
