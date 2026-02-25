import { Clock3, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TransactionHistoryEntry } from '@/services/solana';

function formatTimeAgo(timestamp: number | null) {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp * 1000;
  if (diff < 60_000) return 'Just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shorten(signature: string) {
  return `${signature.slice(0, 8)}…${signature.slice(-6)}`;
}

function formatChange(change: bigint | null) {
  if (change === null) return '—';
  const sol = Number(change) / 1_000_000_000;
  const formatted = sol.toFixed(3);
  return sol > 0 ? `+${formatted}` : formatted;
}

type TransactionHistoryCardProps = {
  entries: TransactionHistoryEntry[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
};

export function TransactionHistoryCard({ entries, isLoading, onRefresh }: TransactionHistoryCardProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg text-foreground">Activity</CardTitle>
          <CardDescription>Recent signatures for the SWiG address.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          <Clock3 className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries && entries.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signature</TableHead>
                  <TableHead className="hidden md:table-cell">Slot</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Δ Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.signature}>
                    <TableCell className="font-mono text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        {shorten(entry.signature)}
                        <a
                          href={`https://explorer.solana.com/tx/${entry.signature}?cluster=custom`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {entry.slot}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimeAgo(entry.blockTime)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {formatChange(entry.change)}
                    </TableCell>
                    <TableCell>
                      {entry.err ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : (
                        <Badge variant="success">Success</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No transactions yet. Fund the SWiG and dispatch activity to populate history.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
