import Fastify from 'fastify';
import { accountsRoutes } from './routes/accounts.js';
import { Scheduler } from './services/scheduler.js';
import { SwigService } from './services/swig.js';
import { AccountStore } from './store/memory.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  const fastify = Fastify({
    logger: true,
  });

  // Initialize services
  const swigService = new SwigService();
  const accountStore = new AccountStore();
  const scheduler = new Scheduler(swigService, accountStore);

  // Initialize backend
  console.log('Initializing backend...');
  await swigService.initialize();

  // CORS - must be before routes
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return reply.code(200).send();
    }
  });

  // Register routes with /api prefix
  fastify.register(accountsRoutes, {
    prefix: '/api',
    swigService,
    accountStore,
  });

  // Start scheduler
  scheduler.start();

  // Start server
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📡 Backend address: ${swigService.getBackendAddress()?.toString()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
