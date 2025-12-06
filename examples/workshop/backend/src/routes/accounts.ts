import type { FastifyInstance } from 'fastify';
import type { SwigService } from '../services/swig.js';
import type { AccountStore } from '../store/memory.js';
import type {
  AccountResponse,
  RegisterAccountRequest,
  TransferRequest,
} from '../types/index.js';

export async function accountsRoutes(
  fastify: FastifyInstance,
  options: { swigService: SwigService; accountStore: AccountStore },
) {
  const { swigService, accountStore } = options;

  // Get backend address
  fastify.get('/backend-address', async (request, reply) => {
    const address = swigService.getBackendAddress();
    if (!address) {
      return reply.code(503).send({ error: 'Backend not initialized' });
    }
    return { address: address.toString() };
  });

  // Register a new account
  fastify.post<{ Body: RegisterAccountRequest }>(
    '/accounts',
    async (request, reply) => {
      const { swigAddress, walletAddress, userAddress, managerAddress } =
        request.body;

      // Generate a simple ID from swig address
      const id = swigAddress;

      const account = {
        id,
        swigAddress: swigAddress as any,
        walletAddress: walletAddress as any,
        userAddress: userAddress as any,
        managerAddress: managerAddress as any,
      };

      accountStore.addAccount(account);

      return {
        success: true,
        account: {
          id: account.id,
          swigAddress: account.swigAddress.toString(),
          walletAddress: account.walletAddress.toString(),
          userAddress: account.userAddress.toString(),
          managerAddress: account.managerAddress.toString(),
        },
      };
    },
  );

  // Get all accounts
  fastify.get('/accounts', async (request, reply) => {
    const accounts = accountStore.getAllAccounts();

    // Optionally fetch balances
    const accountsWithBalances: AccountResponse[] = await Promise.all(
      accounts.map(async (account) => {
        try {
          const connection = swigService.getConnection();
          const balance = await connection.rpc
            .getBalance(account.walletAddress)
            .send();
          return {
            id: account.id,
            swigAddress: account.swigAddress.toString(),
            walletAddress: account.walletAddress.toString(),
            userAddress: account.userAddress.toString(),
            managerAddress: account.managerAddress.toString(),
            balance: Number(balance.value),
          };
        } catch (error) {
          return {
            id: account.id,
            swigAddress: account.swigAddress.toString(),
            walletAddress: account.walletAddress.toString(),
            userAddress: account.userAddress.toString(),
            managerAddress: account.managerAddress.toString(),
          };
        }
      }),
    );

    return accountsWithBalances;
  });

  // Trigger manual transfer
  fastify.post<{ Params: { id: string }; Body: TransferRequest }>(
    '/accounts/:id/transfer',
    async (request, reply) => {
      const { id } = request.params;
      const { amount } = request.body;

      const account = accountStore.getAccount(id);
      if (!account) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      try {
        // For demo purposes, transfer to the backend address
        // In production, this would be a specific destination
        const backendAddress = swigService.getBackendAddress();
        if (!backendAddress) {
          return reply.code(503).send({ error: 'Backend not initialized' });
        }
        const signature = await swigService.performTransfer(
          account.swigAddress,
          backendAddress,
          amount || 0.01,
        );

        return {
          success: true,
          transactionSignature: signature,
        };
      } catch (error) {
        return reply
          .code(500)
          .send({
            error:
              error instanceof Error ? error.message : 'Transfer failed',
          });
      }
    },
  );
}
