import { createSolanaRpc, type Rpc, type SolanaRpcApi } from '@solana/kit';

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export type SolanaConnection = {
  rpc: Rpc<SolanaRpcApi>;
};

const RPC_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8899'
    : 'http://127.0.0.1:8899';

export function createConnection(): SolanaConnection {
  return {
    rpc: createSolanaRpc(RPC_URL),
  };
}

export function formatSol(lamports: bigint | number): string {
  const lamportsBigInt =
    typeof lamports === 'number' ? BigInt(lamports) : lamports;
  return (Number(lamportsBigInt) / Number(LAMPORTS_PER_SOL)).toFixed(4);
}
