'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  signature: string;
}

export default function TransactionLink({ signature }: Props) {
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;

  return (
    <Button
      variant="link"
      size="sm"
      asChild
      className="gap-1 text-slate-600 hover:text-slate-900"
    >
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        View on Explorer
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}
