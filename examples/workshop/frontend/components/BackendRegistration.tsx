'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { address } from '@solana/kit';
import { Loader2 } from 'lucide-react';
import type { Address } from '@solana/kit';
import type { SwigAccount } from '../hooks/useSwig';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface Props {
  account: SwigAccount | null;
  loading: boolean;
  error: string | null;
  delegateToBackend: (backendAddress: Address) => Promise<void>;
  onRegistered: () => void;
}

const API_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : 'http://localhost:3001';

export default function BackendRegistration({
  account,
  loading,
  error,
  delegateToBackend,
  onRegistered,
}: Props) {
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch backend address on mount
    axios
      .get(`${API_URL}/api/backend-address`)
      .then((res) => {
        setBackendAddress(res.data.address);
      })
      .catch((err) => {
        console.error('Failed to fetch backend address:', err);
        setRegisterError('Failed to connect to backend');
      });
  }, []);

  const handleRegister = async () => {
    if (!account || !backendAddress) {
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      // First, delegate authority to backend
      await delegateToBackend(address(backendAddress));

      // Then register with backend API
      await axios.post(`${API_URL}/api/accounts`, {
        swigAddress: account.address.toString(),
        walletAddress: account.walletAddress?.toString(),
        userAddress: account.userKeypair.address.toString(),
        managerAddress: account.managerKeypair.address.toString(),
      });

      onRegistered();
    } catch (err) {
      console.error('Failed to register with backend:', err);
      setRegisterError(
        err instanceof Error ? err.message : 'Failed to register',
      );
    } finally {
      setRegistering(false);
    }
  };

  if (!account) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Step 3: Register with Backend</CardTitle>
        <p className="text-slate-600 mt-2">
          Delegate limited permissions (0.1 SOL spending limit) to the backend
          and register your account for automated actions.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {backendAddress ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">
              Backend Address
            </label>
            <div className="font-mono text-xs break-all bg-slate-100 p-3 rounded-lg border border-slate-200 text-slate-700">
              {backendAddress}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">0.1 SOL Limit</Badge>
              <Badge variant="secondary">Automated Actions</Badge>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting to backend...</span>
          </div>
        )}

        {(error || registerError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || registerError}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleRegister}
          disabled={loading || registering || !backendAddress}
          size="lg"
          className="w-full sm:w-auto"
        >
          {loading || registering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Registering...
            </>
          ) : (
            'Register with Backend'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
