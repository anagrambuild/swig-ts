import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Actions } from '@swig-wallet/classic';

export type ActionPresetId = 'root' | 'manager' | 'program-all' | 'sol-limited';

export type ActionPreset = {
  id: ActionPresetId;
  name: string;
  description: string;
  build: () => Actions;
};

const SOL_LIMIT = BigInt(0.5 * LAMPORTS_PER_SOL);

export const ACTION_PRESETS: ActionPreset[] = [
  {
    id: 'root',
    name: 'Root (all permissions)',
    description:
      'Unlimited access across programs, fund movements, and authority management.',
    build: () => Actions.set().all().get(),
  },
  {
    id: 'manager',
    name: 'Authority manager',
    description:
      'Can create and revoke roles. Program-all access is auto-added to satisfy instruction guards.',
    build: () => Actions.set().manageAuthority().programAll().get(),
  },
  {
    id: 'program-all',
    name: 'Program access',
    description:
      'Grants signing across any program without authority admin rights.',
    build: () => Actions.set().programAll().get(),
  },
  {
    id: 'sol-limited',
    name: 'Treasury limited (0.5 SOL)',
    description:
      'May spend up to 0.5 SOL and interact with any program. Ideal for routine automation.',
    build: () => Actions.set().programAll().solLimit({ amount: SOL_LIMIT }).get(),
  },
];

export function buildActionsFromPreset(id: ActionPresetId) {
  return ACTION_PRESETS.find((preset) => preset.id === id)?.build();
}
