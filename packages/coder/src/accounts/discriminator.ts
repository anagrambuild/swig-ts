import {
  getEnumDecoder,
  getEnumEncoder,
  getU8Decoder,
  getU8Encoder,
  type Decoder,
  type Encoder,
} from '@solana/kit';

export enum SwigAccountDiscriminator {
  Swig = 1,
  // SubAccount = 2,
  // SwigWalletAddress = 3,
}

export function getSwigAccountDiscriminatorEncoder(): Encoder<SwigAccountDiscriminator> {
  return getEnumEncoder(SwigAccountDiscriminator, { size: getU8Encoder() });
}

export function getSwigAccountDiscriminatorDecoder(): Decoder<SwigAccountDiscriminator> {
  return getEnumDecoder(SwigAccountDiscriminator, { size: getU8Decoder() });
}
