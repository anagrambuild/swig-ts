import {
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendTransactionWithoutConfirmingFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type IInstruction,
  type KeyPairSigner,
} from '@solana/kit';
import { createConnection, type SolanaConnection } from './solana';

// Polling-based confirmation without websockets
async function confirmTransaction(
  rpc: SolanaConnection['rpc'],
  signature: string,
  commitment: 'confirmed' | 'finalized' = 'finalized',
): Promise<void> {
  const maxAttempts = 667; // ~60 seconds max (667 * 90ms ≈ 60s)
  const delayMs = 90; // 90ms between attempts

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { value: statuses } = await rpc
      .getSignatureStatuses([signature as any])
      .send();

    const status = statuses[0];
    if (status) {
      if (status.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.err)}`,
        );
      }
      if (
        status.confirmationStatus === commitment ||
        status.confirmationStatus === 'finalized'
      ) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `Transaction confirmation timeout after ${maxAttempts} attempts`,
  );
}

export async function sendTransaction<T extends IInstruction[]>(
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
  connection?: SolanaConnection,
): Promise<string> {
  const conn = connection || createConnection();
  const { value: latestBlockhash } = await conn.rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage,
  );

  // Get signature before sending
  const signature = getSignatureFromTransaction(signedTransaction);

  // Send transaction using RPC only (no websocket)
  const sendTransactionWithoutConfirming = sendTransactionWithoutConfirmingFactory({
    rpc: conn.rpc,
  });

  await sendTransactionWithoutConfirming(signedTransaction, {
    commitment: 'finalized',
    skipPreflight: false,
  });

  // Poll for confirmation
  await confirmTransaction(conn.rpc, signature.toString(), 'finalized');

  return signature.toString();
}
