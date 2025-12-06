import cron from 'node-cron';
import type { Address } from '@solana/kit';
import type { SwigService } from './swig.js';
import type { AccountStore } from '../store/memory.js';

export class Scheduler {
  private swigService: SwigService;
  private accountStore: AccountStore;
  private task: cron.ScheduledTask | null = null;

  constructor(swigService: SwigService, accountStore: AccountStore) {
    this.swigService = swigService;
    this.accountStore = accountStore;
  }

  start() {
    if (this.task) {
      console.log('Scheduler already running');
      return;
    }

    console.log('Starting automated job scheduler (runs every 1 second)...');

    // Run every 1 second
    this.task = cron.schedule('* * * * * *', async () => {
      await this.runAutomatedActions();
    });

    // Run once immediately
    this.runAutomatedActions();
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Scheduler stopped');
    }
  }

  private async runAutomatedActions() {
    const accounts = this.accountStore.getAllAccounts();

    if (accounts.length === 0) {
      console.log('No accounts registered, skipping automated actions');
      return;
    }

    console.log(`Running automated actions on ${accounts.length} account(s)...`);

    const backendAddress = this.swigService.getBackendAddress();
    if (!backendAddress) {
      console.error('Backend address not available, skipping automated actions');
      return;
    }

    for (const account of accounts) {
      try {
        // Perform a small transfer (0.01 SOL) to demonstrate automation
        // Transfer to backend address (in production, this would be a treasury or specific destination)
        const signature = await this.swigService.performTransfer(
          account.swigAddress,
          backendAddress,
          0.01, // 0.01 SOL
        );

        console.log(
          `✅ Automated transfer completed for account ${account.swigAddress.toString()}: ${signature}`,
        );
      } catch (error) {
        console.error(
          `❌ Failed automated action for account ${account.swigAddress.toString()}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}
