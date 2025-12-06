import type { Address } from '@solana/kit';

export interface Account {
  id: string;
  swigAddress: Address;
  walletAddress: Address;
  userAddress: Address;
  managerAddress: Address;
}

export class AccountStore {
  private accounts: Map<string, Account> = new Map();

  addAccount(account: Account): void {
    this.accounts.set(account.id, account);
    console.log(`Account registered: ${account.swigAddress.toString()}`);
  }

  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  removeAccount(id: string): boolean {
    return this.accounts.delete(id);
  }

  clear(): void {
    this.accounts.clear();
  }
}
