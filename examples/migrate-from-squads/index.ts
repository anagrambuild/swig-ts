import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getCreateSwigInstructionBuilder,
  getSwigWalletAddress,
} from '@swig-wallet/classic';

import * as multisig from '@sqds/multisig';
import chalk from 'chalk';
import * as fs from 'fs';

async function sendTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: Keypair,
): Promise<string> {
  const tx = new Transaction().add(...instructions);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig);
  return sig;
}

async function main() {
  // Check for keypair file argument and squads address
  if (process.argv.length < 4) {
    console.error(
      chalk.red(
        'Please provide the path to your keypair file and squads address',
      ),
    );
    console.error(
      chalk.yellow(
        'Usage: bun run index.ts <path-to-squads-config-authority-keypair> <squads-address>',
      ),
    );
    process.exit(1);
  }

  const keypairPath = process.argv[2];
  if (!fs.existsSync(keypairPath)) {
    console.error(chalk.red(`Keypair file not found at ${keypairPath}`));
    process.exit(1);
  }

  // keypair should be the config authority on the squads
  const squadsMemberKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))),
  );

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.error(chalk.red('Please set RPC_URL in your environment.'));
    process.exit(1);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  console.log(chalk.cyan(`🌐 Connected to Solana RPC: ${rpcUrl}`));
  console.log(
    chalk.green('👤 Squads config authority public key:'),
    chalk.cyan(squadsMemberKeypair.publicKey.toBase58()),
  );

  // Squad multisig publickey
  let squadAddress: PublicKey;

  try {
    squadAddress = new PublicKey(process.argv[3]);
  } catch {
    throw new Error(
      `Invalid base58 encoded publickey provided as Squads multisig publickey`,
    );
  }

  const squadsRawAccountInfo = await connection.getAccountInfo(squadAddress);
  if (!squadsRawAccountInfo)
    throw new Error(
      `No squad multisig found for address ${squadAddress.toBase58()}`,
    );

  const squads =
    multisig.accounts.Multisig.fromAccountInfo(squadsRawAccountInfo)[0];

  // we use the same seeds for creating the squads mulitsig to create the swig
  const swigId = squads.createKey.toBytes();

  // we check if the keypair is a member on the squads multisig
  if (
    !squads.members.find(
      (member) =>
        member.key.toBase58() === squadsMemberKeypair.publicKey.toBase58(),
    )
  ) {
    throw new Error(
      `The provided keypair ${squadsMemberKeypair.publicKey.toBase58()} is not a member on the multisig.`,
    );
  }

  // we make sure we the config authority excluded from the members' list to eliminate duplicate when adding authorities
  const otherMembers = squads.members
    .map((s) => s.key)
    .filter(
      (key) => key.toBase58() !== squadsMemberKeypair.publicKey.toBase58(),
    );

  const swigAddress = findSwigPda(swigId);

  const createIxBuilder = getCreateSwigInstructionBuilder({
    payer: squadsMemberKeypair.publicKey,
    // we set the action of the config authority on swig to `All`
    // to grant it root access as it has on the multisig
    actions: Actions.set().all().get(),
    authorityInfo: createEd25519AuthorityInfo(squads.configAuthority),
    id: swigId,
    swigAddress,
    options: {},
  });

  // we include instructions for adding the other members as authorites on the swig
  otherMembers.forEach((authority) =>
    createIxBuilder.addAuthority(
      createEd25519AuthorityInfo(authority),
      // we limit the actions on these authorites,
      // these authorities can be updated as needed the config authority (root authority)
      Actions.set().programCurated().get(),
    ),
  );

  const createIxs = await createIxBuilder.getInstructions();

  const sig = await sendTransaction(connection, createIxs, squadsMemberKeypair);

  console.log(chalk.green('🎉 Swig creation successful!'));
  console.log(chalk.gray(`Signature: ${sig}`));

  const swig = await fetchSwig(connection, swigAddress);

  const swigWalletAddress = await getSwigWalletAddress(swig);

  console.log(
    chalk.green('swig wallet address:'),
    chalk.yellow(swigWalletAddress.toBase58()),
  );
}

main().catch((err) => {
  console.error(chalk.red('Fatal Error:'), err);
  process.exit(1);
});
