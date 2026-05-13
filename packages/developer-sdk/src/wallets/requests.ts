import type {
  CreateWalletArgs,
  ExecuteArgs,
  Network,
  SwapArgs,
  TransferArgs,
  TransferSolArgs,
  TransferTokenArgs,
} from '../types/index.js';
import type { WalletHandle } from './handle.js';
import {
  normalizeAmount,
  normalizeInstruction,
  toProtoNetwork,
} from './normalizers.js';

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
    network: toProtoNetwork(resolveNetwork(args.network, defaultNetwork)),
    feePayer: args.feePayer,
    policyId: args.policyId,
  };
}

export function transferSolRequest(
  wallet: WalletHandle,
  args: TransferSolArgs,
  defaultNetwork?: Network,
) {
  return {
    network: toProtoNetwork(
      resolveNetwork(args.network, wallet.network, defaultNetwork),
    ),
    feePayer: args.feePayer,
    swigId: wallet.swigId,
    swigConfigAddress: wallet.swigConfigAddress,
    walletAddress: wallet.walletAddress,
    requesterPubkey: resolveRequesterPubkey(wallet, args),
    destination: args.destination,
    lamports: normalizeAmount(args.amount),
  };
}

export function transferTokenRequest(
  wallet: WalletHandle,
  args: TransferTokenArgs,
  defaultNetwork?: Network,
) {
  return {
    network: toProtoNetwork(
      resolveNetwork(args.network, wallet.network, defaultNetwork),
    ),
    feePayer: args.feePayer,
    swigId: wallet.swigId,
    swigConfigAddress: wallet.swigConfigAddress,
    walletAddress: wallet.walletAddress,
    requesterPubkey: resolveRequesterPubkey(wallet, args),
    mint: args.mint,
    destinationOwner: args.destinationOwner ?? args.destination,
    sourceTokenAccount: args.sourceTokenAccount,
    destinationTokenAccount: args.destinationTokenAccount,
    amount: normalizeAmount(args.amount),
    tokenProgram: args.tokenProgram,
    createDestinationTokenAccount: args.createDestinationTokenAccount,
  };
}

export function swapRequest(
  wallet: WalletHandle,
  args: SwapArgs,
  defaultNetwork?: Network,
) {
  return {
    wallet: wallet.swigConfigAddress,
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
    network: args.network ?? wallet.network ?? defaultNetwork,
    instructions: args.instructions.map(normalizeInstruction),
    addressLookupTableAccounts: args.addressLookupTableAccounts,
    idempotencyKey: args.idempotencyKey,
  };
}

export function isTokenTransfer(args: TransferArgs): args is TransferTokenArgs {
  return (
    'mint' in args && typeof args.mint === 'string' && args.mint.length > 0
  );
}

function resolveNetwork(...networks: Array<Network | undefined>): Network {
  const network = networks.find((candidate) => candidate !== undefined);
  if (!network) {
    throw new Error('network is required');
  }
  return network;
}

function resolveRequesterPubkey(
  wallet: WalletHandle,
  args: TransferArgs,
): string {
  const requesterPubkey = args.requesterPubkey ?? wallet.requesterPubkey;
  if (!requesterPubkey) {
    throw new Error('requesterPubkey is required');
  }
  return requesterPubkey;
}
