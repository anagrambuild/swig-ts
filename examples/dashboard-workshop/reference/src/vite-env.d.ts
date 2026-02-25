/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL: string;
  readonly VITE_SWIG_PORTAL_URL: string;
  readonly VITE_SWIG_API_KEY: string;
  readonly VITE_SWIG_POLICY_ID: string;
  readonly VITE_SWIG_PAYMASTER_PUBKEY: string;
  readonly VITE_SWIG_PAYMASTER_URL: string;
  readonly VITE_SWIG_PAYMASTER_NETWORK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
