import {
  getEnumDecoder,
  getEnumEncoder,
  getU8Decoder,
  getU8Encoder,
  type Decoder,
  type Encoder,
} from '@solana/kit';

export enum SwigAccountDiscriminator {
  Swig,
  SubAccount,
}

export function getSwigAccountDiscriminatorEncoder(): Encoder<SwigAccountDiscriminator> {
  return getEnumEncoder(SwigAccountDiscriminator, { size: getU8Encoder() });
}

export function getSwigAccountDiscriminatorDecoder(): Decoder<SwigAccountDiscriminator> {
  return getEnumDecoder(SwigAccountDiscriminator, { size: getU8Decoder() });
}
