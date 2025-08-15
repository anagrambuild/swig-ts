// STEP 3: Backend Registration Component
// This component handles delegation to the backend and registration for automated actions
import type { Address } from '@solana/kit';
import { useEffect, useState } from 'react';
import type { SwigAccount } from '../hooks/useSwig';
import { apiClient } from '../lib/api';

interface Props {
  account: SwigAccount | null;
  loading: boolean;
  error: string | null;
  delegateToBackend: (backendAddress: Address) => Promise<void>;
  refreshSwig: () => Promise<void>;
  onRegistered: () => void;
}

export default function BackendRegistration({
  account,
  loading: swigLoading,
  error: swigError,
  delegateToBackend,
  refreshSwig,
  onRegistered,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  // STEP 3: Fetch the backend wallet address for delegation
  useEffect(() => {
    const fetchBackendAddress = async () => {
      try {
        const response = await apiClient.getBackendAddress();
        if (response.success && response.backendAddress) {
          setBackendAddress(response.backendAddress);
        } else {
          setError('Failed to fetch backend address');
        }
      } catch (err) {
        console.error('Error fetching backend address:', err);
        setError('Failed to connect to backend');
      }
    };

    fetchBackendAddress();
  }, []);

  // STEP 3: Handle the two-part registration process
  const handleRegister = async () => {
    if (!account || !backendAddress) return;

    setLoading(true);
    setError(null);

    try {
      // STEP 3a: Grant delegation authority to the backend
      await delegateToBackend(backendAddress as any);

      // STEP 3b: Register account details with the backend API
      const response = await apiClient.registerAccount({
        swigAddress: account.address,
        userAddress: account.userKeypair.address,
        id: Buffer.from(account.id).toString('hex'),
      });

      if (response.success) {
        // Refresh Swig data to show updated authorities
        await refreshSwig();
        setRegistered(true);
        onRegistered(); // Move to dashboard step
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      console.error('Failed to register with backend:', err);
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="card opacity-50">
        <h2 className="text-2xl font-bold mb-4">
          Step 3: Register with Backend
        </h2>
        <p className="text-gray-500">Create and fund a Swig account first</p>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="card border-green-200 bg-green-50">
        <h2 className="text-2xl font-bold mb-4 text-green-600">
          ✅ Registered with Backend
        </h2>

        <p className="text-green-700 mb-4">
          Your Swig account has been successfully registered with the backend
          and delegation has been granted for automated actions.
        </p>

        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Swig Address:</span>
            <span className="font-mono ml-2">{account.address}</span>
          </div>
          <div>
            <span className="font-medium">Backend Address:</span>
            <span className="font-mono ml-2">{backendAddress}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-4">Step 3: Register with Backend</h2>

      <p className="text-gray-600 mb-6">
        Register your Swig account with the backend and delegate permissions for
        automated actions.
      </p>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-medium text-blue-900 mb-2">What this does:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Grants the backend authority to spend up to 0.1 SOL</li>
          <li>• Registers your account in the backend's memory store</li>
          <li>• Enables automated actions on your behalf</li>
        </ul>
      </div>

      {(error || swigError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error || swigError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Backend Address
          </label>
          <div className="font-mono text-sm bg-gray-100 p-2 rounded">
            {backendAddress || 'Loading backend address...'}
          </div>
        </div>

        <button
          onClick={handleRegister}
          disabled={loading || swigLoading || !backendAddress}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading || swigLoading
            ? 'Registering...'
            : !backendAddress
              ? 'Loading Backend...'
              : 'Register with Backend'}
        </button>
      </div>
    </div>
  );
}
