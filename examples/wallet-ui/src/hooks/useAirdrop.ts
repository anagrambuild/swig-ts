import { Connection, PublicKey } from '@solana/web3.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestAirdropAndConfirm } from '@/services/solana';

export function useAirdrop(
  connection: Connection | null,
  address: PublicKey | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (solAmount: number) => {
      if (!connection || !address) {
        throw new Error('Wallet not ready');
      }
      return requestAirdropAndConfirm({
        connection,
        recipient: address,
        solAmount,
      });
    },
    onSuccess: () => {
      if (address) {
        void queryClient.invalidateQueries({
          queryKey: ['balance', address.toBase58()],
        });
      }
    },
  });
}
