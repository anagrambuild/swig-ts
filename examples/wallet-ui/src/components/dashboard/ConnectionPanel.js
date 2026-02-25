import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Globe, RefreshCcw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
const statusCopy = {
    idle: 'Idle',
    connecting: 'Connecting…',
    ready: 'Healthy',
    error: 'Unreachable',
};
const statusTone = {
    idle: 'bg-muted text-muted-foreground',
    connecting: 'bg-amber-500/10 text-amber-400',
    ready: 'bg-emerald-500/10 text-emerald-400',
    error: 'bg-destructive/10 text-destructive',
};
export function ConnectionPanel(props) {
    const { rpc, status, latencyMs, error, onRpcChange, onReset, onRefresh } = props;
    const [draft, setDraft] = useState(rpc);
    useEffect(() => {
        setDraft(rpc);
    }, [rpc]);
    const disabled = status === 'connecting';
    return (_jsxs(Card, { className: "h-full overflow-hidden border-border/60 bg-card/80", children: [_jsxs(CardHeader, { className: "flex flex-row items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs(CardTitle, { className: "flex items-center gap-2 text-base text-foreground", children: [_jsx(Globe, { className: "h-4 w-4 opacity-70" }), "RPC endpoint"] }), _jsx(CardDescription, { children: "Target a local validator or a custom endpoint in development." })] }), _jsx(Badge, { className: cn('capitalize', statusTone[status]), children: statusCopy[status] })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "rounded-lg border border-border/60 bg-background/80 p-4", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Endpoint URL" }), _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsx(Input, { value: draft, onChange: (event) => setDraft(event.target.value), onBlur: () => onRpcChange(draft), onKeyDown: (event) => {
                                            if (event.key === 'Enter') {
                                                event.currentTarget.blur();
                                            }
                                        }, className: "flex-1 bg-muted/40", placeholder: "http://127.0.0.1:8899", disabled: disabled, autoComplete: "off" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                            setDraft(rpc);
                                            onReset();
                                        }, disabled: disabled, children: "Reset" })] })] }), _jsx(Separator, { className: "bg-border/60" }), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-2", children: [status === 'error' ? (_jsx(WifiOff, { className: "h-3.5 w-3.5 text-destructive" })) : (_jsx(RefreshCcw, { className: "h-3.5 w-3.5 text-primary" })), _jsx("span", { children: status === 'ready'
                                            ? `Latency ${latencyMs?.toFixed(0) ?? '—'} ms`
                                            : status === 'connecting'
                                                ? 'Probing endpoint…'
                                                : status === 'idle'
                                                    ? 'Waiting for activity'
                                                    : error?.message ?? 'Connection failed' })] }), _jsx(Button, { variant: "ghost", size: "sm", className: "ml-auto", onClick: onRefresh, disabled: status === 'connecting', children: "Re-run health check" })] })] })] }));
}
