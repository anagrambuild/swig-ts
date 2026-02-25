'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { Toaster as SonnerToaster } from 'sonner';
export function Toaster() {
    return (_jsx(SonnerToaster, { position: "bottom-right", toastOptions: {
            className: 'border border-border/60 bg-card text-foreground shadow-lg backdrop-blur-md',
        } }));
}
