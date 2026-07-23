import {
  AccountRole,
  address,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type CompiledTransactionMessage,
  type Instruction,
} from '@solana/kit';
import { PaymasterError, type JitoBundleOptions } from './types.js';

const DEFAULT_JITO_TIP_LAMPORTS = 10_000n;
const MIN_JITO_TIP_LAMPORTS = 1_000n;
const SYSTEM_PROGRAM_ADDRESS_STRING = '11111111111111111111111111111111';
const SYSTEM_TRANSFER_DISCRIMINATOR = 2;
const MAX_U64 = 18_446_744_073_709_551_615n;

const TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export function getJitoTipAccount(): string {
  return TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)]!;
}

export function isJitoTipAccount(pubkey: string): boolean {
  return TIP_ACCOUNTS.includes(pubkey);
}

export function resolveJitoTipLamports(options?: JitoBundleOptions): bigint {
  const tipLamports = options?.tipLamports ?? DEFAULT_JITO_TIP_LAMPORTS;

  if (typeof tipLamports === 'number') {
    if (
      !Number.isSafeInteger(tipLamports) ||
      BigInt(tipLamports) < MIN_JITO_TIP_LAMPORTS
    ) {
      throw new PaymasterError('Jito tip lamports must be at least 1000');
    }
    return BigInt(tipLamports);
  }

  if (tipLamports < MIN_JITO_TIP_LAMPORTS || tipLamports > MAX_U64) {
    throw new PaymasterError('Jito tip lamports must be a u64 value >= 1000');
  }

  return tipLamports;
}

export function createJitoTipInstruction(args: {
  paymasterPubkey: string;
  tipLamports?: number | bigint;
}): Instruction {
  const tipLamports = resolveJitoTipLamports({
    tipLamports: args.tipLamports,
  });

  return {
    programAddress: address(SYSTEM_PROGRAM_ADDRESS_STRING),
    accounts: [
      {
        address: address(args.paymasterPubkey),
        role: AccountRole.WRITABLE_SIGNER,
      },
      {
        address: address(getJitoTipAccount()),
        role: AccountRole.WRITABLE,
      },
    ],
    data: encodeSystemTransferInstruction(tipLamports),
  };
}

export function serializedTransactionJitoTipLamports(
  serializedTx: Uint8Array,
  paymasterPubkey: string,
): bigint {
  const transaction = getTransactionDecoder().decode(serializedTx);
  const compiledTransactionMessage =
    getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);

  return compiledTransactionMessage.instructions.reduce(
    (total, instruction) =>
      total +
      compiledInstructionJitoTipLamports(
        compiledTransactionMessage,
        instruction,
        paymasterPubkey,
      ),
    0n,
  );
}

export function serializedBundleHasSufficientJitoTip(
  serializedTransactions: Uint8Array[],
  paymasterPubkey: string,
): boolean {
  const tipLamports = serializedTransactions.reduce(
    (total, transaction) =>
      total +
      serializedTransactionJitoTipLamports(transaction, paymasterPubkey),
    0n,
  );

  return isValidJitoTipTotal(tipLamports);
}

export function transactionMessageJitoTipLamports(
  transactionMessage: { instructions: readonly Instruction[] },
  paymasterPubkey: string,
): bigint {
  return transactionMessage.instructions.reduce(
    (total, instruction) =>
      total + instructionJitoTipLamports(instruction, paymasterPubkey),
    0n,
  );
}

export function serializedTransactionHasLookupLoadedPaymasterInstruction(
  serializedTx: Uint8Array,
  paymasterPubkey: string,
): boolean {
  const transaction = getTransactionDecoder().decode(serializedTx);
  const message = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  );

  return message.instructions.some((instruction) => {
    const accountIndices = instruction.accountIndices;
    return (
      accountIndices?.some(
        (index) =>
          message.staticAccounts[index]?.toString() === paymasterPubkey,
      ) === true &&
      (instruction.programAddressIndex >= message.staticAccounts.length ||
        accountIndices.some((index) => index >= message.staticAccounts.length))
    );
  });
}

export function transactionMessageHasLookupLoadedPaymasterInstruction(
  transactionMessage: { instructions: readonly Instruction[] },
  paymasterPubkey: string,
): boolean {
  return transactionMessage.instructions.some((instruction) => {
    const accounts = instruction.accounts;
    return (
      accounts?.some(
        (account) => account.address.toString() === paymasterPubkey,
      ) === true && accounts.some((account) => 'lookupTableAddress' in account)
    );
  });
}

export function isValidJitoTipTotal(tipLamports: bigint): boolean {
  return tipLamports >= MIN_JITO_TIP_LAMPORTS && tipLamports <= MAX_U64;
}

function instructionJitoTipLamports(
  instruction: Instruction,
  paymasterPubkey: string,
): bigint {
  const accounts = instruction.accounts;
  if (
    instruction.programAddress.toString() !== SYSTEM_PROGRAM_ADDRESS_STRING ||
    !accounts ||
    accounts.length < 2 ||
    accounts.some((account) => 'lookupTableAddress' in account) ||
    accounts[0]?.address.toString() !== paymasterPubkey ||
    !isJitoTipAccount(accounts[1]?.address.toString() ?? '')
  ) {
    return 0n;
  }

  return decodeSystemTransferLamports(instruction.data);
}

function compiledInstructionJitoTipLamports(
  message: CompiledTransactionMessage,
  instruction: CompiledTransactionMessage['instructions'][number],
  paymasterPubkey: string,
): bigint {
  const accountIndices = instruction.accountIndices;
  if (
    message.staticAccounts[instruction.programAddressIndex]?.toString() !==
      SYSTEM_PROGRAM_ADDRESS_STRING ||
    !accountIndices ||
    accountIndices.length < 2 ||
    accountIndices.some((index) => index >= message.staticAccounts.length) ||
    message.staticAccounts[accountIndices[0]!]?.toString() !==
      paymasterPubkey ||
    !isJitoTipAccount(
      message.staticAccounts[accountIndices[1]!]?.toString() ?? '',
    )
  ) {
    return 0n;
  }

  return decodeSystemTransferLamports(instruction.data);
}

function encodeSystemTransferInstruction(lamports: bigint): Uint8Array {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, SYSTEM_TRANSFER_DISCRIMINATOR, true);
  view.setBigUint64(4, lamports, true);
  return data;
}

function decodeSystemTransferLamports(
  data?: Pick<Uint8Array, 'buffer' | 'byteLength' | 'byteOffset'>,
): bigint {
  if (!data || data.byteLength < 12) {
    return 0n;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== SYSTEM_TRANSFER_DISCRIMINATOR) {
    return 0n;
  }

  return view.getBigUint64(4, true);
}
