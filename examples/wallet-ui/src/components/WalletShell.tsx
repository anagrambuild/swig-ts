import type { PropsWithChildren } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';

export function WalletShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="absolute -left-1/3 -top-1/3 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(112,74,255,0.18)_0,_rgba(112,74,255,0)_70%)]" />
        <div className="absolute -right-1/4 top-1/4 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(72,212,255,0.18)_0,_rgba(72,212,255,0)_70%)]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-6 border-b border-border/70 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                swig
              </span>
              <Badge variant="outline">Localnet mode</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Linear-inspired wallet cockpit
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Craft, manage, and audit your SWiG wallet against a local Solana RPC. Embedded keys, airdrops, permissions, and history bundled into a single silky workflow.
              </p>
            </div>
          </div>
        </header>
        <main className="py-10">
          {children ?? (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-sm text-muted-foreground">
              Wallet experience coming together...
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
