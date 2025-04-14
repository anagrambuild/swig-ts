import { containsBytes, getU8Encoder } from '@solana/codecs';
import {
  // containsBytes,
  // getU8Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';

export enum SwigInstructionDiscriminator {
  CreateV1,
  AddAuthorityV1,
  RemoveAuthorityV1,
  ReplaceAuthorityV1,
  SignV1,
}

export function identifySwigInstruction(
  instruction: { data: ReadonlyUint8Array } | ReadonlyUint8Array,
): SwigInstructionDiscriminator {
  const data = 'data' in instruction ? instruction.data : instruction;
  if (containsBytes(data, getU8Encoder().encode(0), 0)) {
    return SwigInstructionDiscriminator.CreateV1;
  }
  if (containsBytes(data, getU8Encoder().encode(1), 0)) {
    return SwigInstructionDiscriminator.AddAuthorityV1;
  }
  if (containsBytes(data, getU8Encoder().encode(2), 0)) {
    return SwigInstructionDiscriminator.RemoveAuthorityV1;
  }
  if (containsBytes(data, getU8Encoder().encode(3), 0)) {
    return SwigInstructionDiscriminator.ReplaceAuthorityV1;
  }
  if (containsBytes(data, getU8Encoder().encode(4), 0)) {
    return SwigInstructionDiscriminator.SignV1;
  }
  throw new Error(
    'The provided instruction could not be identified as a swig instruction.',
  );
}
