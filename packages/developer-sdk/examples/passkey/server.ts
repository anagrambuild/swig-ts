import type {
  Amount,
  CreateWalletResult,
  Network,
  PreparedTransaction,
  PreparedTransactionsResult,
  SubmittedTransaction,
  WalletAddressInfo,
} from '@swig-wallet/developer-sdk';
import type { SignedPreparedTransaction } from '@swig-wallet/developer-sdk/client';
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';

export interface PasskeyServerConfig {
  apiKey: string;
  feePayer: string;
  baseUrl?: string;
  network?: Network;
  fetch?: typeof fetch;
}

export async function preparePasskeyWalletCreate(
  config: PasskeyServerConfig,
  passkeyPublicKey: string,
): Promise<CreateWalletResult> {
  const swig = createServerSwigClient(config);

  return swig.wallets.create({
    feePayer: config.feePayer,
    initialUser: {
      secp256r1: {
        publicKey: passkeyPublicKey,
      },
    },
    ...(config.network ? { network: config.network } : {}),
  });
}

export async function preparePasskeySolTransfer(
  config: PasskeyServerConfig,
  args: {
    wallet: WalletAddressInfo;
    passkeyPublicKey: string;
    destination: string;
    amount: Amount;
  },
): Promise<PreparedTransaction> {
  const swig = createServerSwigClient(config);
  const wallet = swig.wallets.use(
    {
      ...args.wallet,
      requesterAuthority: {
        secp256r1: {
          publicKey: args.passkeyPublicKey,
        },
      },
    },
    { network: config.network },
  );

  return wallet.transfer.sol({
    feePayer: config.feePayer,
    destination: args.destination,
    amount: args.amount,
    ...(config.network ? { network: config.network } : {}),
  });
}

export async function preparePasskeyGroupedTransfers(
  config: PasskeyServerConfig,
  args: {
    wallet: WalletAddressInfo;
    passkeyPublicKey: string;
    transfers: Array<{
      destination: string;
      amount: Amount;
    }>;
  },
): Promise<PreparedTransactionsResult> {
  const swig = createServerSwigClient(config);
  const wallet = swig.wallets.use(
    {
      ...args.wallet,
      requesterAuthority: {
        secp256r1: {
          publicKey: args.passkeyPublicKey,
        },
      },
    },
    { network: config.network },
  );

  return wallet.prepare({
    feePayer: config.feePayer,
    operations: args.transfers.map((transfer) => ({
      type: 'transferSol',
      destination: transfer.destination,
      amount: transfer.amount,
    })),
    ...(config.network ? { network: config.network } : {}),
  });
}

export async function sponsorSignedTransaction(
  config: PasskeyServerConfig,
  transaction: SignedPreparedTransaction,
): Promise<SubmittedTransaction> {
  const swig = createServerSwigClient(config);
  return swig.transactions.sponsor(transaction);
}

export async function sponsorSignedTransactionsSequentially(
  config: PasskeyServerConfig,
  transactions: SignedPreparedTransaction[],
): Promise<SubmittedTransaction[]> {
  const submitted: SubmittedTransaction[] = [];

  for (const transaction of transactions) {
    submitted.push(await sponsorSignedTransaction(config, transaction));
  }

  return submitted;
}

function createServerSwigClient(config: PasskeyServerConfig): SwigClient {
  return new SwigClient({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ...(config.network ? { network: config.network } : {}),
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });
}
