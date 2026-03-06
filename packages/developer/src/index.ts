export { SwigClient } from "./client.js";

export { SwigError } from "./error.js";

export { AuthorityInfo, Policy } from "./models/index.js";
export type { PolicyConfig } from "./models/index.js";

export type {
  ActionConfig,
  AuthorityConfig,
  Network,
  RetryOptions,
  SwigConfig,
  WalletCreateArgs,
  WalletCreateResult,
  WalletCreatePaymasterResult,
  WalletCreateTransactionResult,
  WalletType,
} from "./types.js";

export { AuthorityType } from "@swig-wallet/lib";
export type {
  Actions,
  CreateAuthorityInfo,
  SolPublicKeyData,
} from "@swig-wallet/lib";
