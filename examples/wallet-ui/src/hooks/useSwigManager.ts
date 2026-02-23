import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, Keypair } from '@solana/web3.js';
import { Actions, Swig } from '@swig-wallet/classic';
import {
  addAuthorityToSwig,
  createSwigWallet,
  deserializeSwigReference,
  findRootRole,
  refreshSwig,
  removeAuthorityFromSwig,
  serializeSwigReference,
  type SerializedSwigReference,
} from '@/services/swig';
import { useLocalStorage } from './useLocalStorage';

const SWIG_STORAGE_KEY = 'swig-wallet/active-swig';

type SwigManagerState = 'idle' | 'loading' | 'ready' | 'error';

type MutationState = 'idle' | 'pending';

export function useSwigManager(
  connection: Connection | null,
  payer: Keypair | null,
) {
  const [storedReference, setStoredReference, clearStoredReference] =
    useLocalStorage<SerializedSwigReference | null>(SWIG_STORAGE_KEY, () => null);
  const [swig, setSwig] = useState<Swig | null>(null);
  const [status, setStatus] = useState<SwigManagerState>('idle');
  const [mutationState, setMutationState] = useState<MutationState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!connection || !storedReference) {
      setStatus('idle');
      setSwig(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    refreshSwig(connection, storedReference)
      .then((latest) => {
        if (cancelled) return;
        setSwig(latest);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
        setSwig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [connection, storedReference?.address, storedReference?.idBase64]);

  const create = useCallback(async () => {
    if (!connection || !payer) {
      throw new Error('Missing connection or payer');
    }
    setMutationState('pending');
    setError(null);

    try {
      const result = await createSwigWallet({ connection, payer });
      const reference = serializeSwigReference(result.swigId, result.swigAddress);
      setStoredReference(reference);
      setSwig(result.swig);
      setStatus('ready');
      return { ...result, reference };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setStatus('error');
      throw error;
    } finally {
      setMutationState('idle');
    }
  }, [connection, payer, setStoredReference]);

  const reset = useCallback(() => {
    clearStoredReference();
    setSwig(null);
    setStatus('idle');
    setError(null);
  }, [clearStoredReference]);

  const mutate = useCallback(
    async (executor: () => Promise<string>) => {
      setMutationState('pending');
      setError(null);
      try {
        const signature = await executor();
        if (connection && storedReference) {
          const refreshed = await refreshSwig(connection, storedReference);
          setSwig(refreshed);
          setStatus('ready');
        }
        return signature;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStatus('error');
        throw error;
      } finally {
        setMutationState('idle');
      }
    },
    [connection, storedReference],
  );

  const addEd25519Authority = useCallback(
    async (params: { actingRoleId: number; authority: Uint8Array | string; actions: Actions }) => {
      if (!connection || !payer || !swig) {
        throw new Error('Wallet not ready');
      }
      return mutate(() =>
        addAuthorityToSwig({
          connection,
          swig,
          actingRoleId: params.actingRoleId,
          payer,
          authorityInfo: params.authority,
          actions: params.actions,
        }),
      );
    },
    [connection, mutate, payer, swig],
  );

  const removeAuthority = useCallback(
    async (params: { actingRoleId: number; roleIdToRemove: number }) => {
      if (!connection || !payer || !swig) {
        throw new Error('Wallet not ready');
      }
      return mutate(() =>
        removeAuthorityFromSwig({
          connection,
          swig,
          actingRoleId: params.actingRoleId,
          roleIdToRemove: params.roleIdToRemove,
          payer,
        }),
      );
    },
    [connection, mutate, payer, swig],
  );

  const replaceEd25519Authority = useCallback(
    async (params: {
      actingRoleId: number;
      roleId: number;
      authority: Uint8Array | string;
      actions: Actions;
    }) => {
      if (!connection || !payer || !swig) {
        throw new Error('Wallet not ready');
      }

      return mutate(async () => {
        await removeAuthorityFromSwig({
          connection,
          swig,
          actingRoleId: params.actingRoleId,
          roleIdToRemove: params.roleId,
          payer,
        });

        return addAuthorityToSwig({
          connection,
          swig,
          actingRoleId: params.actingRoleId,
          payer,
          authorityInfo: params.authority,
          actions: params.actions,
        });
      });
    },
    [connection, mutate, payer, swig],
  );

  const activeReference = useMemo(() => {
    if (!storedReference) return null;
    const { id, address } = deserializeSwigReference(storedReference);
    return { reference: storedReference, id, address } as const;
  }, [storedReference]);

  const roles = swig?.roles ?? [];
  const rootRole = useMemo(() => findRootRole(roles, payer?.publicKey ?? null), [
    payer?.publicKey,
    roles,
  ]);

  return {
    swig,
    roles,
    rootRole,
    status,
    mutationState,
    error,
    reference: activeReference,
    create,
    reset,
    addEd25519Authority,
    replaceEd25519Authority,
    removeAuthority,
  } as const;
}
