import {
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/kit';

/** Byte length of the `ManageAuthorizationLocks` action data. */
export const MANAGE_AUTHORIZATION_LOCKS_LENGTH = 8;

/**
 * Data of the `ManageAuthorizationLocks` permission.
 *
 * `maxDurationSlots` bounds `expirySlot - currentSlot` for every lock the
 * role creates. It must be non-zero.
 */
export type ManageAuthorizationLocks = {
  maxDurationSlots: bigint;
};

export function getManageAuthorizationLocksEncoder(): Encoder<ManageAuthorizationLocks> {
  return getStructEncoder([['maxDurationSlots', getU64Encoder()]]);
}

export function getManageAuthorizationLocksDecoder(): Decoder<ManageAuthorizationLocks> {
  return getStructDecoder([['maxDurationSlots', getU64Decoder()]]);
}

export function getManageAuthorizationLocksCodec(): Codec<
  ManageAuthorizationLocks,
  ManageAuthorizationLocks
> {
  return combineCodec(
    getManageAuthorizationLocksEncoder(),
    getManageAuthorizationLocksDecoder(),
  );
}
