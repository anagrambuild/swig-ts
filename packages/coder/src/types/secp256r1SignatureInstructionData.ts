import {
  fixEncoderSize,
  getBytesEncoder,
  getStructEncoder,
  getU16Encoder,
  getU8Encoder,
  transformEncoder,
  type Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export type Secp256r1SignatureInstructionData = {
  publicKey: ReadonlyUint8Array;
  message: ReadonlyUint8Array;
  signature: ReadonlyUint8Array;
};

export function getSecp256r1SignatureInstructionDataEncoder(): Encoder<Secp256r1SignatureInstructionData> {
  return transformEncoder(
    getStructEncoder([
      ['noOfSignatures', getU8Encoder()],
      ['_padding', fixEncoderSize(getBytesEncoder(), 1)],
      ['signatureOffset', getU16Encoder()],
      ['signatureInstructionIndex', getU16Encoder()],
      ['publicKeyOffset', getU16Encoder()],
      ['publicKeyInstructionIndex', getU16Encoder()],
      ['messageDataOffset', getU16Encoder()],
      ['messageDataSize', getU16Encoder()],
      ['messageInstructionIndex', getU16Encoder()],
      ['publicKey', fixEncoderSize(getBytesEncoder(), 33)],
      ['signature', fixEncoderSize(getBytesEncoder(), 64)],
      ['message', getBytesEncoder()],
    ]),
    (value) => {
      return {
        ...value,
        noOfSignatures: 1,
        publicKeyOffset: 16,
        publicKeyInstructionIndex: 65535, //u16 max
        signatureOffset: 16 + 33,
        signatureInstructionIndex: 65535, //u16 max
        messageDataSize: value.message.length,
        messageDataOffset: 16 + 33 + 64,
        messageInstructionIndex: 65535, //u16 max
        _padding: Uint8Array.from(Array(1)),
      };
    },
  );
}

export enum WebAuthnField {
  None,
  Type,
  Challenge,
  Origin,
  CrossOrigin,
}

export enum R1AuthenticationType {
  WebAuthn = 1,
}
