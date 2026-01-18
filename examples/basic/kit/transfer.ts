import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type IInstruction,
  type KeyPairSigner,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const LAMPORTS_PER_SOL = 1_000_000_000n;

// ---------- helpers ----------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function confirmAirdrop(
  rpc: Rpc<SolanaRpcApi>,
  to: Address,
  amount: bigint,
) {
  const sig = await rpc.requestAirdrop(to, lamports(amount)).send();
  await rpc.getSignatureStatuses([sig]).send();
  await delay(2000);
}

function getSolTransferInstruction(args: {
  fromAddress: Address;
  toAddress: Address;
  lamports: bigint;
}) {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: args.fromAddress, role: AccountRole.WRITABLE_SIGNER },
      { address: args.toAddress, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({
        amount: args.lamports,
      }),
    ),
  } satisfies IInstruction;
}

function getTransactionMessage<Inst extends IInstruction[]>(
  instructions: Inst,
  latestBlockhash: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>,
  feePayer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => addSignersToTransactionMessage(signers, tx),
  );
}

async function sendTransaction<T extends IInstruction[]>(
  connection: {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  },
  instructions: T,
  payer: KeyPairSigner,
  signers: KeyPairSigner[] = [],
) {
  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  const txMsg = getTransactionMessage(
    instructions,
    latestBlockhash,
    payer,
    signers,
  );
  const signed = await signTransactionMessageWithSigners(txMsg);

  await sendAndConfirmTransactionFactory(connection)(signed, {
    commitment: 'confirmed',
  });

  const sig = getSignatureFromTransaction(signed).toString();
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

// ---------- main ----------
console.log('Starting Kit transfer example...');

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const WS_URL = process.env.WS_URL || 'wss://api.devnet.solana.com';
console.log(`Using RPC: ${RPC_URL}`);

const connection = {
  rpc: createSolanaRpc(RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
};

// Root (all actions)
const userRootKeypair = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  userRootKeypair.address,
  1n * LAMPORTS_PER_SOL,
);

// Authority manager (can manage authority)
const userAuthorityManagerKeypair = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  userAuthorityManagerKeypair.address,
  1n * LAMPORTS_PER_SOL,
);

// Dapp authority (spend-limited)
const dappAuthorityKeypair = await generateKeyPairSigner();
await confirmAirdrop(
  connection.rpc,
  dappAuthorityKeypair.address,
  1n * LAMPORTS_PER_SOL,
);

const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('Swig address:', swigAccountAddress);

// Create SWIG
console.log('Creating SWIG...');
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  payer: userRootKeypair.address,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(userRootKeypair.address),
  id,
});
await sendTransaction(connection, [createSwigIx], userRootKeypair);

// Fetch swig + roles
const swig = await fetchSwig(connection.rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('Swig wallet address:', swigWalletAddress);
const rootRole = swig.findRolesByEd25519SignerPk(userRootKeypair.address)[0];
if (!rootRole) throw new Error('Root role not found');

// Grant manager role (manageAuthority)
console.log('Adding manager role...');
const manageAuthorityActions = Actions.set().manageAuthority().get();
const addManagerIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(userAuthorityManagerKeypair.address),
  manageAuthorityActions,
  { payer: userRootKeypair.address },
);
await sendTransaction(connection, addManagerIxs, userRootKeypair);

// Refetch & locate manager role by signer pubkey
await swig.refetch();
const managerRole = swig.findRolesByEd25519SignerPk(
  userAuthorityManagerKeypair.address,
)[0];
if (!managerRole) throw new Error('Manager role not found');

// Create a spend-limited actions set for the dapp (0.1 SOL)
console.log('Adding dapp authority with 0.1 SOL limit...');
const dappAuthorityActions = Actions.set()
  .solLimit({ amount: LAMPORTS_PER_SOL / 10n })
  .get();

const addDappAuthorityIxs = await getAddAuthorityInstructions(
  swig,
  managerRole.id,
  createEd25519AuthorityInfo(dappAuthorityKeypair.address),
  dappAuthorityActions,
  { payer: userAuthorityManagerKeypair.address },
);
await sendTransaction(
  connection,
  addDappAuthorityIxs,
  userAuthorityManagerKeypair,
);

// Fund the SWIG wallet
await confirmAirdrop(connection.rpc, swigWalletAddress, 1n * LAMPORTS_PER_SOL);

// Refresh state
await swig.refetch();

console.log(
  'Roles can spend 0.1 SOL:',
  swig.roles.map((r) => r.actions.canSpendSol(LAMPORTS_PER_SOL / 10n)),
);

const dappAuthorityRole = swig.findRolesByEd25519SignerPk(
  dappAuthorityKeypair.address,
)[0];
if (!dappAuthorityRole) throw new Error('Dapp authority role not found');

// Verify authority matches
if (
  !dappAuthorityRole.authority.matchesSigner(
    new Uint8Array(getAddressEncoder().encode(dappAuthorityKeypair.address)),
  )
) {
  throw new Error('Role authority does not match expected authority');
}

// First transfer: spend the full 0.1 SOL allowance
console.log('Attempting first transfer of 0.1 SOL...');
console.log(
  'Balance before:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value.toString(),
);

const finalizedSlot = BigInt(
  await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
);

let transfer = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: dappAuthorityKeypair.address,
  lamports: LAMPORTS_PER_SOL / 10n,
});

let signTransferIxs = await getSignInstructions(
  swig,
  dappAuthorityRole.id,
  [transfer],
  false,
  { payer: dappAuthorityKeypair.address, currentSlot: finalizedSlot },
);

await sendTransaction(connection, signTransferIxs, dappAuthorityKeypair);

console.log(
  'Balance after first transfer:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value.toString(),
);

// Refresh before second attempt
await swig.refetch();

// Second transfer: attempt to overspend (should fail)
console.log('Attempting second transfer (0.05 SOL, should fail)...');
transfer = getSolTransferInstruction({
  fromAddress: swigWalletAddress,
  toAddress: dappAuthorityKeypair.address,
  lamports: (LAMPORTS_PER_SOL * 5n) / 100n,
});

signTransferIxs = await getSignInstructions(
  swig,
  dappAuthorityRole.id,
  [transfer],
  false,
  {
    payer: dappAuthorityKeypair.address,
    currentSlot: BigInt(
      await connection.rpc.getSlot({ commitment: 'finalized' }).send(),
    ),
  },
);

await sendTransaction(connection, signTransferIxs, dappAuthorityKeypair)
  .then(() => {
    throw new Error(
      'Transaction succeeded! Dapp authority spent more than allowed',
    );
  })
  .catch((err) => {
    if (err.message.includes('spent more than allowed')) throw err;
    console.log('Second transfer failed as expected (limit exceeded)');
  });

console.log(
  'Final balance:',
  (await connection.rpc.getBalance(swigWalletAddress).send()).value,
);

console.log('Done!');
