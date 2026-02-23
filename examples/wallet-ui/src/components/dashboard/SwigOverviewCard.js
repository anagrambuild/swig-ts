import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import QRCode from 'react-qr-code';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { lamportsToSol } from '@/services/solana';
import { useLamportBalance } from '@/hooks/useBalance';
import { useAirdrop } from '@/hooks/useAirdrop';
import { bytesToBase64 } from '@/lib/bytes';
import { toast } from 'sonner';
function formatLamports(lamports) {
    if (lamports === undefined)
        return '—';
    return `${lamportsToSol(lamports).toFixed(3)} SOL`;
}
export function SwigOverviewCard({ connection, manager, onRefresh }) {
    const { swig, reference, mutationState, create, status, error, roles } = manager;
    const swigAddress = reference?.address ?? null;
    const swigId = reference?.id ?? null;
    const swigBalance = useLamportBalance(connection, swigAddress);
    const swigAirdrop = useAirdrop(connection, swigAddress);
    const displayStatus = useMemo(() => {
        if (mutationState === 'pending')
            return 'Working…';
        if (status === 'error' && error)
            return error.message;
        if (!swig)
            return 'No SWiG wallet yet';
        return 'Ready';
    }, [mutationState, status, error, swig]);
    const primaryAction = () => {
        create()
            .then(() => {
            toast.success('SWiG wallet created');
            void swigBalance.refetch();
            onRefresh();
        })
            .catch((err) => toast.error('Failed to create SWiG', {
            description: err instanceof Error ? err.message : String(err),
        }));
    };
    const handleFund = () => {
        swigAirdrop
            .mutateAsync(1)
            .then(() => {
            toast.success('Requested 1 SOL airdrop for SWiG');
            void swigBalance.refetch();
            onRefresh();
        })
            .catch((err) => toast.error('Airdrop failed', {
            description: err instanceof Error ? err.message : String(err),
        }));
    };
    return (_jsxs(Card, { className: "border-border/60 bg-card/80", children: [_jsxs(CardHeader, { className: "flex flex-row items-start justify-between gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(CardTitle, { className: "text-lg text-foreground", children: "SWiG wallet" }), _jsx(CardDescription, { children: "Program-derived account with SWiG capabilities managed by your embedded key." })] }), _jsx(Badge, { variant: swig ? 'success' : 'outline', children: displayStatus })] }), _jsx(CardContent, { children: swig ? (_jsxs("div", { className: "grid gap-6 md:grid-cols-[1.6fr_1fr]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl border border-border/60 bg-background/80 p-4", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Address" }), _jsxs("div", { className: "mt-1 flex items-center justify-between gap-4", children: [_jsx("p", { className: "font-mono text-sm text-foreground", children: swigAddress?.toBase58() }), _jsx(Badge, { variant: "outline", children: formatLamports(swigBalance.data) })] })] }), _jsxs("div", { className: "rounded-xl border border-border/60 bg-background/80 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Wallet ID (base64)" }), _jsxs(Badge, { variant: "outline", children: ["Roles ", roles.length] })] }), _jsx("p", { className: "mt-1 font-mono text-xs text-muted-foreground", children: swigId ? bytesToBase64(swigId) : '—' })] }), _jsx(Separator, { className: "bg-border/60" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsx(Button, { size: "sm", onClick: handleFund, disabled: swigAirdrop.isPending, children: "Fund 1 SOL" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                void swigBalance.refetch();
                                                onRefresh();
                                            }, children: "Refresh state" })] })] }), _jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-background/60 p-6 text-center", children: [swigAddress ? (_jsx("div", { className: "rounded-2xl border border-border/40 bg-card/70 p-4 shadow-inner", children: _jsx(QRCode, { value: swigAddress.toBase58(), size: 160, style: { height: 'auto', maxWidth: '100%', width: '100%' }, bgColor: "transparent", fgColor: "rgba(255,255,255,0.9)" }) })) : null, _jsx("p", { className: "text-sm font-medium text-foreground", children: "Shareable QR" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Scan on another device to import the SWiG PDA address." })] })] })) : (_jsxs("div", { className: "flex flex-col items-start gap-6 rounded-xl border border-dashed border-border/60 bg-background/50 p-8 text-sm text-muted-foreground", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-medium text-foreground", children: "No SWiG yet \u2014 spin one up" }), _jsx("p", { className: "max-w-xl text-sm text-muted-foreground", children: "We\u2019ll derive a PDA, seed it with your embedded key as the root authority, and be ready to manage permissions instantly." })] }), _jsx(Button, { size: "lg", onClick: primaryAction, disabled: mutationState === 'pending', children: "Create SWiG wallet" })] })) }), swig ? (_jsxs(CardFooter, { className: "border-t border-border/60 bg-muted/10 px-6 py-4 text-xs text-muted-foreground", children: ["QR encodes ", swigAddress?.toBase58(), " \u2014 perfect for mobile cross-device flows."] })) : null] }));
}
