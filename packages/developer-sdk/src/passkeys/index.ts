import type { PasskeySigningFn } from '../types/index.js';

interface SwigWalletLib {
  getSecp256r1WebAuthnSigningFn: (
    options: Omit<PublicKeyCredentialRequestOptions, 'challenge'>,
  ) => PasskeySigningFn;
}

export function createSecp256r1PasskeySigningFn(
  options: Omit<PublicKeyCredentialRequestOptions, 'challenge'>,
): PasskeySigningFn {
  return async (message) => {
    const { getSecp256r1WebAuthnSigningFn } = await loadSwigWalletLib();
    return getSecp256r1WebAuthnSigningFn(options)(message);
  };
}

async function loadSwigWalletLib(): Promise<SwigWalletLib> {
  return import('@swig-wallet/lib') as Promise<SwigWalletLib>;
}
