export interface PasskeySigningResult {
  signature: Uint8Array;
  prefix?: Uint8Array;
  message?: Uint8Array;
}

export type PasskeySigningFn = (
  message: Uint8Array,
) => Promise<PasskeySigningResult>;
