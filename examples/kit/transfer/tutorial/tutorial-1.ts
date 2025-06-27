import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  lamports,
} from '@solana/kit';
import {
  Actions,
  createSwig,
  Ed25519Authority,
  findSwigPda,
} from '@swig-wallet/kit';
import bs58 from 'bs58';
import chalk from 'chalk';

const LAMPORTS_PER_SOL = 1_000_000_000n;

function toBase58(addr: string | Uint8Array): string {
  if (typeof addr === 'string') return addr;
  if (addr instanceof Uint8Array) return bs58.encode(addr);
  throw new Error('Invalid address type');
}

async function waitForBalance(
  rpc,
  address,
  minBalance,
  maxRetries = 10,
  delayMs = 500,
) {
  for (let i = 0; i < maxRetries; i++) {
    const { value: balance } = await rpc.getBalance(address).send();
    if (balance >= minBalance) return balance;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('Airdrop not confirmed after waiting');
}

async function createSwigAccount(rpc, rpcSubscriptions, userSigner) {
  try {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);
    const [swigAddressRaw] = await findSwigPda(id);
    const swigAddress = toBase58(swigAddressRaw);
    const rootAuthority = Ed25519Authority.fromAddress(
      address(toBase58(userSigner.address)),
    );
    const rootActions = Actions.set().manageAuthority().get();
    console.log('[debug][kit-createSwig] args:', {
      id: Array.from(id),
      rootAuthority,
      rootAuthorityAddress: rootAuthority.address,
      rootActions,
      userSigner,
      userSignerAddress: userSigner.address,
      userSignerType: typeof userSigner.address,
      userSignerIsString: typeof userSigner.address === 'string',
      userSignerIsUint8Array: userSigner.address instanceof Uint8Array,
    });
    const result = await createSwig(
      rpc,
      rpcSubscriptions,
      id,
      rootAuthority,
      rootActions,
      userSigner,
    );
    console.log('[kit] createSwig result:', result);
    console.log(
      chalk.green('✓ Swig account created at:'),
      chalk.cyan(swigAddress),
    );
    return swigAddress;
  } catch (error) {
    console.error(
      chalk.red('✗ Error creating Swig account:'),
      chalk.red(error),
    );
    throw error;
  }
}

(async () => {
  console.log(chalk.blue('🚀 Starting tutorial'));
  const rpc = createSolanaRpc('http://localhost:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900');
  const userSigner = await generateKeyPairSigner();
  const userAddress = toBase58(userSigner.address);
  console.log('[kit] userSigner:', {
    address: userAddress,
    hasSignTransactions: typeof userSigner.signTransactions === 'function',
    hasModifyAndSignTransactions:
      'modifyAndSignTransactions' in userSigner &&
      typeof (userSigner as any).modifyAndSignTransactions === 'function',
    object: userSigner,
  });
  await rpc
    .requestAirdrop(address(userAddress), lamports(100n * LAMPORTS_PER_SOL))
    .send();
  // Wait for airdrop confirmation
  const balance = await waitForBalance(
    rpc,
    address(userAddress),
    lamports(100n * LAMPORTS_PER_SOL),
  );
  console.log('[kit] Airdrop balance:', balance);
  console.log(chalk.green('👤 User address:'), chalk.cyan(userAddress));
  const swigAddress = await createSwigAccount(
    rpc,
    rpcSubscriptions,
    userSigner,
  );
  setTimeout(() => {
    console.log(chalk.green('\n✨ Everything looks good!'));
    console.log(
      chalk.yellow('🔍 Check out your transaction on Solana Explorer:'),
    );
    console.log(
      chalk.cyan(
        `https://explorer.solana.com/address/${swigAddress}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
      ),
    );
  }, 2000);
})();
