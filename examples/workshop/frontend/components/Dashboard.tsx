// STEP 4: Dashboard Component
// This component displays the backend status and allows monitoring/triggering automated actions
import { Activity, RefreshCw, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient, type StatusResponse } from '../lib/api';
import { formatSol } from '../lib/solana';
import TransactionLink from './TransactionLink';

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [lastTransactionSignature, setLastTransactionSignature] = useState<
    string | null
  >(null);

  // STEP 4: Fetch backend status including registered accounts and job status
  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getStatus();
      setStatus(response);
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  // STEP 4: Trigger a manual action using the backend's delegated authority
  const triggerAction = async (swigAddress: string) => {
    setTriggerLoading(true);

    try {
      const response = await apiClient.triggerAction({
        swigAddress,
        action: 'transfer', // Backend will perform a SOL transfer action
      });

      if (response.success) {
        console.log('Action triggered:', response.transactionSignature);
        setLastTransactionSignature(response.transactionSignature || null);
        await fetchStatus(); // Refresh status to show updated balances
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      console.error('Failed to trigger action:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger action');
    } finally {
      setTriggerLoading(false);
    }
  };

  // STEP 4: Auto-refresh dashboard data to show real-time backend activity
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Backend Dashboard</h2>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {status && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Total Accounts
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {status.totalAccounts}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Jobs Status</span>
              </div>
              <div className="text-lg font-bold text-green-600">
                {status.jobsRunning ? 'Running' : 'Stopped'}
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-900">Actions</span>
              </div>
              <div className="text-lg font-bold text-purple-600">
                Manual & Auto
              </div>
            </div>
          </div>
        )}

        {/* Latest Transaction */}
        {lastTransactionSignature && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">
              Latest Transaction
            </h3>
            <TransactionLink
              signature={lastTransactionSignature}
              description="Manual Action"
              className="text-green-700"
            />
          </div>
        )}
      </div>

      {status && status.accounts.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Registered Accounts</h3>

          <div className="space-y-4">
            {status.accounts.map((account, index) => (
              <div
                key={account.swigAddress}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium">Account #{index + 1}</div>
                  <div className="text-sm text-gray-500">
                    Registered:{' '}
                    {new Date(account.registeredAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Swig Address
                    </label>
                    <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                      {account.swigAddress}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Balance
                    </label>
                    <div className="font-mono text-lg font-bold">
                      {formatSol(account.balance)} SOL
                    </div>
                  </div>
                </div>

                {account.lastAction && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Action
                    </label>
                    <div className="text-sm text-gray-600">
                      {account.lastAction}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => triggerAction(account.swigAddress)}
                  disabled={triggerLoading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {triggerLoading ? 'Triggering...' : 'Trigger Manual Action'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
