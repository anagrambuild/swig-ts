import { AccountRole, type Address, type IInstruction } from '@solana/kit';
import { type CompactInstruction } from '@swig-wallet/coder';
import type { SignV1BaseAccountMetas } from './signV1';

/**
 * Convert Kit IInstructions to CompactInstructions
 * @param swigAccount Swig account
 * @param accounts SignInstruction AccountMetas
 * @param innerInstructions Kit instructions to convert
 * @returns Object with Combined AccountMetas (accounts) & CompactInstructions (compactIxs)
 */
export function compactInstructions<
  T extends [
    ...SignV1BaseAccountMetas,
    ...{ address: Address; role: AccountRole }[],
  ],
>(
  swigAccount: Address,
  accounts: T,
  innerInstructions: IInstruction[],
  subAccount?: Address,
): { accounts: T; compactIxs: CompactInstruction[] } {
  const compactIxs: CompactInstruction[] = [];

  // Guard all addresses before using as keys in the hashmap
  accounts.forEach((x, i) => {
    if (
      !x.address ||
      x.address === 'undefined' ||
      (typeof x.address === 'string' && x.address.length < 32)
    ) {
      console.error(
        '[kit][FATAL] compactInstructions: accounts meta.address is undefined:',
        x,
        'at index',
        i,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] compactInstructions: accounts meta.address is undefined: ' +
          JSON.stringify(x) +
          ' at index ' +
          i +
          ' stack: ' +
          new Error().stack,
      );
    }
  });
  const hashmap = new Map<string, number>(
    accounts.map((x, i) => [x.address, i]),
  );

  for (const ix of innerInstructions) {
    const programIdIndex = accounts.length;
    if (
      !ix.programAddress ||
      ix.programAddress === 'undefined' ||
      (typeof ix.programAddress === 'string' && ix.programAddress.length < 32)
    ) {
      console.error(
        '[kit][FATAL] compactInstructions: programAddress is undefined:',
        ix,
        'stack:',
        new Error().stack,
      );
      throw new Error(
        '[kit][FATAL] compactInstructions: programAddress is undefined: ' +
          JSON.stringify(ix) +
          ' stack: ' +
          new Error().stack,
      );
    }
    accounts.push({
      address: ix.programAddress,
      role: AccountRole.READONLY,
    } as T[number]);

    const accts: number[] = [];
    for (const ixAccount of ix.accounts ?? []) {
      if (
        !ixAccount.address ||
        ixAccount.address === 'undefined' ||
        (typeof ixAccount.address === 'string' && ixAccount.address.length < 32)
      ) {
        console.error(
          '[kit][FATAL] compactInstructions: ixAccount.address is undefined:',
          ixAccount,
          'stack:',
          new Error().stack,
        );
        throw new Error(
          '[kit][FATAL] compactInstructions: ixAccount.address is undefined: ' +
            JSON.stringify(ixAccount) +
            ' stack: ' +
            new Error().stack,
        );
      }
      if (
        ixAccount.address === swigAccount ||
        (subAccount && ixAccount.address === subAccount)
      ) {
        // No direct isSigner property; roles are set at construction time
        // If you need to change the role, do it here
      }

      const accountIndex = hashmap.get(ixAccount.address);
      if (accountIndex !== undefined) {
        accts.push(accountIndex);
      } else {
        const idx = accounts.length;
        // Guard before using ixAccount.address as a key
        if (
          !ixAccount.address ||
          ixAccount.address === 'undefined' ||
          (typeof ixAccount.address === 'string' &&
            ixAccount.address.length < 32)
        ) {
          console.error(
            '[kit][FATAL] compactInstructions: ixAccount.address is undefined (hashmap set):',
            ixAccount,
            'stack:',
            new Error().stack,
          );
          throw new Error(
            '[kit][FATAL] compactInstructions: ixAccount.address is undefined (hashmap set): ' +
              JSON.stringify(ixAccount) +
              ' stack: ' +
              new Error().stack,
          );
        }
        hashmap.set(ixAccount.address, idx);
        accounts.push(ixAccount as T[number]);
        accts.push(idx);
      }
    }

    compactIxs.push({
      programIdIndex,
      accounts: accts,
      data: ix.data!,
    });
  }

  return { accounts, compactIxs };
}
