import type { Server } from 'node:http';

import { runDeveloper } from './developer.js';
import { startFacilitator } from './facilitator.js';
import { startResourceServer } from './resource-server.js';
import { ensureX402Fixture } from './setup.js';

const fixture = await ensureX402Fixture();
const facilitatorUrl = `http://localhost:${fixture.facilitatorPort}`;
const resourceServerUrl = `http://localhost:${fixture.resourceServerPort}`;
const facilitator = await startFacilitator({
  rpcUrl: fixture.rpcUrl,
  network: fixture.x402Network,
  keypair: fixture.facilitator,
  port: fixture.facilitatorPort,
});

let resourceServer: Server | undefined;

try {
  resourceServer = await startResourceServer({
    network: fixture.x402Network,
    facilitatorUrl,
    resourceProvider: fixture.resourceProvider.publicKey,
    mint: fixture.mint,
    paymentAmount: fixture.paymentAmount,
    port: fixture.resourceServerPort,
  });

  await runDeveloper({
    apiKey: fixture.apiKey,
    backendUrl: fixture.backendUrl,
    network: fixture.network,
    swigConfigAddress: fixture.swigConfigAddress,
    swigWalletAddress: fixture.swigWalletAddress,
    developer: fixture.developer,
    resourceUrl: `${resourceServerUrl}/weather`,
  });
} finally {
  if (resourceServer) {
    await closeServer(resourceServer);
  }
  await closeServer(facilitator);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
