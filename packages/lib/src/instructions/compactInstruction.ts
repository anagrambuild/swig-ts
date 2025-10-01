import { type CompactInstruction } from '@swig-wallet/coder';
import { SYSTEM_PROGRAM_ADDRESS_STRING } from '../consts';
import {
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../solana';

/**
 * Convert TransactionInstructions to CompactInstructions
 * @param swigAccount Swig account
 * @param accounts SignInstruction AccountMetas
 * @param innerInstructions Transaction instructions to convert
 * @returns Object with Combined AccountMetas (accounts) & CompactInstructions (compactIxs)
 */
export function compactInstructions<
  T extends SolAccountMeta[] = SolAccountMeta[],
>(
  swigAccount: SolPublicKeyData,
  accounts: T,
  innerInstructions: SolInstruction[],
  otherSwigPdas: SolPublicKeyData[] = [],
): { accounts: T; compactIxs: CompactInstruction[] } {
  const compactIxs: CompactInstruction[] = [];

  otherSwigPdas.push(swigAccount);

  const swigPdas = otherSwigPdas.map((pda) => new SolPublicKey(pda));

  const hashmap = new Map<string, number>(
    accounts.map((x, i) => [x.publicKey.toBase58(), i]),
  );
  let handleUnbalanced = false;
  for (const ix of innerInstructions) {
    const programIdIndex = accounts.length;

    accounts.push(SolAccountMeta.readonly(ix.program));

    const accts: number[] = [];
    for (const ixAccount of ix.accounts) {
      if (
        swigPdas.find(
          (pda) => pda.toBase58() === ixAccount.publicKey.toBase58(),
        )
      ) {
        ixAccount.setSigner(false);
      }

      const accountIndex = hashmap.get(ixAccount.publicKey.toBase58());
      if (accountIndex !== undefined) {
        accts.push(accountIndex);
      } else {
        const idx = accounts.length;
        hashmap.set(ixAccount.publicKey.toBase58(), idx);
        accounts.push(ixAccount);
        accts.push(idx);
      }
    }
    if (handleUnbalanced) {
      for (const swigPda of ix.accounts) {
        const accountIndex = swigPda
          ? hashmap.get(swigPda.toString())
          : hashmap.get(swigAccount.toString());
        if (accountIndex !== undefined) {
          accts.push(accountIndex);
        } else {
          accts.push(0); // Should be first account until SignV2 changes come
        }
      }
      handleUnbalanced = false;
    }
    if (
      ix.program.toBase58() === SYSTEM_PROGRAM_ADDRESS_STRING &&
      ix.data.subarray(0, 4).toString() ===
        Uint8Array.from([2, 0, 0, 0]).toString()
    ) {
      handleUnbalanced = true;
    }

    compactIxs.push({
      programIdIndex,
      accounts: accts,
      data: ix.data,
    });
  }

  return { accounts, compactIxs };
}
