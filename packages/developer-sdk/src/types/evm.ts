export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface Secp256k1SigningResult {
  signature: Uint8Array;
  prefix?: Uint8Array;
  message?: Uint8Array;
}

export type Secp256k1SigningFn = (
  message: Uint8Array,
) => Promise<Secp256k1SigningResult>;

export interface CreateSecp256k1EvmSigningFnOptions {
  provider: Eip1193Provider;
  address: string;
}
