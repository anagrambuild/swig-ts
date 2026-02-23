import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Buffer } from 'buffer';
import { Fragment, useState } from 'react';
import { Actions, Role } from '@swig-wallet/classic';
import { AuthorityType } from '@swig-wallet/coder';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ACTION_PRESETS, buildActionsFromPreset, } from '@/lib/actionPresets';
import { cn } from '@/lib/utils';
function authorityTypeLabel(type) {
    switch (type) {
        case AuthorityType.Ed25519:
        case AuthorityType.Ed25519Session:
            return 'ed25519';
        case AuthorityType.Secp256k1:
        case AuthorityType.Secp256k1Session:
            return 'secp256k1';
        case AuthorityType.Secp256r1:
        case AuthorityType.Secp256r1Session:
            return 'secp256r1';
        default:
            return 'unknown';
    }
}
function describeActions(actions) {
    if (actions.isRoot()) {
        return ['Root permissions'];
    }
    const summaries = [];
    if (actions.canManageAuthority())
        summaries.push('Manage authorities');
    if (actions.hasProgramAction())
        summaries.push('Program access');
    const limit = actions.solSpendLimit();
    if (limit === null) {
        summaries.push('Unlimited SOL spend');
    }
    else if (limit > 0n) {
        summaries.push(`SOL limit ${(Number(limit) / LAMPORTS_PER_SOL).toFixed(3)}`);
    }
    return summaries.length ? summaries : ['Custom actions'];
}
function authorityAddress(role) {
    try {
        return new PublicKey(role.authority.signer).toBase58();
    }
    catch {
        return Buffer.from(role.authority.signer).toString('hex');
    }
}
function presetFromRole(role) {
    if (role.actions.isRoot())
        return 'root';
    if (role.actions.canManageAuthority())
        return 'manager';
    const limit = role.actions.solSpendLimit();
    if (limit !== null)
        return 'sol-limited';
    return 'program-all';
}
const INITIAL_FORM = {
    authority: '',
    preset: 'program-all',
};
export function PermissionsPanel({ manager }) {
    const { roles, rootRole, addEd25519Authority, removeAuthority, replaceEd25519Authority } = manager;
    const [showForm, setShowForm] = useState(false);
    const [editRole, setEditRole] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const available = Boolean(rootRole);
    const resetForm = () => {
        setShowForm(false);
        setEditRole(null);
        setForm(INITIAL_FORM);
    };
    const openCreate = () => {
        setEditRole(null);
        setForm(INITIAL_FORM);
        setShowForm(true);
    };
    const openEdit = (role) => {
        setEditRole(role);
        setForm({ authority: authorityAddress(role), preset: presetFromRole(role) });
        setShowForm(true);
    };
    const submit = () => {
        if (!rootRole) {
            toast.error('Root authority missing');
            return;
        }
        let authorityKey;
        try {
            authorityKey = new PublicKey(form.authority.trim());
        }
        catch (error) {
            toast.error('Invalid public key', {
                description: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        const actions = buildActionsFromPreset(form.preset);
        if (!actions) {
            toast.error('Unknown preset selected');
            return;
        }
        const mutation = editRole
            ? replaceEd25519Authority({
                actingRoleId: rootRole.id,
                roleId: editRole.id,
                authority: authorityKey.toBytes(),
                actions,
            })
            : addEd25519Authority({
                actingRoleId: rootRole.id,
                authority: authorityKey.toBytes(),
                actions,
            });
        mutation
            .then(() => {
            toast.success(editRole ? 'Role updated' : 'Role added');
            resetForm();
        })
            .catch((error) => toast.error('Permission update failed', {
            description: error instanceof Error ? error.message : String(error),
        }));
    };
    const remove = (role) => {
        if (!rootRole) {
            toast.error('Root authority missing');
            return;
        }
        removeAuthority({ actingRoleId: rootRole.id, roleIdToRemove: role.id })
            .then(() => toast.success('Role removed'))
            .catch((error) => toast.error('Failed to remove role', {
            description: error instanceof Error ? error.message : String(error),
        }));
    };
    const disableRemove = (role) => rootRole?.id === role.id;
    return (_jsxs(Card, { className: "border-border/60 bg-card/80", children: [_jsxs(CardHeader, { className: "flex flex-row items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { className: "text-lg text-foreground", children: "Permissions" }), _jsx(CardDescription, { children: "Manage delegated authorities for the active SWiG wallet." })] }), _jsxs(Button, { size: "sm", onClick: openCreate, disabled: !available, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), " Add role"] })] }), _jsxs(CardContent, { className: "space-y-5", children: [roles.length ? (_jsx("div", { className: "space-y-3", children: roles.map((role) => (_jsxs(Fragment, { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/70 p-4", children: [_jsxs("div", { className: "min-w-[220px] space-y-1", children: [_jsxs("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: ["Role #", role.id] }), _jsx("p", { className: "font-mono text-sm text-foreground", children: authorityAddress(role) })] }), _jsxs("div", { className: "flex flex-1 flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "outline", children: authorityTypeLabel(role.authorityType) }), describeActions(role.actions).map((name) => (_jsx(Badge, { variant: "outline", children: name }, name)))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => openEdit(role), children: [_jsx(Pencil, { className: "mr-1.5 h-3.5 w-3.5" }), " Edit"] }), _jsxs(Button, { variant: "ghost", size: "sm", disabled: disableRemove(role), onClick: () => remove(role), className: cn(!disableRemove(role) ? 'text-destructive hover:text-destructive' : ''), children: [_jsx(Trash2, { className: "mr-1.5 h-3.5 w-3.5" }), " Remove"] })] })] }), _jsx(Separator, { className: "last:hidden" })] }, role.id))) })) : (_jsx("div", { className: "rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground", children: "No delegated roles yet. Add teammates or automation keys when you are ready." })), showForm ? (_jsxs("div", { className: "space-y-4 rounded-xl border border-border/60 bg-background/80 p-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: editRole ? `Edit role #${editRole.id}` : 'Create new role' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: resetForm, children: "Cancel" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Authority public key" }), _jsx(Input, { value: form.authority, onChange: (event) => setForm((state) => ({ ...state, authority: event.target.value })), placeholder: "Enter base58 public key", autoFocus: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Permission preset" }), _jsx("div", { className: "grid gap-2", children: ACTION_PRESETS.map((preset) => (_jsxs("button", { type: "button", onClick: () => setForm((state) => ({ ...state, preset: preset.id })), className: cn('rounded-lg border px-3 py-2 text-left text-sm transition', form.preset === preset.id
                                                ? 'border-primary/60 bg-primary/10 text-foreground'
                                                : 'border-border/60 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground'), children: [_jsx("p", { className: "font-medium text-foreground", children: preset.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: preset.description })] }, preset.id))) })] }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { onClick: submit, children: editRole ? 'Save changes' : 'Add role' }) })] })) : null] })] }));
}
