import type { PublicKey } from '@solana/web3.js';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';

const PAYMENT_MEMO = 'Swig x402 weather payment';

export interface ResourceServerConfig {
  network: Network;
  facilitatorUrl: string;
  resourceProvider: PublicKey;
  mint: PublicKey;
  paymentAmount: bigint;
  port: number;
}

export async function startResourceServer(
  config: ResourceServerConfig,
): Promise<Server> {
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
  });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.network,
    new ExactSvmScheme(),
  );

  const app = express();
  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });
  app.use(
    paymentMiddleware(
      {
        'GET /weather': {
          accepts: {
            scheme: 'exact',
            network: config.network,
            payTo: config.resourceProvider.toBase58(),
            price: {
              asset: config.mint.toBase58(),
              amount: config.paymentAmount.toString(),
            },
            maxTimeoutSeconds: 300,
            extra: { memo: PAYMENT_MEMO },
          },
          description: 'Weather data paid through a Swig wallet',
          mimeType: 'application/json',
        },
      },
      resourceServer,
    ),
  );
  app.get('/weather', (_request, response) => {
    response.json({
      city: 'Lagos',
      condition: 'sunny',
      temperatureCelsius: 29,
    });
  });

  const server = app.listen(config.port);
  await once(server, 'listening');
  return server;
}
