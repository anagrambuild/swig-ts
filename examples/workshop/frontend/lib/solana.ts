import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';

export const SOLANA_RPC_URL = 'http://localhost:8899';
export const SOLANA_WS_URL = 'ws://localhost:8900';
export const LAMPORTS_PER_SOL = 1_000_000_000;

export interface SolanaConnection {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
}

export function createConnection(): SolanaConnection {
  return {
    rpc: createSolanaRpc(SOLANA_RPC_URL),
    rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_URL),
  };
}

export function formatSol(lamports: number | bigint): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  return sol.toFixed(4);
}

export function parseSol(sol: string): bigint {
  return BigInt(parseFloat(sol) * LAMPORTS_PER_SOL);
}
