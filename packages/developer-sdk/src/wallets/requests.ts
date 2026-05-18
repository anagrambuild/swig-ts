import type {
  CreateWalletArgs,
  ExecuteArgs,
  Network,
  PrepareArgs,
  PrepareOperation,
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

export function createWalletRequest(
  args: CreateWalletArgs,
  defaultNetwork?: Network,
) {
  return {
    network: toProtoNetwork(resolveNetwork(args.network, defaultNetwork)),
    feePayer: args.feePayer,
    ...(args.policyId ? { policyId: args.policyId } : {}),
    initialUser: args.initialUser,
    guardianPubkey: args.guardianPubkey,
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
    swigAddress: wallet.swigConfigAddress,
    requesterAuthority: resolveRequesterAuthority(wallet, args),
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
    swigAddress: wallet.swigConfigAddress,
    requesterAuthority: resolveRequesterAuthority(wallet, args),
    mint: args.mint,
    destinationOwner: args.destinationOwner,
    amount: normalizeAmount(args.amount),
  };
}

export function prepareRequest(
  wallet: WalletHandle,
  args: PrepareArgs,
  defaultNetwork?: Network,
) {
  return {
    network: toProtoNetwork(
      resolveNetwork(args.network, wallet.network, defaultNetwork),
    ),
    feePayer: args.feePayer,
    swigAddress: wallet.swigConfigAddress,
    requesterAuthority: resolveRequesterAuthority(wallet, args),
    operations: args.operations.map(prepareOperationRequest),
  };
}

export function swapRequest(
  wallet: WalletHandle,
  args: SwapArgs,
  defaultNetwork?: Network,
) {
  return {
    network: toProtoNetwork(
      resolveNetwork(args.network, wallet.network, defaultNetwork),
    ),
    feePayer: args.feePayer,
    swigAddress: wallet.swigConfigAddress,
    requesterAuthority: resolveRequesterAuthority(wallet, args),
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: normalizeAmount(args.amount),
    slippageBps: args.slippageBps,
    destinationAccount: args.destinationAccount,
    wrapAndUnwrapSol: args.wrapAndUnwrapSol,
    tipAmountLamports:
      args.tipAmountLamports === undefined
        ? undefined
        : normalizeAmount(args.tipAmountLamports),
    computeUnitPricePercentile: args.computeUnitPricePercentile,
    maxAccounts: args.maxAccounts,
    mode: args.mode,
    blockhashSlotsToExpiry: args.blockhashSlotsToExpiry,
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

function prepareOperationRequest(operation: PrepareOperation) {
  switch (operation.type) {
    case 'transferSol':
      return {
        transferSol: {
          destination: operation.destination,
          lamports: normalizeAmount(operation.amount),
        },
      };
    case 'transferToken':
      return {
        transferToken: {
          mint: operation.mint,
          destinationOwner: operation.destinationOwner,
          amount: normalizeAmount(operation.amount),
        },
      };
  }
}

function resolveNetwork(...networks: Array<Network | undefined>): Network {
  const network = networks.find((candidate) => candidate !== undefined);
  if (!network) {
    throw new Error('network is required');
  }
  return network;
}

function resolveRequesterAuthority(
  wallet: WalletHandle,
  args: TransferArgs | SwapArgs | PrepareArgs,
): NonNullable<
  | TransferArgs['requesterAuthority']
  | SwapArgs['requesterAuthority']
  | PrepareArgs['requesterAuthority']
> {
  const requesterAuthority =
    args.requesterAuthority ?? wallet.requesterAuthority;
  if (!requesterAuthority) {
    throw new Error('requesterAuthority is required');
  }
  return requesterAuthority;
}
