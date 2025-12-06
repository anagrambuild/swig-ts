import { createSolanaRpc, type Rpc, type SolanaRpcApi } from '@solana/kit';

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export type SolanaConnection = {
  rpc: Rpc<SolanaRpcApi>;
};

const RPC_URL = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';

export function createConnection(): SolanaConnection {
  return {
    rpc: createSolanaRpc(RPC_URL),
  };
}
