import { Connection } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ConnectionStatus = 'idle' | 'connecting' | 'ready' | 'error';

export function useConnection(rpc: string) {
  const connection = useMemo(
    () => new Connection(rpc, { commitment: 'confirmed' }),
    [rpc],
  );

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      setStatus('connecting');
      setError(null);
      try {
        const start = performance.now();
        await connection.getVersion();
        const end = performance.now();
        if (cancelled) return;
        setLatencyMs(end - start);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
        setLatencyMs(null);
      }
    }

    void probe();

    return () => {
      cancelled = true;
    };
  }, [connection, refreshIndex]);

  const refresh = useCallback(() => {
    setRefreshIndex((value) => value + 1);
  }, []);

  return { connection, status, latencyMs, error, refresh } as const;
}
