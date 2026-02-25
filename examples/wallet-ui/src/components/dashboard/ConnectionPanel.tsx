import { useEffect, useState } from 'react';
import { Globe, RefreshCcw, WifiOff } from 'lucide-react';
import type { ConnectionStatus } from '@/hooks/useConnection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const statusCopy: Record<ConnectionStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  ready: 'Healthy',
  error: 'Unreachable',
};

const statusTone: Record<ConnectionStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  connecting: 'bg-amber-500/10 text-amber-400',
  ready: 'bg-emerald-500/10 text-emerald-400',
  error: 'bg-destructive/10 text-destructive',
};

type ConnectionPanelProps = {
  rpc: string;
  status: ConnectionStatus;
  latencyMs: number | null;
  error: Error | null;
  onRpcChange: (value: string) => void;
  onReset: () => void;
  onRefresh: () => void;
};

export function ConnectionPanel(props: ConnectionPanelProps) {
  const { rpc, status, latencyMs, error, onRpcChange, onReset, onRefresh } = props;
  const [draft, setDraft] = useState(rpc);

  useEffect(() => {
    setDraft(rpc);
  }, [rpc]);

  const disabled = status === 'connecting';

  return (
    <Card className="h-full overflow-hidden border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Globe className="h-4 w-4 opacity-70" />
            RPC endpoint
          </CardTitle>
          <CardDescription>
            Target a local validator or a custom endpoint in development.
          </CardDescription>
        </div>
        <Badge className={cn('capitalize', statusTone[status])}>{statusCopy[status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-background/80 p-4">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Endpoint URL
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => onRpcChange(draft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              className="flex-1 bg-muted/40"
              placeholder="http://127.0.0.1:8899"
              disabled={disabled}
              autoComplete="off"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(rpc);
                onReset();
              }}
              disabled={disabled}
            >
              Reset
            </Button>
          </div>
        </div>
        <Separator className="bg-border/60" />
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {status === 'error' ? (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5 text-primary" />
            )}
            <span>
              {status === 'ready'
                ? `Latency ${latencyMs?.toFixed(0) ?? '—'} ms`
                : status === 'connecting'
                  ? 'Probing endpoint…'
                  : status === 'idle'
                    ? 'Waiting for activity'
                    : error?.message ?? 'Connection failed'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onRefresh}
            disabled={status === 'connecting'}
          >
            Re-run health check
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
