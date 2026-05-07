import { type CompactInstruction } from '@swig-wallet/coder';
import {
  SYSTEM_PROGRAM_ADDRESS_STRING,
  SYSVAR_RENT_ADDRESS_STRING,
  TOKEN_PROGRAM_ADDRESS_STRING,
} from '../consts';
import {
  SolAccountMeta,
  SolInstruction,
  SolPublicKey,
  type SolPublicKeyData,
} from '../solana';

/**
 * Detect and sanitize SyncNative instructions.  Spl-token's SyncNative
 * only expects the wSOL ATA, but Swig's compaction can append extra
 * accounts to satisfy solana-labs/solana#9711 (unbalanced CPI lamport
 * tracking).  p-token #138 validates extra accounts: if a 2nd account
 * exists it must be the Rent sysvar.  Pre-p-token ignored extra accounts,
 * so adding Rent + swigAccount is safe on both sides.
 */
function isSyncNative(ix: SolInstruction): boolean {
  return (
    ix.program.toBase58() === TOKEN_PROGRAM_ADDRESS_STRING &&
    ix.data.length === 1 &&
    ix.data[0] === 17 // SyncNative instruction discriminator
  );
}

function sanitizeSyncNative(ix: SolInstruction): SolInstruction {
  if (!isSyncNative(ix)) return ix;

  return new SolInstruction({
    program: ix.program,
    data: ix.data,
    accounts: ix.accounts.slice(0, 1), // keep only wSOL ATA
  });
}

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

  // Sanitize inner instructions before compaction
  const sanitizedInstructions = innerInstructions.map(sanitizeSyncNative);

  let handleUnbalanced = false;
  for (const ix of sanitizedInstructions) {
    const programIdIndex = accounts.length;

    accounts.push(SolAccountMeta.readonly(ix.program));

    const syncNative = isSyncNative(ix);

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
        const existingAccount = accounts[accountIndex];
        // Upgrade privileges if needed
        if (ixAccount.writable && !existingAccount.writable) {
          existingAccount.setWritable(true);
        }
        if (ixAccount.signer && !existingAccount.signer) {
          existingAccount.setSigner(true);
        }
        accts.push(accountIndex);
      } else {
        const idx = accounts.length;
        hashmap.set(ixAccount.publicKey.toBase58(), idx);
        accounts.push(ixAccount);
        accts.push(idx);
      }
    }

    // After a SystemProgram.transfer the swig account's lamports have
    // changed.  The Solana runtime needs that account in the next CPI so
    // it can verify lamport balances (solana-labs/solana#9711).
    //
    // For SyncNative this creates a p-token #138 conflict: the appended
    // swig account would be the 2nd account, but p-token requires the 2nd
    // account to be the Rent sysvar.  We resolve this by inserting Rent
    // before the swig account so SyncNative sees [wSOL ATA, Rent, swig].
    // Pre-p-token silently ignores extras, so this is backwards-safe.
    if (handleUnbalanced) {
      if (syncNative) {
        // Ensure Rent sysvar is in the combined accounts list
        const rentPubkey = new SolPublicKey(SYSVAR_RENT_ADDRESS_STRING);
        let rentIndex = hashmap.get(rentPubkey.toBase58());
        if (rentIndex === undefined) {
          rentIndex = accounts.length;
          hashmap.set(rentPubkey.toBase58(), rentIndex);
          accounts.push(SolAccountMeta.readonly(rentPubkey));
        }
        accts.push(rentIndex);
      }

      const swigIndex = hashmap.get(new SolPublicKey(swigAccount).toBase58());
      if (swigIndex !== undefined) {
        accts.push(swigIndex);
      } else {
        accts.push(0); // Should be first account until SignV2 changes come
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
