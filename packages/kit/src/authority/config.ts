import { AuthorityType } from '@swig/coder';
import { Ed25519Instruction, Secp256k1Instruction } from './instructions';
import type { AuthorityInstruction } from './interface';

export type AuthorityConfig = {
  type: AuthorityType;
  payloadSize: number;
  dataSize: number;
  instructions: AuthorityInstruction;
};

const Ed25519Config: AuthorityConfig = {
  type: AuthorityType.Ed25519,
  dataSize: 32,
  payloadSize: 1,
  instructions: Ed25519Instruction,
};

const Secp256k1Config: AuthorityConfig = {
  type: AuthorityType.Secp256k1,
  dataSize: 32,
  payloadSize: 1,
  instructions: Secp256k1Instruction,
};

const authorityConfig: Record<AuthorityType, AuthorityConfig> = {
  [AuthorityType.Ed25519]: Ed25519Config,
  [AuthorityType.Secp256k1]: Secp256k1Config,
};

export function getAuthorityConfig(type: AuthorityType): AuthorityConfig {
  return authorityConfig[type];
}
