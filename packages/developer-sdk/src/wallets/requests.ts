import type {
  CreateWalletArgs,
  ExecuteArgs,
  Network,
  SwapArgs,
  TransferArgs,
} from '../types/index.js';
import type { WalletHandle } from './handle.js';
import { normalizeAmount, normalizeInstruction } from './normalizers.js';

export type WalletAction = 'transfer' | 'swap' | 'execute';

export function walletActionPath(
  wallet: WalletHandle,
  action: WalletAction,
): string {
  return `/v1/wallets/${encodeURIComponent(wallet.swigConfigAddress)}/${action}`;
}

export function createWalletRequest(
  args: CreateWalletArgs,
  defaultNetwork?: Network,
) {
  return {
    policyId: args.policyId,
    network: args.network ?? defaultNetwork,
    label: args.label,
    externalId: args.externalId,
    metadata: args.metadata,
    idempotencyKey: args.idempotencyKey,
  };
}

export function transferRequest(
  wallet: WalletHandle,
  args: TransferArgs,
  defaultNetwork?: Network,
) {
  return {
    wallet: wallet.swigConfigAddress,
    roleId: wallet.roleId,
    network: args.network ?? wallet.network ?? defaultNetwork,
    destination: args.destination,
    mint: args.mint,
    amount: normalizeAmount(args.amount),
    idempotencyKey: args.idempotencyKey,
  };
}

export function swapRequest(
  wallet: WalletHandle,
  args: SwapArgs,
  defaultNetwork?: Network,
) {
  return {
    wallet: wallet.swigConfigAddress,
    roleId: wallet.roleId,
    network: args.network ?? wallet.network ?? defaultNetwork,
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: normalizeAmount(args.amount),
    slippageBps: args.slippageBps,
    idempotencyKey: args.idempotencyKey,
  };
}

export function executeRequest(
  wallet: WalletHandle,
  args: ExecuteArgs,
  defaultNetwork?: Network,
) {
  return {
    wallet: wallet.swigConfigAddress,
    roleId: wallet.roleId,
    network: args.network ?? wallet.network ?? defaultNetwork,
    instructions: args.instructions.map(normalizeInstruction),
    addressLookupTableAccounts: args.addressLookupTableAccounts,
    idempotencyKey: args.idempotencyKey,
  };
}
