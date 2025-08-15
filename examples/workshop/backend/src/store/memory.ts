import type { Address } from '@solana/kit';
import type { RegisteredAccount } from '../types/index.js';

class MemoryStore {
  private accounts: Map<Address, RegisteredAccount> = new Map();

  addAccount(account: RegisteredAccount): void {
    this.accounts.set(account.swigAddress, account);
  }

  getAccount(swigAddress: Address): RegisteredAccount | undefined {
    return this.accounts.get(swigAddress);
  }

  getAllAccounts(): RegisteredAccount[] {
    return Array.from(this.accounts.values());
  }

  updateAccount(
    swigAddress: Address,
    updates: Partial<RegisteredAccount>,
  ): boolean {
    const account = this.accounts.get(swigAddress);
    if (!account) return false;

    const updatedAccount = { ...account, ...updates };
    this.accounts.set(swigAddress, updatedAccount);
    return true;
  }

  removeAccount(swigAddress: Address): boolean {
    return this.accounts.delete(swigAddress);
  }

  getTotalAccounts(): number {
    return this.accounts.size;
  }

  clear(): void {
    this.accounts.clear();
  }
}

export const memoryStore = new MemoryStore();
