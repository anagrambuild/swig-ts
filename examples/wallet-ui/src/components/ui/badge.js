import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', {
    variants: {
        variant: {
            default: 'border-transparent bg-primary/10 text-primary',
            outline: 'border-border/60 text-foreground',
            success: 'border-transparent bg-emerald-500/10 text-emerald-400',
            warning: 'border-transparent bg-amber-500/10 text-amber-400',
            destructive: 'border-transparent bg-destructive/10 text-destructive',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});
export function Badge({ className, variant, ...props }) {
    return (_jsx("span", { className: cn(badgeVariants({ variant }), className), ...props }));
}
