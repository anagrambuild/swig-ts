import { createKeyPairSignerFromBytes } from '@solana/kit';
import type { Keypair } from '@solana/web3.js';
import { SWIG_PROGRAM_ADDRESS_STRING } from '@swig-wallet/lib';
import { x402Facilitator } from '@x402/core/facilitator';
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from '@x402/core/types';
import { toFacilitatorSvmSigner } from '@x402/svm';
import { ExactSvmScheme } from '@x402/svm/exact/facilitator';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';

const SECP256R1_PROGRAM_ID = 'Secp256r1SigVerify1111111111111111111111111';

export interface FacilitatorConfig {
  rpcUrl: string;
  network: Network;
  keypair: Keypair;
  port: number;
  onEvent?: (event: FacilitatorEvent) => void;
}

export type FacilitatorEvent =
  | { type: 'verified'; result: VerifyResponse }
  | { type: 'settled'; result: SettleResponse };

export async function startFacilitator(
  config: FacilitatorConfig,
): Promise<Server> {
  const account = await createKeyPairSignerFromBytes(config.keypair.secretKey);
  const signer = toFacilitatorSvmSigner(account, {
    defaultRpcUrl: config.rpcUrl,
  });
  const facilitator = new x402Facilitator().register(
    config.network,
    new ExactSvmScheme(signer, undefined, {
      enableSmartWalletVerification: true,
      smartWalletAllowedPrograms: [
        SWIG_PROGRAM_ADDRESS_STRING,
        SECP256R1_PROGRAM_ID,
      ],
      smartWalletMaxComputeUnits: 400_000,
      smartWalletMaxPriorityFeeMicroLamports: 50_000,
    }),
  );

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/supported', (_request, response) => {
    response.json(facilitator.getSupported());
  });

  app.post('/verify', async (request, response) => {
    const body = request.body as FacilitatorRequest;
    if (!body.paymentPayload || !body.paymentRequirements) {
      response.status(400).json({ error: 'Invalid facilitator request' });
      return;
    }

    try {
      const result = await facilitator.verify(
        body.paymentPayload,
        body.paymentRequirements,
      );
      config.onEvent?.({ type: 'verified', result });
      response.json(result);
    } catch {
      response.status(400).json({ error: 'Payment verification failed' });
    }
  });

  app.post('/settle', async (request, response) => {
    const body = request.body as FacilitatorRequest;
    if (!body.paymentPayload || !body.paymentRequirements) {
      response.status(400).json({ error: 'Invalid facilitator request' });
      return;
    }

    try {
      const result = await facilitator.settle(
        body.paymentPayload,
        body.paymentRequirements,
      );
      config.onEvent?.({ type: 'settled', result });
      response.json(result);
    } catch {
      response.status(500).json({ error: 'Payment settlement failed' });
    }
  });

  const server = app.listen(config.port);
  await once(server, 'listening');
  return server;
}

interface FacilitatorRequest {
  paymentPayload?: PaymentPayload;
  paymentRequirements?: PaymentRequirements;
}
