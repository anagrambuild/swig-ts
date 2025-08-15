import chalk from 'chalk';
import cron from 'node-cron';
import { memoryStore } from '../store/memory.js';
import { swigService } from './swig.js';

class SchedulerService {
  private isRunning = false;
  private task: cron.ScheduledTask | null = null;

  start(): void {
    if (this.isRunning) {
      console.log(chalk.yellow('Scheduler is already running'));
      return;
    }

    console.log(chalk.green('Starting automated job scheduler...'));

    // Run every 5 seconds
    this.task = cron.schedule(
      '*/5 * * * * *',
      async () => {
        await this.runAutomatedActions();
      },
      {
        scheduled: false,
      },
    );

    this.task.start();
    this.isRunning = true;

    console.log(
      chalk.green('✅ Scheduler started - will run every 30 seconds'),
    );
  }

  stop(): void {
    if (!this.isRunning || !this.task) {
      console.log(chalk.yellow('Scheduler is not running'));
      return;
    }

    this.task.stop();
    this.task = null;
    this.isRunning = false;

    console.log(chalk.red('🛑 Scheduler stopped'));
  }

  isJobsRunning(): boolean {
    return this.isRunning;
  }

  private async runAutomatedActions(): Promise<void> {
    const accounts = memoryStore.getAllAccounts();

    if (accounts.length === 0) {
      console.log(chalk.gray('⏭️ No accounts registered for automation'));
      return;
    }

    console.log(
      chalk.blue(
        `🤖 Running automated actions for ${accounts.length} accounts...`,
      ),
    );

    for (const account of accounts) {
      try {
        const balance = await swigService.getBalance(account.swigAddress);

        // Update balance in store
        memoryStore.updateAccount(account.swigAddress, { balance });

        // Only perform action if account has sufficient balance (> 0.02 SOL)
        if (balance > 0.02 * 1_000_000_000) {
          console.log(
            chalk.cyan(
              `💰 Performing automated action for ${account.swigAddress}`,
            ),
          );

          const signature = await swigService.performAutomatedAction(
            account.swigAddress,
          );
          const timestamp = new Date().toISOString();

          memoryStore.updateAccount(account.swigAddress, {
            lastAction: `Automated transfer at ${timestamp} - TX: ${signature.slice(0, 8)}...`,
          });

          console.log(
            chalk.green(`✅ Automated action completed: ${signature}`),
          );
        } else {
          console.log(
            chalk.yellow(
              `⚠️ Insufficient balance for ${account.swigAddress}: ${balance / 1_000_000_000} SOL`,
            ),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Error performing action for ${account.swigAddress}:`),
          error,
        );

        memoryStore.updateAccount(account.swigAddress, {
          lastAction: `Error at ${new Date().toISOString()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    console.log(chalk.blue('🏁 Automated actions batch completed'));
  }
}

export const schedulerService = new SchedulerService();
