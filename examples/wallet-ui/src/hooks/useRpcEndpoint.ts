import { useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

const RPC_KEY = 'swig-wallet/rpc-endpoint';
const DEFAULT_RPC = 'http://127.0.0.1:8899';

export function useRpcEndpoint() {
  const [endpoint, setEndpoint] = useLocalStorage<string>(
    RPC_KEY,
    () => DEFAULT_RPC,
  );

  const rpc = useMemo(() => endpoint.trim() || DEFAULT_RPC, [endpoint]);

  return {
    rpc,
    setRpc: setEndpoint,
    resetRpc: () => setEndpoint(DEFAULT_RPC),
  } as const;
}

export { DEFAULT_RPC };
