import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from '@solana/kit';

export const PAYMASTER_ADDRESS = 'Ac2z6B25qv5rHprsMi7mcGo1LgkJ5kdxaUejxFcKGxZS';
export const JITO_TIP_ADDRESS = '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5';
export const LOOKUP_TABLE_ADDRESS =
  'Hex8Pe25n1yhMcQGVSfJUUKo2EqRv6MQDMYGZkwQpVpG';
export const LOOKUP_ACCOUNT_ADDRESS =
  'EtES4FyCEegf71P6NGFsWTabyJPeaq5kJz7UkJvSD21Z';

const MEMO_PROGRAM_ADDRESS = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111';
const TEST_BLOCKHASH = blockhash('11111111111111111111111111111111');

export function createSerializedTransaction(
  instructions: Instruction[],
  lookupTableAddresses?: Record<string, readonly string[]>,
): Uint8Array {
  const transactionMessage = pipe(
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
  const compressedMessage = lookupTableAddresses
    ? compressTransactionMessageUsingAddressLookupTables(
        transactionMessage,
        Object.fromEntries(
          Object.entries(lookupTableAddresses).map(([table, accounts]) => [
            address(table),
            accounts.map((account) => address(account)),
          ]),
        ),
      )
    : transactionMessage;
  const transaction = compileTransaction(compressedMessage);

  return new Uint8Array(getTransactionEncoder().encode(transaction));
}

export function createSerializedLegacyTransaction(
  instructions: Instruction[],
): Uint8Array {
  const transactionMessage = pipe(
    createTransactionMessage({ version: 'legacy' }),
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
  const transaction = compileTransaction(transactionMessage);

  return new Uint8Array(getTransactionEncoder().encode(transaction));
}

export function createTipInstruction(lamports: bigint): Instruction {
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

export function createUnrelatedLookupInstruction(): Instruction {
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
