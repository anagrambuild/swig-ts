import type { HttpClient } from '../core/index.js';
import type {
  AddRecoveryAuthorityArgs,
  CancelRecoveryArgs,
  ConfigureRecoveryArgs,
  CreateWalletArgs,
  CreateWalletResponseWire,
  CreateWalletResult,
  ExecuteArgs,
  ExecuteRecoveryArgs,
  IdpWalletSession,
  Network,
  Policy,
  PrepareArgs,
  PreparedRecoverySetupResult,
  PreparedTransaction,
  PreparedTransactionsResult,
  PreparedTransactionWire,
  PrepareRecoverySetupArgs,
  PrepareTransactionsResponseWire,
  RecoverySetupPlan,
  StartRecoveryArgs,
  SwapArgs,
  TransferArgs,
  WalletAuthority,
  WalletHandleOptions,
  WalletReference,
} from '../types/index.js';
import { WalletHandle } from './handle.js';
import {
  normalizeCreateWalletResponse,
  normalizePreparedTransaction,
  normalizePrepareTransactionsResponse,
} from './normalizers.js';
import {
  addRecoveryAuthorityRequest,
  cancelRecoveryRequest,
  configureRecoveryRequest,
  createWalletRequest,
  executeRecoveryRequest,
  executeRequest,
  isTokenTransfer,
  prepareRequest,
  startRecoveryRequest,
  swapRequest,
  transferSolRequest,
  transferTokenRequest,
} from './requests.js';

export class WalletsClient {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultNetwork?: Network,
  ) {}

  create = async (args: CreateWalletArgs): Promise<CreateWalletResult> => {
    const policy = args.policyId
      ? await this.getPolicy(args.policyId)
      : undefined;
    const response = await this.http.post<CreateWalletResponseWire>(
      '/transaction/wallet/create',
      createWalletRequest(args, this.defaultNetwork),
    );
    const created = normalizeCreateWalletResponse(response);
    const network = created.network ?? args.network ?? this.defaultNetwork;

    return {
      ...created,
      wallet: {
        ...created.wallet,
        network,
      },
      ...(policy
        ? {
            recoverySetup: recoverySetupPlanFromPolicy(policy, args),
          }
        : {}),
      network,
    };
  };

  getPolicy = async (policyId: string): Promise<Policy> => {
    return this.http.get<Policy>(
      `/wallet/policies/${encodeURIComponent(policyId)}`,
    );
  };

  use = (
    wallet: string | WalletReference,
    options: WalletHandleOptions = {},
  ): WalletHandle => {
    if (typeof wallet === 'string') {
      return new WalletHandle(this, {
        swigConfigAddress: wallet,
        network: options.network ?? this.defaultNetwork,
        requesterAuthority: options.requesterAuthority,
      });
    }

    return new WalletHandle(this, {
      swigConfigAddress: wallet.swigConfigAddress,
      walletAddress: wallet.walletAddress,
      network: options.network ?? wallet.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? wallet.requesterAuthority,
    });
  };

  fromIdpSession = (
    session: IdpWalletSession,
    options: WalletHandleOptions = {},
  ): WalletHandle => {
    return new WalletHandle(this, {
      swigConfigAddress: session.configAddress,
      walletAddress: session.walletAddress,
      network: options.network ?? this.defaultNetwork,
      requesterAuthority:
        options.requesterAuthority ?? session.requesterAuthority,
    });
  };

  transfer = async (
    wallet: WalletHandle,
    args: TransferArgs,
  ): Promise<PreparedTransaction> => {
    return isTokenTransfer(args)
      ? this.transferToken(wallet, args)
      : this.transferSol(wallet, args);
  };

  prepare = async (
    wallet: WalletHandle,
    args: PrepareArgs,
  ): Promise<PreparedTransactionsResult> => {
    const response = await this.http.post<PrepareTransactionsResponseWire>(
      '/transaction/prepare',
      prepareRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePrepareTransactionsResponse(response);
  };

  transferSol = async (
    wallet: WalletHandle,
    args: Extract<TransferArgs, { destination: string }>,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/transfer/sol',
      transferSolRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  transferToken = async (
    wallet: WalletHandle,
    args: Extract<TransferArgs, { mint: string }>,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/transfer/spl-token',
      transferTokenRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  swap = async (
    wallet: WalletHandle,
    args: SwapArgs,
  ): Promise<PreparedTransaction> => {
    return this.jupiterSwap(wallet, args);
  };

  jupiterSwap = async (
    wallet: WalletHandle,
    args: SwapArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/swap/jupiter',
      swapRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  startRecovery = async (
    wallet: WalletHandle,
    args: StartRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/start',
      startRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  addRecoveryAuthority = async (
    wallet: WalletHandle,
    args: AddRecoveryAuthorityArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/wallet/recovery-authority/add',
      addRecoveryAuthorityRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  configureRecovery = async (
    wallet: WalletHandle,
    args: ConfigureRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/configure',
      configureRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  prepareRecoverySetup = async (
    wallet: WalletHandle,
    args: PrepareRecoverySetupArgs,
  ): Promise<PreparedRecoverySetupResult> => {
    const addAuthorityTransaction = await this.addRecoveryAuthority(
      wallet,
      args,
    );
    const configureRecoveryTransaction = await this.configureRecovery(
      wallet,
      args,
    );
    return recoverySetupResult(
      [addAuthorityTransaction, configureRecoveryTransaction],
      wallet,
      args.network ?? wallet.network ?? this.defaultNetwork,
    );
  };

  cancelRecovery = async (
    wallet: WalletHandle,
    args: CancelRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/cancel',
      cancelRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  executeRecovery = async (
    wallet: WalletHandle,
    args: ExecuteRecoveryArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      '/transaction/recovery/execute',
      executeRecoveryRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };

  execute = async (
    wallet: WalletHandle,
    args: ExecuteArgs,
  ): Promise<PreparedTransaction> => {
    const response = await this.http.post<PreparedTransactionWire>(
      `/v1/wallets/${encodeURIComponent(wallet.swigConfigAddress)}/execute`,
      executeRequest(wallet, args, this.defaultNetwork),
    );
    return normalizePreparedTransaction(response);
  };
}

function recoverySetupPlanFromPolicy(
  policy: Policy,
  args: CreateWalletArgs,
): RecoverySetupPlan | undefined {
  const requesterAuthority =
    args.initialUser ?? walletAuthorityFromPolicy(policy.authority);
  const guardianPubkey =
    args.recovery?.guardianPubkey ??
    publicKeyFromPolicyAuthority(policy.guardianAuthority);

  if (!policy.guardianEnabled || !requesterAuthority || !guardianPubkey) {
    return undefined;
  }

  return {
    requesterAuthority,
    guardianPubkey,
    delaySeconds:
      args.recovery?.delaySeconds ??
      normalizePolicyDelaySeconds(policy.guardianDelaySeconds),
    targetRoleId: args.recovery?.targetRoleId ?? 0,
  };
}

function normalizePolicyDelaySeconds(delaySeconds: unknown): number {
  if (typeof delaySeconds === 'number' && Number.isFinite(delaySeconds)) {
    return delaySeconds;
  }
  if (typeof delaySeconds === 'string' && /^[0-9]+$/.test(delaySeconds)) {
    const parsed = Number(delaySeconds);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return 86_400;
}

function walletAuthorityFromPolicy(
  authority: Policy['authority'],
): WalletAuthority | undefined {
  if (!authority) {
    return undefined;
  }

  if (
    'ed25519' in authority ||
    'secp256k1' in authority ||
    'secp256r1' in authority
  ) {
    return authority;
  }

  switch (authority.type) {
    case 'Ed25519':
      return { ed25519: { publicKey: authority.publicKey } };
    case 'Secp256k1':
      return { secp256k1: { publicKey: authority.publicKey } };
    case 'Secp256r1':
      return { secp256r1: { publicKey: authority.publicKey } };
  }
}

function publicKeyFromPolicyAuthority(
  authority: Policy['guardianAuthority'],
): string | undefined {
  if (!authority) {
    return undefined;
  }
  if ('publicKey' in authority) {
    return authority.publicKey;
  }
  if ('ed25519' in authority) {
    return authority.ed25519.publicKey;
  }
  if ('secp256k1' in authority) {
    return authority.secp256k1.publicKey;
  }
  return authority.secp256r1.publicKey;
}

function recoverySetupResult(
  transactions: PreparedTransaction[],
  wallet: WalletHandle,
  network?: Network,
): PreparedRecoverySetupResult {
  const addAuthorityTransaction = transactions.find(
    (transaction) => transaction.kind === 'add-authority',
  );
  const configureRecoveryTransaction = transactions.find(
    (transaction) => transaction.kind === 'configure-recovery',
  );
  const walletInfo =
    addAuthorityTransaction?.wallet ?? configureRecoveryTransaction?.wallet;

  return {
    ...(walletInfo ? { wallet: { ...walletInfo, network } } : {}),
    transactions,
    clientAuthorityTransactions: transactions.filter(
      (transaction) => transaction.signatureRequests.length > 0,
    ),
    operatorSignedTransactions: transactions.filter(
      (transaction) => transaction.kind === 'configure-recovery',
    ),
    feePayerOnlyTransactions: transactions.filter(
      (transaction) =>
        transaction.signatureRequests.length === 0 &&
        transaction.kind !== 'configure-recovery',
    ),
    ...(addAuthorityTransaction ? { addAuthorityTransaction } : {}),
    ...(configureRecoveryTransaction ? { configureRecoveryTransaction } : {}),
    network: network ?? wallet.network,
  };
}
