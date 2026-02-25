import { useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import QRCode from 'react-qr-code';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { lamportsToSol } from '@/services/solana';
import { useLamportBalance } from '@/hooks/useBalance';
import { useAirdrop } from '@/hooks/useAirdrop';
import { bytesToBase64 } from '@/lib/bytes';
import type { useSwigManager } from '@/hooks/useSwigManager';
import { toast } from 'sonner';

function formatLamports(lamports: number | undefined) {
  if (lamports === undefined) return '—';
  return `${lamportsToSol(lamports).toFixed(3)} SOL`;
}

type SwigOverviewCardProps = {
  connection: Connection | null;
  manager: ReturnType<typeof useSwigManager>;
  onRefresh: () => void;
};

export function SwigOverviewCard({ connection, manager, onRefresh }: SwigOverviewCardProps) {
  const { swig, reference, mutationState, create, status, error, roles } = manager;
  const swigAddress = reference?.address ?? null;
  const swigId = reference?.id ?? null;

  const swigBalance = useLamportBalance(connection, swigAddress);
  const swigAirdrop = useAirdrop(connection, swigAddress);
  const displayStatus = useMemo(() => {
    if (mutationState === 'pending') return 'Working…';
    if (status === 'error' && error) return error.message;
    if (!swig) return 'No SWiG wallet yet';
    return 'Ready';
  }, [mutationState, status, error, swig]);

  const primaryAction = () => {
    create()
      .then(() => {
        toast.success('SWiG wallet created');
        void swigBalance.refetch();
        onRefresh();
      })
      .catch((err) =>
        toast.error('Failed to create SWiG', {
          description: err instanceof Error ? err.message : String(err),
        }),
      );
  };

  const handleFund = () => {
    swigAirdrop
      .mutateAsync(1)
      .then(() => {
        toast.success('Requested 1 SOL airdrop for SWiG');
        void swigBalance.refetch();
        onRefresh();
      })
      .catch((err) =>
        toast.error('Airdrop failed', {
          description: err instanceof Error ? err.message : String(err),
        }),
      );
  };

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-6">
        <div className="space-y-2">
          <CardTitle className="text-lg text-foreground">SWiG wallet</CardTitle>
          <CardDescription>
            Program-derived account with SWiG capabilities managed by your embedded key.
          </CardDescription>
        </div>
        <Badge variant={swig ? 'success' : 'outline'}>{displayStatus}</Badge>
      </CardHeader>
      <CardContent>
        {swig ? (
          <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Address
                </p>
                <div className="mt-1 flex items-center justify-between gap-4">
                  <p className="font-mono text-sm text-foreground">
                    {swigAddress?.toBase58()}
                  </p>
                  <Badge variant="outline">{formatLamports(swigBalance.data)}</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Wallet ID (base64)
                  </p>
                  <Badge variant="outline">Roles {roles.length}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {swigId ? bytesToBase64(swigId) : '—'}
                </p>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Button size="sm" onClick={handleFund} disabled={swigAirdrop.isPending}>
                  Fund 1 SOL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void swigBalance.refetch();
                    onRefresh();
                  }}
                >
                  Refresh state
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-background/60 p-6 text-center">
              {swigAddress ? (
                <div className="rounded-2xl border border-border/40 bg-card/70 p-4 shadow-inner">
                  <QRCode
                    value={swigAddress.toBase58()}
                    size={160}
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    bgColor="transparent"
                    fgColor="rgba(255,255,255,0.9)"
                  />
                </div>
              ) : null}
              <p className="text-sm font-medium text-foreground">Shareable QR</p>
              <p className="text-xs text-muted-foreground">
                Scan on another device to import the SWiG PDA address.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-6 rounded-xl border border-dashed border-border/60 bg-background/50 p-8 text-sm text-muted-foreground">
            <div>
              <p className="text-base font-medium text-foreground">
                No SWiG yet — spin one up
              </p>
              <p className="max-w-xl text-sm text-muted-foreground">
                We’ll derive a PDA, seed it with your embedded key as the root authority, and be ready to manage permissions instantly.
              </p>
            </div>
            <Button size="lg" onClick={primaryAction} disabled={mutationState === 'pending'}>
              Create SWiG wallet
            </Button>
          </div>
        )}
      </CardContent>
      {swig ? (
        <CardFooter className="border-t border-border/60 bg-muted/10 px-6 py-4 text-xs text-muted-foreground">
          QR encodes {swigAddress?.toBase58()} — perfect for mobile cross-device flows.
        </CardFooter>
      ) : null}
    </Card>
  );
}
