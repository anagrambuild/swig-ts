import { GoToExplorer } from '@/components/GoToExplorer';
import { PasskeyManager } from '@/helpers/passkey';
import { getSwigAddress, payerKeypair } from '@/helpers/solana';
import { keccak_256 } from '@noble/hashes/sha3';
import { useConnection } from '@solana/wallet-adapter-react';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import type { Authority } from '@swig-wallet/classic';
import {
  Actions,
  AuthorityType,
  createSecp256r1AuthorityInfo,
  createSwig,
  fetchSwig,
  signAndSend,
} from '@swig-wallet/classic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function usePasskeySupport() {
  const query = useQuery({
    queryKey: ['passkey', 'support'],
    queryFn: () => PasskeyManager.isSupported(),
    staleTime: Infinity,
  });

  return {
    isSupported: query.data,
    ...query,
  };
}

export function usePasskeyCredential() {
  const query = useQuery({
    queryKey: ['passkey', 'credential'],
    queryFn: () => PasskeyManager.getStoredCredential(),
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    credential: query.data,
    hasCredential: !!query.data,
    ...query,
  };
}

export function useCreatePasskey() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (username?: string) => {
      if (!PasskeyManager.isSupported()) {
        throw new Error('Passkeys are not supported in this browser');
      }

      return PasskeyManager.createPasskey(username);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkey'], exact: false });
      toast.success('Passkey created successfully!');
    },
    onError: (err) => {
      console.error('Passkey creation error:', err);
      toast.error(`Failed to create passkey: ${err.message || err}`);
    },
  });

  return {
    createPasskeyAsync: mutation.mutateAsync,
    createPasskey: mutation.mutate,
    ...mutation,
  };
}

export function useClearPasskey() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      PasskeyManager.clearStoredCredential();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkey'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
      toast.success('Passkey cleared successfully!');
    },
    onError: (err) => {
      console.error('Clear passkey error:', err);
      toast.error(`Failed to clear passkey: ${err.message || err}`);
    },
  });

  return {
    clearPasskeyAsync: mutation.mutateAsync,
    clearPasskey: mutation.mutate,
    ...mutation,
  };
}

export function useCreateSwigWithPasskey() {
  const { swigId } = getSwigAddress();
  const { connection } = useConnection();
  const { credential } = usePasskeyCredential();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!credential) {
        throw new Error(
          'No passkey credential found. Please create one first.',
        );
      }

      // Create secp256r1 authority info using the passkey's public key
      const authorityInfo = createSecp256r1AuthorityInfo(credential.publicKey);

      console.log({ payerKeypair: payerKeypair.publicKey.toString() });

      return createSwig(
        connection,
        swigId,
        authorityInfo,
        Actions.set().all().get(),
        payerKeypair.publicKey,
        [payerKeypair],
      );
    },
    onSuccess: (tx) => {
      toast.success('Swig wallet created with passkey!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });

      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
    onError: (err) => {
      console.error('Create Swig error:', err);
      toast.error(`Failed to create Swig wallet: ${err.message || err}`);
    },
  });

  return {
    createSwigWithPasskeyAsync: mutation.mutateAsync,
    createSwigWithPasskey: mutation.mutate,
    ...mutation,
  };
}

export function useSwigTransferWithPasskey() {
  const { swigAddress } = getSwigAddress();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { credential } = usePasskeyCredential();

  const query = useQuery({
    queryKey: ['swig', 'passkey'],
    queryFn: () => fetchSwig(connection, swigAddress),
    refetchInterval: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!credential) {
        throw new Error('No passkey credential found');
      }

      if (!query.data) {
        throw new Error('Swig wallet not found. Please create one first.');
      }

      // Find the secp256r1 authority role
      const swig = query.data;
      let authority: Authority | undefined;

      // Look for secp256r1 authorities that match our passkey public key
      for (const role of swig.roles) {
        if (role.authority.type === AuthorityType.Secp256r1) {
          // For secp256r1, we need to check if the public key matches
          // The authority data should contain the 33-byte compressed public key
          const authorityData = role.authority.data;
          if (authorityData.length >= 33) {
            const authorityPublicKey = authorityData.slice(0, 33);

            // Compare public keys (both should be 33-byte compressed format)
            if (
              authorityPublicKey.length === credential.publicKey.length &&
              authorityPublicKey.every(
                (byte: number, index: number) =>
                  byte === credential.publicKey[index],
              )
            ) {
              authority = role.authority;
              break;
            }
          }
        }
      }

      if (!authority) {
        throw new Error(
          'No matching secp256r1 authority found for this passkey',
        );
      }

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
        authority,
        payerKeypair.publicKey,
        [payerKeypair],
        async (message: Uint8Array) => {
          // Hash the message using keccak (same as secp256r1 implementation)
          const messageHash = keccak_256(message);

          // Sign with passkey (this will trigger browser authentication)
          const passkeySignature =
            await PasskeyManager.signWithPasskey(messageHash);

          // Return in the format expected by secp256r1 authority
          // Note: We need to return the WebAuthn message hash for the precompile to verify correctly
          return {
            signature: passkeySignature.signature,
            prefix: new Uint8Array(), // No prefix needed for secp256r1
            messageHash: passkeySignature.webAuthnMessageHash, // The actual message WebAuthn signed
          };
        },
      );
    },
    onSuccess: (tx) => {
      toast.success('Transfer completed with passkey authentication!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });

      queryClient.invalidateQueries({ queryKey: ['swig'], exact: false });
    },
    onError: (err) => {
      console.error('Passkey transfer error:', err);
      toast.error(`Transfer failed: ${err.message || err}`);
    },
  });

  return {
    transferWithPasskeyAsync: mutation.mutateAsync,
    transferWithPasskey: mutation.mutate,
    swig: query.data,
    ...mutation,
  };
}
