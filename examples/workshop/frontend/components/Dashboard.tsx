'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Zap, Wallet } from 'lucide-react';
import { formatSol } from '../lib/solana';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface Account {
  id: string;
  swigAddress: string;
  walletAddress: string;
  userAddress: string;
  managerAddress: string;
  balance?: number;
}

const API_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : 'http://localhost:3001';

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/accounts`);
      setAccounts(res.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchAccounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualTransfer = async (accountId: string) => {
    setTransferring(accountId);
    try {
      await axios.post(`${API_URL}/api/accounts/${accountId}/transfer`, {
        amount: 0.01,
      });
      // Refresh after a delay
      setTimeout(fetchAccounts, 2000);
    } catch (err) {
      console.error('Failed to trigger transfer:', err);
      alert('Failed to trigger transfer');
    } finally {
      setTransferring(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent"></div>
            <p className="text-slate-600">Loading accounts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Dashboard</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAccounts}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">
                No accounts registered yet.
              </p>
              <p className="text-sm text-slate-500">
                Complete steps 1-3 to register an account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <Card key={account.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Wallet className="h-5 w-5" />
                            Swig Account
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                Swig Address
                              </label>
                              <div className="font-mono text-xs break-all bg-slate-50 p-2 rounded border border-slate-200 text-slate-900">
                                {account.swigAddress}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">
                                Wallet Address
                              </label>
                              <div className="font-mono text-xs break-all bg-slate-50 p-2 rounded border border-slate-200 text-slate-900">
                                {account.walletAddress}
                              </div>
                            </div>
                            {account.balance !== undefined && (
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  Balance
                                </label>
                                <div className="font-mono text-xl font-bold text-slate-900">
                                  {formatSol(account.balance)} SOL
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start justify-end">
                        <Button
                          onClick={() => handleManualTransfer(account.id)}
                          disabled={transferring === account.id}
                          variant="outline"
                          className="gap-2"
                        >
                          {transferring === account.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4" />
                              Trigger Transfer (0.01 SOL)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Automated Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 leading-relaxed">
            The backend automatically performs small transfers (0.01 SOL) every 1
            second on registered accounts. Watch the balances update in
            real-time!
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Auto-refresh every 5s</Badge>
            <Badge variant="secondary">0.01 SOL per transfer</Badge>
            <Badge variant="secondary">1s interval</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
