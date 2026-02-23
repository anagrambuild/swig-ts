import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { fetchLamportBalance } from '@/services/solana';
export function useLamportBalance(connection, address) {
    return useQuery({
        queryKey: ['balance', address?.toBase58()],
        queryFn: () => {
            if (!connection || !address) {
                throw new Error('Wallet not ready');
            }
            return fetchLamportBalance(connection, address);
        },
        enabled: Boolean(connection && address),
        refetchInterval: 10_000,
    });
}
