import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Clock3, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
function formatTimeAgo(timestamp) {
    if (!timestamp)
        return '—';
    const diff = Date.now() - timestamp * 1000;
    if (diff < 60_000)
        return 'Just now';
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
function shorten(signature) {
    return `${signature.slice(0, 8)}…${signature.slice(-6)}`;
}
function formatChange(change) {
    if (change === null)
        return '—';
    const sol = Number(change) / 1_000_000_000;
    const formatted = sol.toFixed(3);
    return sol > 0 ? `+${formatted}` : formatted;
}
export function TransactionHistoryCard({ entries, isLoading, onRefresh }) {
    return (_jsxs(Card, { className: "border-border/60 bg-card/80", children: [_jsxs(CardHeader, { className: "flex flex-row items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { className: "text-lg text-foreground", children: "Activity" }), _jsx(CardDescription, { children: "Recent signatures for the SWiG address." })] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: onRefresh, disabled: isLoading, children: [_jsx(Clock3, { className: "mr-2 h-3.5 w-3.5" }), "Refresh"] })] }), _jsx(CardContent, { className: "space-y-4", children: entries && entries.length > 0 ? (_jsx("div", { className: "overflow-hidden rounded-xl border border-border/60", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Signature" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "Slot" }), _jsx(TableHead, { children: "When" }), _jsx(TableHead, { children: "\u0394 Balance" }), _jsx(TableHead, { children: "Status" })] }) }), _jsx(TableBody, { children: entries.map((entry) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-mono text-xs text-foreground", children: _jsxs("div", { className: "flex items-center gap-2", children: [shorten(entry.signature), _jsx("a", { href: `https://explorer.solana.com/tx/${entry.signature}?cluster=custom`, target: "_blank", rel: "noreferrer", className: "text-muted-foreground hover:text-primary", children: _jsx(ExternalLink, { className: "h-3.5 w-3.5" }) })] }) }), _jsx(TableCell, { className: "hidden text-xs text-muted-foreground md:table-cell", children: entry.slot }), _jsx(TableCell, { className: "text-xs text-muted-foreground", children: formatTimeAgo(entry.blockTime) }), _jsx(TableCell, { className: "font-mono text-xs text-foreground", children: formatChange(entry.change) }), _jsx(TableCell, { children: entry.err ? (_jsx(Badge, { variant: "destructive", children: "Failed" })) : (_jsx(Badge, { variant: "success", children: "Success" })) })] }, entry.signature))) })] }) })) : (_jsx("div", { className: "rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground", children: "No transactions yet. Fund the SWiG and dispatch activity to populate history." })) })] }));
}
