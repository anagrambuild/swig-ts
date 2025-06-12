import type {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import { type CompactInstruction } from '@swig-wallet/coder';
import type { SignV1BaseAccountMetas } from './signV1';

/**
 * Convert TransactionInstructions to CompactInstructions
 * @param swigAccount Swig account
 * @param accounts SignInstruction AccountMetas
 * @param innerInstructions Transaction instructions to convert
 * @returns Object with Combined AccountMetas (accounts) & CompactInstructions (compactIxs)
 */
export function compactInstructions<
  T extends [...SignV1BaseAccountMetas, ...AccountMeta[]],
>(
  swigAccount: PublicKey,
  accounts: T,
  innerInstructions: TransactionInstruction[],
  subAccount?: PublicKey,
): { accounts: T; compactIxs: CompactInstruction[] } {
  const compactIxs: CompactInstruction[] = [];
  const hashmap = new Map<string, number>(
    accounts.map((x, i) => [x.pubkey.toBase58(), i]),
  );

  for (const ix of innerInstructions) {
    const programIdIndex = accounts.length;
    accounts.push({ pubkey: ix.programId, isSigner: false, isWritable: false });

    const accts: number[] = [];
    for (const ixAccount of ix.keys) {
      if (
        ixAccount.pubkey.toString() === swigAccount.toString() ||
        ixAccount.pubkey.toString() === subAccount?.toString()
      ) {
        ixAccount.isSigner = false;
      }

      const accountIndex = hashmap.get(ixAccount.pubkey.toBase58());
      if (accountIndex !== undefined) {
        accts.push(accountIndex);
      } else {
        const idx = accounts.length;
        hashmap.set(ixAccount.pubkey.toBase58(), idx);
        accounts.push(ixAccount);
        accts.push(idx);
      }
    }

    compactIxs.push({
      programIdIndex,
      accounts: accts,
      data: ix.data,
    });
  }

  return { accounts, compactIxs };
}
