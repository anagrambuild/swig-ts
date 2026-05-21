import type { WalletAuthority } from './wallet-actions.js';

export type PolicyAuthority =
  | { type: 'Ed25519'; publicKey: string }
  | { type: 'Secp256k1'; publicKey: string }
  | { type: 'Secp256r1'; publicKey: string }
  | { type: 'Ed25519Session'; publicKey: string; maxDurationSlots: string }
  | { type: 'Secp256k1Session'; publicKey: string; maxDurationSlots: string }
  | { type: 'Secp256r1Session'; publicKey: string; maxDurationSlots: string };

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  authority?: PolicyAuthority | WalletAuthority | null;
  actions?: unknown[];
  guardianEnabled?: boolean;
  initialKeySource?: string;
  guardianAuthority?: PolicyAuthority | WalletAuthority | null;
  guardianKeySource?: string;
  guardianDelaySeconds?: number | string;
}
