import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from '@solana/kit';
import { describe, expect, test } from 'bun:test';
import { createPaymasterClient } from '../src/index.js';

const PAYMASTER_ADDRESS = 'Ac2z6B25qv5rHprsMi7mcGo1LgkJ5kdxaUejxFcKGxZS';
const JITO_TIP_ADDRESS = '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5';
const LOOKUP_TABLE_ADDRESS = 'Hex8Pe25n1yhMcQGVSfJUUKo2EqRv6MQDMYGZkwQpVpG';
const LOOKUP_ACCOUNT_ADDRESS = 'EtES4FyCEegf71P6NGFsWTabyJPeaq5kJz7UkJvSD21Z';
const MEMO_PROGRAM_ADDRESS = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111';
const TEST_BLOCKHASH = blockhash('11111111111111111111111111111111');

describe('PaymasterClient.prepareJitoBundleTransactionMessages', () => {
  test('accepts split tips that satisfy the aggregate minimum', () => {
    const client = createClient();
    const messages = [
      createMessage(createTipInstruction(500n)),
      createMessage(createTipInstruction(500n)),
    ];

    const prepared = client.prepareJitoBundleTransactionMessages(messages);

    expect(prepared).toBe(messages);
    expect(prepared[0]?.instructions).toBeArrayOfSize(1);
    expect(prepared[1]?.instructions).toBeArrayOfSize(1);
  });

  test('rejects a paymaster tip whose destination is ALT-loaded', () => {
    const client = createClient();
    const message = compressTransactionMessageUsingAddressLookupTables(
      createMessage(createTipInstruction(1_000n)),
      {
        [address(LOOKUP_TABLE_ADDRESS)]: [address(JITO_TIP_ADDRESS)],
      },
    );
    const messages = [message];

    expect(() => client.prepareJitoBundleTransactionMessages(messages)).toThrow(
      'Jito bundle instructions that reference the paymaster must use static accounts',
    );
    expect(message.instructions).toBeArrayOfSize(1);
  });

  test('allows unrelated ALT-loaded accounts alongside a static tip', () => {
    const client = createClient();
    const message = compressTransactionMessageUsingAddressLookupTables(
      createMessage(
        createTipInstruction(1_000n),
        createUnrelatedLookupInstruction(),
      ),
      {
        [address(LOOKUP_TABLE_ADDRESS)]: [address(LOOKUP_ACCOUNT_ADDRESS)],
      },
    );
    const messages = [message];

    const prepared = client.prepareJitoBundleTransactionMessages(messages);

    expect(prepared).toBe(messages);
    expect(prepared[0]?.instructions).toBeArrayOfSize(2);
  });
});

function createClient() {
  return createPaymasterClient({
    apiKey: 'sk_test',
    paymasterPubkey: PAYMASTER_ADDRESS,
    baseUrl: 'http://localhost:8080',
    network: 'mainnet',
  });
}

function createMessage(...instructions: Instruction[]) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (message) =>
      setTransactionMessageFeePayer(address(PAYMASTER_ADDRESS), message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: TEST_BLOCKHASH,
          lastValidBlockHeight: 1n,
        },
        message,
      ),
    (message) => appendTransactionMessageInstructions(instructions, message),
  );
}

function createTipInstruction(lamports: bigint): Instruction {
  return {
    programAddress: address(SYSTEM_PROGRAM_ADDRESS),
    accounts: [
      {
        address: address(PAYMASTER_ADDRESS),
        role: AccountRole.WRITABLE_SIGNER,
      },
      {
        address: address(JITO_TIP_ADDRESS),
        role: AccountRole.WRITABLE,
      },
    ],
    data: encodeSystemTransfer(lamports),
  };
}

function createUnrelatedLookupInstruction(): Instruction {
  return {
    programAddress: address(MEMO_PROGRAM_ADDRESS),
    accounts: [
      {
        address: address(LOOKUP_ACCOUNT_ADDRESS),
        role: AccountRole.READONLY,
      },
    ],
    data: new Uint8Array([1]),
  };
}

function encodeSystemTransfer(lamports: bigint): Uint8Array {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return data;
}
