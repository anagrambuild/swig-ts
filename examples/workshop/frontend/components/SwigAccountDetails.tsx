'use client';

import { RefreshCw } from 'lucide-react';
import { formatSol } from '../lib/solana';
import type { SwigAccount } from '../hooks/useSwig';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface Props {
  account: SwigAccount;
  refreshSwig: () => Promise<void>;
}

export default function SwigAccountDetails({
  account,
  refreshSwig,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Swig Account Details</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSwig}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Swig Address
            </label>
            <div className="font-mono text-xs break-all bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
              {account.address.toString()}
            </div>
          </div>
          {account.walletAddress && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Wallet Address
              </label>
              <div className="font-mono text-xs break-all bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
                {account.walletAddress.toString()}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              User Keypair
            </label>
            <div className="font-mono text-xs break-all bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
              {account.userKeypair.address.toString()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Manager Keypair
            </label>
            <div className="font-mono text-xs break-all bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
              {account.managerKeypair.address.toString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
