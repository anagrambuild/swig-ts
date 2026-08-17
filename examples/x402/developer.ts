import { VersionedTransaction, type Keypair } from '@solana/web3.js';
import {
  createX402Payment,
  signPreparedTransaction,
} from '@swig-wallet/developer-sdk/client';
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';

export interface DeveloperConfig {
  apiKey: string;
  backendUrl: string;
  network: 'devnet';
  swigConfigAddress: string;
  swigWalletAddress: string;
  developer: Keypair;
  resourceUrl: string;
}

export async function runDeveloper(config: DeveloperConfig): Promise<void> {
  const swig = new SwigClient({
    apiKey: config.apiKey,
    baseUrl: config.backendUrl,
    network: config.network,
  });
  const wallet = swig.wallets.use(
    {
      swigConfigAddress: config.swigConfigAddress,
      walletAddress: config.swigWalletAddress,
      network: config.network,
    },
    {
      requesterAuthority: {
        ed25519: { publicKey: config.developer.publicKey.toBase58() },
      },
    },
  );

  const challenge = await fetch(config.resourceUrl);
  const prepared = await wallet.x402.prepareFromResponse(challenge);
  const signed = await signPreparedTransaction(prepared.preparedTransaction, {
    signTransaction: async (transaction) => {
      const versioned = VersionedTransaction.deserialize(
        Buffer.from(transaction, 'base64'),
      );
      versioned.sign([config.developer]);
      return Buffer.from(versioned.serialize()).toString('base64');
    },
  });
  const payment = createX402Payment(prepared, signed);
  const response = await fetch(config.resourceUrl, {
    headers: payment.paymentSignatureHeaders,
  });

  if (!response.ok) {
    throw new Error(
      `Paid request failed (${response.status}): ${await response.text()}`,
    );
  }

  console.log('Resource:', await response.json());
  console.log('PAYMENT-RESPONSE:', response.headers.get('PAYMENT-RESPONSE'));
}
