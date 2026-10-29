import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  createCloseAccountInstruction,
  createMint,
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  fetchSwig,
  findSwigSubAccountPda,
  getCreateSubAccountInstructions,
  getToggleSubAccountInstructions,
} from '@swig-wallet/classic';
import bs58 from 'bs58';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rpcUrl = process.env.SWIG_SURFPOOL_RPC_URL ?? 'http://127.0.0.1:18899';
const url = new URL(rpcUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('The Surfpool smoke test only accepts a local RPC URL');
}
const conn = new Connection(rpcUrl, {
  commitment: 'confirmed',
  wsEndpoint: `ws://${url.hostname}:${Number(url.port) + 1}`,
});
const version = await conn.getVersion();
if (!('surfnet-version' in version)) {
  throw new Error('RPC is not Surfpool');
}
if (process.env.SWIG_PROGRAM_SO) {
  const bytes = await readFile(process.env.SWIG_PROGRAM_SO);
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'surfnet_writeProgram',
      params: [
        'swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB',
        bytes.toString('hex'),
        0,
      ],
    }),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(
      `Could not load local Swig program: ${JSON.stringify(result.error)}`,
    );
  }
}

const client = new Client(
  { name: 'swig-surfpool-smoke', version: '1.0.0' },
  { versionNegotiation: { mode: { pin: '2026-07-28' } } },
);
await client.connect(
  new StdioClientTransport({
    command: 'node',
    args: [new URL('../dist/index.js', import.meta.url).pathname],
  }),
);
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  const value = result.content.find((item) => item.type === 'text')?.text;
  if (result.isError) throw new Error(`${name}: ${value}`);
  if (!value) throw new Error(`${name}: missing text result`);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
async function airdrop(pubkey, lamports) {
  const signature = await conn.requestAirdrop(pubkey, lamports);
  await conn.confirmTransaction(signature, 'confirmed');
}
async function useKeypair(keypair) {
  await call('configure_agent_keypair', {
    secretKeyJson: bs58.encode(keypair.secretKey),
  });
}
try {
  await call('configure_rpc', { rpcUrl, commitment: 'confirmed' });
  const root = Keypair.generate();
  await useKeypair(root);
  await airdrop(root.publicKey, 10_000_000_000);

  const reserved = await call('reserve_wallet_address', {});
  assert.equal(
    await conn.getAccountInfo(new PublicKey(reserved.configAddress)),
    null,
  );
  await airdrop(new PublicKey(reserved.walletAddress), 1_000_000);
  const activated = await call('activate_reserved_wallet', {
    packageHex: reserved.packageHex,
  });
  assert.equal(activated.configAddress, reserved.configAddress);
  const reservedWallet = await call('fetch_swig_wallet', {
    swigAccountAddress: reserved.configAddress,
  });
  assert.equal(reservedWallet.accountVersion, 'v2');
  assert.ok(
    (await conn.getBalance(new PublicKey(reserved.walletAddress))) >= 1_000_000,
  );
  console.log('reserved wallet activation passed');

  const created = await call('create_swig_wallet', {});
  const swigAddress = created.swigAccountAddress;
  const rentClaimer = Keypair.generate().publicKey;
  await call('set_rent_claimer', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    rentClaimer: rentClaimer.toBase58(),
  });
  const creator = Keypair.generate();
  await call('add_authority', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    newAuthorityPubkey: creator.publicKey.toBase58(),
    authorityType: 'ed25519',
    permissions: [{ type: 'subAccountV2Create' }],
  });
  const afterAdd = await call('fetch_swig_wallet', {
    swigAccountAddress: swigAddress,
  });
  const creatorRoleId = afterAdd.roles.at(-1).id;
  const denied = await client.callTool({
    name: 'create_v2_sub_account',
    arguments: { swigAccountAddress: swigAddress, signerRoleId: 0 },
  });
  assert.equal(denied.isError, true);
  const afterDenied = await call('fetch_swig_wallet', {
    swigAccountAddress: swigAddress,
  });
  assert.equal(afterDenied.subAccountV2Counter, 0);
  console.log('V2 create permission rejection passed');

  await useKeypair(creator);
  await airdrop(creator.publicKey, 3_000_000_000);
  const sub = await call('create_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
  });
  assert.equal(sub.subAccountId, 0);
  const fetchedSub = await call('fetch_v2_sub_account', {
    swigAccountAddress: swigAddress,
    subAccountId: sub.subAccountId,
  });
  assert.equal(fetchedSub.enabled, true);
  await airdrop(new PublicKey(sub.assetAddress), 500_000_000);
  const recipient = Keypair.generate().publicKey;
  await call('transfer_sol_from_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    recipientAddress: recipient.toBase58(),
    amountLamports: '1000000',
  });
  assert.equal(await conn.getBalance(recipient), 1_000_000);
  const customRecipient = Keypair.generate().publicKey;
  const inner = SystemProgram.transfer({
    fromPubkey: new PublicKey(sub.assetAddress),
    toPubkey: customRecipient,
    lamports: 2_000_000,
  });
  await call('transact_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    instructions: [
      {
        programId: inner.programId.toBase58(),
        accounts: inner.keys.map((key) => ({
          pubkey: key.pubkey.toBase58(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        dataHex: inner.data.toString('hex'),
      },
    ],
  });
  assert.equal(await conn.getBalance(customRecipient), 2_000_000);
  console.log('V2 sub-account signing passed');

  const mint = await createMint(conn, root, root.publicKey, null, 6);
  const sourceToken = await getOrCreateAssociatedTokenAccount(
    conn,
    root,
    mint,
    new PublicKey(sub.assetAddress),
    true,
  );
  const destinationToken = await getOrCreateAssociatedTokenAccount(
    conn,
    root,
    mint,
    new PublicKey(created.swigWalletAddress),
    true,
  );
  await mintTo(conn, root, mint, sourceToken.address, root, 1_000_000);
  await call('withdraw_token_from_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    sourceTokenAccount: sourceToken.address.toBase58(),
    destinationTokenAccount: destinationToken.address.toBase58(),
    amount: '500000',
  });
  assert.equal((await getAccount(conn, sourceToken.address)).amount, 500_000n);
  assert.equal(
    (await getAccount(conn, destinationToken.address)).amount,
    500_000n,
  );
  const sweep = createTransferInstruction(
    sourceToken.address,
    destinationToken.address,
    new PublicKey(sub.assetAddress),
    500_000,
  );
  const closeToken = createCloseAccountInstruction(
    sourceToken.address,
    new PublicKey(created.swigWalletAddress),
    new PublicKey(sub.assetAddress),
  );
  await call('transact_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    instructions: [sweep, closeToken].map((ix) => ({
      programId: ix.programId.toBase58(),
      accounts: ix.keys.map((key) => ({
        pubkey: key.pubkey.toBase58(),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      dataHex: ix.data.toString('hex'),
    })),
  });
  assert.equal(await conn.getAccountInfo(sourceToken.address), null);
  console.log('V2 token withdrawal and multi-instruction signing passed');

  await call('withdraw_sol_from_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    amountLamports: '1000000',
  });
  await call('toggle_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: creatorRoleId,
    subAccountId: sub.subAccountId,
    enabled: false,
  });
  assert.equal(
    (
      await call('fetch_v2_sub_account', {
        swigAccountAddress: swigAddress,
        subAccountId: sub.subAccountId,
      })
    ).enabled,
    false,
  );
  await useKeypair(root);
  await call('close_v2_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    subAccountId: sub.subAccountId,
  });
  const afterClose = await call('fetch_swig_wallet', {
    swigAccountAddress: swigAddress,
  });
  assert.equal(afterClose.activeSubAccountCount, 0);
  assert.equal(afterClose.subAccountV2Counter, 1);
  console.log('V2 sub-account close passed');

  const v1Authority = Keypair.generate();
  await airdrop(v1Authority.publicKey, 1_000_000_000);
  await call('add_authority', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    newAuthorityPubkey: v1Authority.publicKey.toBase58(),
    authorityType: 'ed25519',
    permissions: [{ type: 'subAccount' }],
  });
  let v1Parent = await fetchSwig(conn, new PublicKey(swigAddress));
  const v1RoleId = v1Parent.roles.at(-1).id;
  const v1Create = await getCreateSubAccountInstructions(v1Parent, v1RoleId);
  await sendAndConfirmTransaction(conn, new Transaction().add(...v1Create), [
    v1Authority,
  ]);
  v1Parent = await fetchSwig(conn, new PublicKey(swigAddress));
  const v1Toggle = await getToggleSubAccountInstructions(
    v1Parent,
    v1RoleId,
    false,
  );
  await sendAndConfirmTransaction(conn, new Transaction().add(...v1Toggle), [
    v1Authority,
  ]);
  const v1Child = findSwigSubAccountPda(Uint8Array.from(v1Parent.id), v1RoleId);
  await airdrop(v1Child, 1_000_000);
  await call('close_v1_sub_account', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    childRoleId: v1RoleId,
  });
  assert.equal(await conn.getBalance(v1Child), 0);
  console.log('V1 sub-account close passed');

  const rootToken = await getOrCreateAssociatedTokenAccount(
    conn,
    root,
    mint,
    root.publicKey,
  );
  const parentSweep = createTransferInstruction(
    destinationToken.address,
    rootToken.address,
    new PublicKey(created.swigWalletAddress),
    1_000_000,
  );
  await call('transact_custom', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    programId: parentSweep.programId.toBase58(),
    accounts: parentSweep.keys.map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: parentSweep.data.toString('hex'),
  });
  await call('close_swig_token_accounts', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
    tokenProgramId: TOKEN_PROGRAM_ID.toBase58(),
    tokenAccountAddresses: [destinationToken.address.toBase58()],
  });
  assert.equal(await conn.getAccountInfo(destinationToken.address), null);
  console.log('parent token account close passed');

  const walletInfo = await conn.getAccountInfo(
    new PublicKey(created.swigWalletAddress),
  );
  const walletExcess =
    (walletInfo?.lamports ?? 0) -
    (await conn.getMinimumBalanceForRentExemption(0));
  if (walletExcess > 0) {
    await call('transact_sol_transfer', {
      swigAccountAddress: swigAddress,
      signerRoleId: 0,
      recipientAddress: root.publicKey.toBase58(),
      amountLamports: String(walletExcess),
    });
  }
  await call('close_swig_wallet', {
    swigAccountAddress: swigAddress,
    signerRoleId: 0,
  });
  assert.ok((await conn.getBalance(rentClaimer)) > 0);
  assert.equal(
    (await conn.getAccountInfo(new PublicKey(swigAddress))).data[0],
    255,
  );
  console.log('parent wallet close passed');
} finally {
  await client.close();
}
