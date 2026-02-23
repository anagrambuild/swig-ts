import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { fetchTransactionHistory } from '@/services/solana';

export function useTransactionHistory(
  connection: Connection | null,
  address: PublicKey | null,
  limit = 20,
) {
  return useQuery({
    queryKey: ['tx-history', address?.toBase58(), limit],
    queryFn: () => {
      if (!connection || !address) {
        throw new Error('Wallet not ready');
      }
      return fetchTransactionHistory(connection, address, limit);
    },
    enabled: Boolean(connection && address),
    refetchInterval: 12_000,
  });
}
