import cors from '@fastify/cors';
import chalk from 'chalk';
import Fastify from 'fastify';
import { accountRoutes } from './routes/accounts.js';
import { schedulerService } from './services/scheduler.js';
import { swigService } from './services/swig.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const fastify = Fastify({
    logger: true,
  });

  try {
    // Register CORS
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    // Register routes
    await fastify.register(accountRoutes);

    // Health check endpoint
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Initialize services
    console.log(chalk.blue('🔧 Initializing services...'));
    await swigService.initialize();

    console.log(chalk.blue('🚀 Starting automated job scheduler...'));
    schedulerService.start();

    // Start server
    await fastify.listen({ port: PORT, host: HOST });

    console.log(chalk.green('✅ Server started successfully!'));
    console.log(chalk.cyan(`📡 API Server: http://localhost:${PORT}`));
    console.log(
      chalk.cyan(`💼 Backend Address: ${swigService.getBackendAddress()}`),
    );
    console.log(chalk.yellow('🔄 Automated jobs running every 30 seconds'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to start server:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(
    chalk.yellow('\n🛑 Received SIGINT, shutting down gracefully...'),
  );
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(
    chalk.yellow('\n🛑 Received SIGTERM, shutting down gracefully...'),
  );
  schedulerService.stop();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error(chalk.red('💥 Unhandled error during startup:'), error);
  process.exit(1);
});
