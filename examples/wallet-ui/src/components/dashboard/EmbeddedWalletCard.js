import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { CircleDollarSign, Copy, Key, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLamportBalance } from '@/hooks/useBalance';
import { useAirdrop } from '@/hooks/useAirdrop';
import { lamportsToSol } from '@/services/solana';
function truncateAddress(address) {
    if (!address)
        return '—';
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
export function EmbeddedWalletCard({ connection, keypair, publicKey, publicKeyBase58, secretBase64, onRegenerate, onResetSwig, }) {
    const [secretRevealed, setSecretRevealed] = useState(false);
    const { data: balance, refetch, isLoading } = useLamportBalance(connection, publicKey ?? null);
    const airdrop = useAirdrop(connection, publicKey ?? null);
    const balanceSol = useMemo(() => {
        if (balance === undefined)
            return '—';
        return lamportsToSol(balance).toFixed(3);
    }, [balance]);
    const handleCopy = async (value, label) => {
        if (!value)
            return;
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            toast.warning('Clipboard unavailable in this environment');
            return;
        }
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied to clipboard`);
        }
        catch (error) {
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
    return (_jsxs(Card, { className: "h-full border-border/60 bg-card/80", children: [_jsxs(CardHeader, { className: "flex flex-row items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs(CardTitle, { className: "flex items-center gap-2 text-base text-foreground", children: [_jsx(Key, { className: "h-4 w-4 opacity-70" }), "Embedded authority"] }), _jsx(CardDescription, { children: "Persistent ed25519 key stored in local storage for rapid prototyping." })] }), _jsx(Badge, { variant: "outline", children: keypair ? 'Ready' : 'Generating' })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/80 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Public key" }), _jsx("p", { className: "mt-1 font-mono text-sm text-foreground", children: truncateAddress(publicKeyBase58) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Badge, { className: "bg-emerald-500/10 text-emerald-400", children: [balanceSol, " SOL"] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => handleCopy(publicKeyBase58, 'Public key'), children: _jsx(Copy, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-background/80 p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Secret key (base64)" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setSecretRevealed((value) => !value), children: secretRevealed ? 'Hide' : 'Reveal' })] }), _jsx(Input, { value: secretRevealed ? secretBase64 ?? '' : secretBase64 ? '••••••••••••' : '', readOnly: true, className: "mt-2 font-mono text-xs" }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(secretBase64, 'Secret key'), children: "Copy secret" }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: handleRegenerate, children: [_jsx(RefreshCw, { className: "mr-2 h-3.5 w-3.5" }), " Rotate key"] })] })] })] }), _jsxs(CardFooter, { className: "flex flex-wrap items-center gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 text-xs text-muted-foreground", children: [_jsxs(Button, { size: "sm", onClick: () => airdrop
                            .mutateAsync(2)
                            .then(() => {
                            toast.success('2 SOL airdrop requested');
                            void refetch();
                        })
                            .catch((error) => toast.error('Airdrop failed', {
                            description: error instanceof Error ? error.message : String(error),
                        })), disabled: airdrop.isPending || !publicKey, children: [_jsx(CircleDollarSign, { className: "mr-2 h-4 w-4" }), " Request 2 SOL"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => void refetch(), disabled: isLoading, children: "Refresh balance" }), _jsx("span", { className: "ml-auto text-xs text-muted-foreground", children: "Stored locally \u2014 wiping browser storage clears this key." })] })] }));
}
