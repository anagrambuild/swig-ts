import { GoToExplorer } from '@/components/GoToExplorer';
import { PasskeyManager } from '@/helpers/passkey';
import { getSwigAddress, payerKeypair } from '@/helpers/solana';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import type { Role } from '@swig-wallet/classic';
import {
  Actions,
  AuthorityType,
  createSecp256r1AuthorityInfo,
  fetchSwig,
  getCreateSwigInstruction,
  getSignInstructions,
  getWebAuthnPrefix,
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

      const createSwigInstruction = await getCreateSwigInstruction({
        payer: payerKeypair.publicKey,
        id: swigId,
        actions: Actions.set().all().get(),
        authorityInfo,
      });

      const transaction = new Transaction({
        feePayer: payerKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).add(createSwigInstruction);

      return sendAndConfirmTransaction(connection, transaction, [payerKeypair]);
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
      await swig.refetch();
      let role: Role | undefined;

      // Look for secp256r1 authorities that match our passkey public key
      for (const signerRole of swig.roles) {
        if (signerRole.authority.type === AuthorityType.Secp256r1) {
          // For secp256r1, we need to check if the public key matches
          // The authority data should contain the 33-byte compressed public key
          const authorityData = signerRole.authority.data;
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
              role = signerRole;
              break;
            }
          }
        }
      }

      if (!role) {
        throw new Error(
          'No matching secp256r1 authority found for this passkey',
        );
      }

      const ixs = await getSignInstructions(
        swig,
        role.id,
        [
          SystemProgram.transfer({
            lamports: 0.1 * LAMPORTS_PER_SOL,
            fromPubkey: swigAddress,
            toPubkey: Keypair.generate().publicKey,
          }),
        ],
        false,
        {
          payer: payerKeypair.publicKey,
          currentSlot: BigInt(await connection.getSlot()),
          signingFn: async (message: Uint8Array) => {
            // Sign with passkey (this will trigger browser authentication)
            const passkeySignature =
              await PasskeyManager.signWithPasskey(message);

            // Return in the format expected by secp256r1 authority
            // Note: We need to return the WebAuthn message hash for the precompile to verify correctly
            const prefix = await getWebAuthnPrefix(
              new Uint8Array(passkeySignature.clientDataJSON),
              new Uint8Array(passkeySignature.authenticatorData),
            );

            return {
              signature: passkeySignature.signature,
              prefix,
              message: passkeySignature.webAuthnMessage, // The actual message WebAuthn signed
            };
          },
        },
      );

      const transaction = new Transaction({
        feePayer: payerKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).add(...ixs);

      return sendAndConfirmTransaction(connection, transaction, [payerKeypair]);
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
