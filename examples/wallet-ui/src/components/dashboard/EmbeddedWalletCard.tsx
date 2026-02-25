import { useMemo, useState } from 'react';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { CircleDollarSign, Copy, Key, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLamportBalance } from '@/hooks/useBalance';
import { useAirdrop } from '@/hooks/useAirdrop';
import { lamportsToSol } from '@/services/solana';

function truncateAddress(address: string | null) {
  if (!address) return '—';
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

type EmbeddedWalletCardProps = {
  connection: Connection | null;
  keypair: Keypair | null;
  publicKey: PublicKey | null;
  publicKeyBase58: string | null;
  secretBase64: string | null;
  onRegenerate: () => void;
  onResetSwig: () => void;
};

export function EmbeddedWalletCard({
  connection,
  keypair,
  publicKey,
  publicKeyBase58,
  secretBase64,
  onRegenerate,
  onResetSwig,
}: EmbeddedWalletCardProps) {
  const [secretRevealed, setSecretRevealed] = useState(false);
  const { data: balance, refetch, isLoading } = useLamportBalance(
    connection,
    publicKey ?? null,
  );
  const airdrop = useAirdrop(connection, publicKey ?? null);

  const balanceSol = useMemo(() => {
    if (balance === undefined) return '—';
    return lamportsToSol(balance).toFixed(3);
  }, [balance]);

  const handleCopy = async (value: string | null, label: string) => {
    if (!value) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.warning('Clipboard unavailable in this environment');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Clipboard copy failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRegenerate = () => {
    onRegenerate();
    onResetSwig();
    void refetch();
    toast('Embedded key rotated', {
      description: 'Active SWiG references were cleared. Recreate a wallet to continue.',
    });
  };

  return (
    <Card className="h-full border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Key className="h-4 w-4 opacity-70" />
            Embedded authority
          </CardTitle>
          <CardDescription>
            Persistent ed25519 key stored in local storage for rapid prototyping.
          </CardDescription>
        </div>
        <Badge variant="outline">
          {keypair ? 'Ready' : 'Generating'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Public key
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {truncateAddress(publicKeyBase58)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400">
              {balanceSol} SOL
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(publicKeyBase58, 'Public key')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Secret key (base64)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSecretRevealed((value) => !value)}
            >
              {secretRevealed ? 'Hide' : 'Reveal'}
            </Button>
          </div>
          <Input
            value={secretRevealed ? secretBase64 ?? '' : secretBase64 ? '••••••••••••' : ''}
            readOnly
            className="mt-2 font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(secretBase64, 'Secret key')}
            >
              Copy secret
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Rotate key
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 text-xs text-muted-foreground">
        <Button
          size="sm"
          onClick={() =>
            airdrop
              .mutateAsync(2)
              .then(() => {
                toast.success('2 SOL airdrop requested');
                void refetch();
              })
              .catch((error) =>
                toast.error('Airdrop failed', {
                  description: error instanceof Error ? error.message : String(error),
                }),
              )
          }
          disabled={airdrop.isPending || !publicKey}
        >
          <CircleDollarSign className="mr-2 h-4 w-4" /> Request 2 SOL
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading}
        >
          Refresh balance
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Stored locally — wiping browser storage clears this key.
        </span>
      </CardFooter>
    </Card>
  );
}
