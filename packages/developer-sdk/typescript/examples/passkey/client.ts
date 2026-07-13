import {
  createSecp256r1PasskeySigningFn,
  signPreparedSwigTransaction,
  signPreparedSwigTransactions,
  type PasskeySigningFn,
  type PreparedTransaction,
  type SignedPreparedTransaction,
} from '@swig-wallet/developer-sdk/client';

export interface PasskeyClientConfig {
  credentialId: BufferSource;
  userVerification?: UserVerificationRequirement;
}

export function createPasskeySigner(
  config: PasskeyClientConfig,
): PasskeySigningFn {
  return createSecp256r1PasskeySigningFn({
    allowCredentials: [
      {
        id: config.credentialId,
        type: 'public-key',
      },
    ],
    userVerification: config.userVerification ?? 'preferred',
  });
}

export async function signPasskeyPreparedTransaction(
  prepared: PreparedTransaction,
  config: PasskeyClientConfig,
): Promise<SignedPreparedTransaction> {
  return signPreparedSwigTransaction(prepared, {
    secp256r1: createPasskeySigner(config),
  });
}

export async function signPasskeyPreparedTransactions(
  preparedTransactions: PreparedTransaction[],
  config: PasskeyClientConfig,
): Promise<SignedPreparedTransaction[]> {
  return signPreparedSwigTransactions(preparedTransactions, {
    secp256r1: createPasskeySigner(config),
  });
}

export async function signPasskeyWalletCreateResult(
  created: {
    clientAuthorityTransactions: PreparedTransaction[];
  },
  config: PasskeyClientConfig,
): Promise<SignedPreparedTransaction[]> {
  return signPasskeyPreparedTransactions(
    created.clientAuthorityTransactions,
    config,
  );
}
