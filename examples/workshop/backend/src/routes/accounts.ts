// BACKEND API ROUTES: Handle frontend communication for the workshop
import type { FastifyInstance } from 'fastify';
import { swigService } from '../services/swig.js';
import { memoryStore } from '../store/memory.js';
import type {
  RegisterAccountRequest,
  RegisterAccountResponse,
  StatusResponse,
  TriggerActionRequest,
  TriggerActionResponse,
} from '../types/index.js';

export async function accountRoutes(fastify: FastifyInstance) {
  // BACKEND API: Get backend wallet address for delegation (STEP 3 support)
  fastify.get<{
    Reply: { success: boolean; backendAddress?: string; message?: string };
  }>('/api/backend-address', async (_request, reply) => {
    try {
      const backendAddress = swigService.getBackendAddress();

      if (!backendAddress) {
        return reply.status(500).send({
          success: false,
          message: 'Backend wallet not initialized',
        });
      }

      return reply.send({
        success: true,
        backendAddress,
      });
    } catch (error) {
      console.error('Error getting backend address:', error);
      return reply.status(500).send({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  // BACKEND API: Register a Swig account for backend management (STEP 3 completion)
  fastify.post<{
    Body: RegisterAccountRequest;
    Reply: RegisterAccountResponse;
  }>('/api/accounts', async (request, reply) => {
    try {
      const { swigAddress, userAddress, id } = request.body;

      if (!swigAddress || !userAddress || !id) {
        return reply.status(400).send({
          success: false,
          message: 'Missing required fields: swigAddress, userAddress, id',
        });
      }

      // Check if account already exists
      const existingAccount = memoryStore.getAccount(swigAddress as any);
      if (existingAccount) {
        return reply.send({
          success: false,
          message: 'Account already registered',
        });
      }

      // Get current balance for monitoring
      const balance = await swigService.getBalance(swigAddress as any);

      // BACKEND: Store account in memory for tracking and automation
      memoryStore.addAccount({
        swigAddress: swigAddress as any,
        userAddress: userAddress as any,
        id,
        balance,
        registeredAt: new Date().toISOString(),
      });

      console.log(`✅ Account registered: ${swigAddress}`);

      return reply.send({
        success: true,
        message: 'Account registered successfully',
      });
    } catch (error) {
      console.error('Error registering account:', error);
      return reply.status(500).send({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  // BACKEND API: Trigger manual actions using delegated authority (STEP 4 feature)
  fastify.post<{
    Body: TriggerActionRequest;
    Reply: TriggerActionResponse;
  }>('/api/trigger', async (request, reply) => {
    try {
      const { swigAddress, action } = request.body;

      if (!swigAddress || !action) {
        return reply.status(400).send({
          success: false,
          message: 'Missing required fields: swigAddress, action',
        });
      }

      const account = memoryStore.getAccount(swigAddress as any);
      if (!account) {
        return reply.status(404).send({
          success: false,
          message: 'Account not found',
        });
      }

      let signature: string;

      switch (action) {
        case 'transfer':
          // BACKEND: Execute transfer using delegated Swig authority
          signature = await swigService.performAutomatedAction(
            swigAddress as any,
          );
          break;
        default:
          return reply.status(400).send({
            success: false,
            message: `Unknown action: ${action}`,
          });
      }

      // Update account tracking with the action performed
      const timestamp = new Date().toISOString();
      memoryStore.updateAccount(swigAddress as any, {
        lastAction: `Manual ${action} at ${timestamp} - TX: ${signature.slice(0, 8)}...`,
      });

      console.log(`✅ Manual action triggered: ${signature}`);

      return reply.send({
        success: true,
        transactionSignature: signature,
        message: `${action} completed successfully`,
      });
    } catch (error) {
      console.error('Error triggering action:', error);
      return reply.status(500).send({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  // BACKEND API: Get dashboard status and account information (STEP 4 monitoring)
  fastify.get<{
    Reply: StatusResponse;
  }>('/api/status', async (_request, reply) => {
    try {
      const accounts = memoryStore.getAllAccounts();

      // BACKEND: Update real-time balances for dashboard monitoring
      for (const account of accounts) {
        const balance = await swigService.getBalance(account.swigAddress);
        memoryStore.updateAccount(account.swigAddress, { balance });
      }

      const updatedAccounts = memoryStore.getAllAccounts();

      return reply.send({
        accounts: updatedAccounts,
        totalAccounts: memoryStore.getTotalAccounts(),
        jobsRunning: true, // For now, always true in demo
      });
    } catch (error) {
      console.error('Error getting status:', error);
      return reply.status(500).send({
        accounts: [],
        totalAccounts: 0,
        jobsRunning: false,
      });
    }
  });
}
