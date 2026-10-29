import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { SWIG_PROGRAM_ADDRESS } from '@swig-wallet/classic';

/** Refund destinations must be present even when the SDK predates rent tails. */
export function appendRentClaimer(
  instructions: TransactionInstruction[],
  rentClaimer: PublicKey | null,
): void {
  if (!rentClaimer) return;
  for (const ix of instructions) {
    if (!ix.programId.equals(SWIG_PROGRAM_ADDRESS)) continue;
    const existing = ix.keys.find((key) => key.pubkey.equals(rentClaimer));
    if (existing) existing.isWritable = true;
    else
      ix.keys.push({ pubkey: rentClaimer, isSigner: false, isWritable: true });
  }
}

/** Closing the signing PDA would strand even empty token accounts' rent. */
export async function requireNoTokenAccounts(
  conn: Connection,
  owner: PublicKey,
): Promise<void> {
  const accounts = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
      conn.getTokenAccountsByOwner(owner, { programId }),
    ),
  );
  const addresses = accounts.flatMap((result) =>
    result.value.map((account) => account.pubkey.toBase58()),
  );
  if (addresses.length > 0) {
    throw new Error(
      `Close all token accounts before closing ${owner.toBase58()}: ${addresses.join(', ')}`,
    );
  }
}
