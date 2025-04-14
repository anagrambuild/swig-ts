import { combineCodec, getEnumDecoder, getEnumEncoder } from '@solana/codecs';
import {
  // combineCodec,
  // getEnumDecoder,
  // getEnumEncoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';
export enum AuthorityType {
  Ed25519,
  Secp256k1,
}

export function getAuthorityTypeEncoder(): Encoder<AuthorityType> {
  return getEnumEncoder(AuthorityType);
}

export function getAuthorityTypeDecoder(): Decoder<AuthorityType> {
  return getEnumDecoder(AuthorityType);
}

export function getAuthorityTypeCodec(): Codec<AuthorityType, AuthorityType> {
  return combineCodec(getAuthorityTypeEncoder(), getAuthorityTypeDecoder());
}

export type AuthorityPayload =
  | { kind: 'account'; account: Address }
  | { kind: 'payload'; payload: Uint8Array };

export type AuthorityOptions = {
  // includeAuthority: boolean;
  // dataSize: number;
  payloadSize: number;
};
