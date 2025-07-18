import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  lamports,
  pipe,
  AccountRole,
  type IInstructionWithData,
  type KeyPairSigner,
  type ReadonlyUint8Array,
} from '@solana/kit';

import {
  Actions,
  createSecp256k1AuthorityInfo,
  findSwigPda,
  fetchSwig,
  getCreateSwigInstruction,
  getEvmPersonalSignPrefix,
  getSignInstructions,
  type SigningFn,
} from '@swig-wallet/kit';

import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';

import { Wallet } from '@ethereumjs/wallet';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, hexToBytes } from 'viem';
import { sleepSync } from 'bun';

console.log('Starting Swig viem transfer on localnet...');
console.log('This example demonstrates three different ways to sign transactions using Viem:');
console.log('1. Direct keccak256 hash signing (raw message bytes)');
console.log('2. Manual Ethereum personal sign prefix (adds \\x19Ethereum Signed Message... manually)');
console.log('3. Viem signMessage method (automatically adds Ethereum personal sign prefix)');
console.log('Each method will transfer 0.1 SOL to show they all work equivalently.\n');

// Set up Solana localnet RPC
const rpc = createSolanaRpc('http://localhost:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
const connection = { rpc, rpcSubscriptions };

// Generate EVM wallet
const userWallet = Wallet.generate();
const evmAccount = privateKeyToAccount(userWallet.getPrivateKeyString());

// Generate localnet payers
const payer = await generateKeyPairSigner();
const dappTreasury = await generateKeyPairSigner();
await rpc.requestAirdrop(payer.address, lamports(1_000_000_000n)).send();
await rpc.requestAirdrop(dappTreasury.address, lamports(1_000_000_000n)).send();
sleepSync(2000);

// Swig ID and address
const swigId = Uint8Array.from(Array(32).fill(1));
const swigAddress = await findSwigPda(swigId);

// Create Swig with secp256k1 authority
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  authorityInfo: createSecp256k1AuthorityInfo(evmAccount.publicKey),
  id: swigId,
  payer: payer.address,
  actions: rootActions,
});
await sendTransaction(connection, [{ ...createSwigIx, data: new Uint8Array(createSwigIx.data) }], payer);

// Fund Swig PDA
await rpc.requestAirdrop(swigAddress, lamports(1_000_000_000n)).send();
sleepSync(2000);

// Fetch Swig account and role
let swig = await fetchSwig(rpc, swigAddress);
let rootRole = swig.findRolesBySecp256k1SignerAddress(evmAccount.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Prepare transfer instruction (0.1 SOL)
const transferIx = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: swigAddress, role: AccountRole.WRITABLE_SIGNER },
    { address: dappTreasury.address, role: AccountRole.WRITABLE },
  ],
  data: new Uint8Array(
    getTransferSolInstructionDataEncoder().encode({
      amount: lamports(100_000_000n), // 0.1 SOL
    }),
  ),
};

// Signing variants

// Method 1: Direct keccak256 hash - signs the raw message bytes directly
const viemSign: SigningFn = async (message) => {
  const sig = await evmAccount.sign({ hash: keccak256(message) });
  return { signature: hexToBytes(sig) };
};

// Method 2: Manual Ethereum personal sign - adds "\x19Ethereum Signed Message:\n{length}" prefix manually
const viemSignWithPrefix: SigningFn = async (message) => {
  const prefix = getEvmPersonalSignPrefix(message.length);
  const prefixedMessage = new Uint8Array(prefix.length + message.length);
  prefixedMessage.set(prefix);
  prefixedMessage.set(message, prefix.length);
  const sig = await evmAccount.sign({ hash: keccak256(prefixedMessage) });
  return { signature: hexToBytes(sig), prefix };
};

// Method 3: Viem's signMessage - automatically adds Ethereum personal sign prefix
const viemSignMessage: SigningFn = async (message) => {
  const sig = await evmAccount.signMessage({ message: { raw: message } });
  return {
    signature: hexToBytes(sig),
    prefix: getEvmPersonalSignPrefix(message.length),
  };
};

// Send transfers using each signing method
await signAndSendSwigTransfer('Direct keccak256 hash signing (raw message)', viemSign);
await signAndSendSwigTransfer('Manual Ethereum personal sign prefix (\\x19Ethereum Signed Message...)', viemSignWithPrefix);
await signAndSendSwigTransfer('Viem signMessage method (includes Ethereum personal sign prefix)', viemSignMessage);

// ---------- Helper Functions ----------

async function signAndSendSwigTransfer(
  label: string,
  signingFn: SigningFn,
): Promise<void> {
  const currentSlot = await rpc.getSlot().send();
  swig = await fetchSwig(rpc, swigAddress);
  rootRole = swig.findRolesBySecp256k1SignerAddress(evmAccount.address)[0];
  if (!rootRole) throw new Error('Role not found');

  const signedIxs = await getSignInstructions(swig, rootRole.id, [transferIx], false, {
    payer: payer.address,
    currentSlot,
    signingFn,
  });

  const before = (await rpc.getBalance(swigAddress).send()).value;
  const sig = await sendTransaction(connection, signedIxs, payer);
  const after = (await rpc.getBalance(swigAddress).send()).value;

  console.log(`\n=== ${label} ===`);
  console.log(`Swig balance before transfer: ${before} lamports (${(Number(before) / 1_000_000_000).toFixed(3)} SOL)`);
  console.log(`Swig balance after transfer:  ${after} lamports (${(Number(after) / 1_000_000_000).toFixed(3)} SOL)`);
  console.log(`Amount transferred: ${Number(before) - Number(after)} lamports (${((Number(before) - Number(after)) / 1_000_000_000).toFixed(3)} SOL)`);
  console.log(`Transaction signature: ${sig}`);
  console.log(`Explorer URL: https://explorer.solana.com/tx/${sig}?cluster=custom`);
}

async function sendTransaction(
  connection: {
    rpc: ReturnType<typeof createSolanaRpc>;
    rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  },
  instructions: readonly IInstructionWithData<ReadonlyUint8Array>[],
  payer: KeyPairSigner,
): Promise<string> {
  const { value: latestBlockhash } = await connection.rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signed = await signTransactionMessageWithSigners(message);
  await sendAndConfirmTransactionFactory(connection as any)(signed, { commitment: 'confirmed' });

  return getSignatureFromTransaction(signed).toString();
}