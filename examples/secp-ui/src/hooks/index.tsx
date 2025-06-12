import { GoToExplorer } from '@/components/GoToExplorer';
import { getSwigAddress, payerKeypair } from '@/helpers/solana';
import { useConnection } from '@solana/wallet-adapter-react';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import {
  Actions,
  createSecp256k1AuthorityInfo,
  createSwig,
  fetchSwig,
  getEvmPersonalSignPrefix,
  signAndSend,
} from '@swig-wallet/classic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hashMessage, hexToBytes, recoverPublicKey } from 'viem';
import { useAccount, useSignMessage } from 'wagmi';
import { SwigIdStore } from '../helpers/session';

export function useSwigAddres() {
  const query = useQuery({
    queryKey: ['swig', 'address'],
    queryFn: () => getSwigAddress(),
  });

  return {
    swigAddress: query.data?.swigAddress,
    swigId: query.data?.swigId,
    ...query,
  };
}

export function useGenerate() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => SwigIdStore.resetId(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
  });

  return {
    generateId: mutation.mutate,
    ...mutation,
  };
}

export function useSwig() {
  const { connection } = useConnection();
  const { swigAddress } = getSwigAddress();

  const query = useQuery({
    queryKey: ['swig'],
    queryFn: () => fetchSwig(connection, swigAddress),
    refetchInterval: 60 * 1000,
  });

  return { swig: query.data, ...query };
}

export function useWalletPublicKey() {
  const { signMessageAsync } = useSignMessage();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const queryKey = ['publicKey', address];
  const queryFn = async () => {
    const message = 'sign in';
    const signature = await signMessageAsync({ message });
    const hash = hashMessage(message);
    return recoverPublicKey({ signature, hash });
  };

  const { data: publicKey } = useQuery({
    queryKey,
    queryFn,
    enabled: false,
    staleTime: Infinity,
  });

  const getPublicKey = async () => {
    const cached = queryClient.getQueryData<`0x${string}`>(queryKey);
    if (cached) return cached;

    const publicKey = await queryFn();

    queryClient.setQueryData(queryKey, publicKey);
    return publicKey;
  };

  return {
    publicKey,
    getPublicKey,
  };
}

export function useCreateSwig() {
  const { swigId } = getSwigAddress();
  const { connection } = useConnection();
  const { getPublicKey } = useWalletPublicKey();
  const queryClient = useQueryClient();

  // Mutations
  const mutation = useMutation({
    mutationFn: async () => {
      return createSwig(
        connection,
        swigId,
        createSecp256k1AuthorityInfo(await getPublicKey()),
        Actions.set().all().get(),
        payerKeypair.publicKey,
        [payerKeypair],
      );
    },
    onSuccess: (tx) => {
      toast.success('Transaction successful!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });

      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
    onError: (err) => {
      console.error('error:', err);
      toast.error(`Transaction failed. ${err.message || err}`);
    },
  });

  return {
    createSwigAsync: mutation.mutateAsync,
    ...mutation,
  };
}

export function useSwigBalance() {
  const { connection } = useConnection();
  const { swigAddress } = getSwigAddress();

  const query = useQuery({
    queryKey: ['swig', 'balance'],
    queryFn: () => connection.getBalance(swigAddress, 'processed'),
    refetchInterval: 3 * 1000,
  });

  return { swigBalance: query.data, ...query };
}

export function useSwigTransfer() {
  const { swigAddress } = getSwigAddress();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { swig } = useSwig();
  const { signMessageAsync } = useSignMessage();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('Wallet not connected');
      if (!swig) throw new Error('Swig not created');
      let signerRoles = swig.findRolesBySecp256k1SignerAddress(address);
      if (!signerRoles)
        throw new Error(`No roles found from wallet address ${address}`);
      return signAndSend(
        connection,
        [
          SystemProgram.transfer({
            lamports: 0.1 * LAMPORTS_PER_SOL,
            fromPubkey: swigAddress,
            toPubkey: Keypair.generate().publicKey,
          }),
        ],
        swigAddress,
        signerRoles[0].authority,
        payerKeypair.publicKey,
        [payerKeypair],

        async (message: Uint8Array) => {
          let signed = await signMessageAsync({
            message: { raw: message },
          });

          return {
            signature: hexToBytes(signed),
            prefix: getEvmPersonalSignPrefix(message.length),
          };
        },
      );
    },
    onSuccess: (tx) => {
      toast.success('Transaction successful!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });

      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
    onError: (err) => {
      console.error('error:', err);
      toast.error(`Transaction failed. ${err.message || err}`);
    },
  });

  return {
    swigTransferAsync: mutation.mutateAsync,
    ...mutation,
  };
}

export function useRequestAirdrop() {
  const { swigAddress } = getSwigAddress();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const {} = useSwigBalance();

  const mutation = useMutation({
    mutationFn: async () =>
      connection.requestAirdrop(swigAddress, LAMPORTS_PER_SOL * 100),
    onSuccess: (tx) => {
      toast.success('Transaction successful!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });
      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
    onError: (err) => {
      console.error('error:', err);
      toast.error(`Transaction failed. ${err.message || err}`);
    },
  });

  return {
    requestAirdropAsync: mutation.mutateAsync,
    ...mutation,
  };
}
