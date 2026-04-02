import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// StreamableHTTP and node:http are imported dynamically in startHttp() to
// avoid bundle issues with node builtins in ESM output.
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { Role } from '@swig-wallet/classic';
import {
  Actions,
  Permission,
  createEd25519AuthorityInfo,
  createEd25519SessionAuthorityInfo,
  createSecp256k1AuthorityInfo,
  createSecp256r1AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getRemoveAuthorityInstructions,
  getSignInstructions,
  getSwigWalletAddress,
  getUpdateAuthorityInstructions,
  updateAuthorityAddActions,
  updateAuthorityRemoveByIndex,
  updateAuthorityRemoveByType,
  updateAuthorityReplaceAllActions,
} from '@swig-wallet/classic';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let connection: Connection | null = null;
let agentKeypair: Keypair | null = null;
let paymasterConfig: {
  apiKey: string;
  pubkey: string;
  network: 'mainnet' | 'devnet';
} | null = null;
let gasSponsorUrl: string | null = null;

function getConnection(): Connection {
  if (!connection) {
    throw new Error('Solana RPC not configured. Call configure_rpc first.');
  }
  return connection;
}

function getAgentKeypair(): Keypair {
  if (!agentKeypair) {
    throw new Error(
      'Agent keypair not loaded. Call configure_agent_keypair or generate_agent_keypair first.',
    );
  }
  return agentKeypair;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildActions(
  permissions: Array<Record<string, unknown>>,
): ReturnType<typeof Actions.set> extends infer B ? B : never {
  let builder = Actions.set();

  for (const perm of permissions) {
    const type = perm.type as string;
    switch (type) {
      case 'all':
        builder = builder.all();
        break;
      case 'manageAuthority':
        builder = builder.manageAuthority();
        break;
      case 'allButManageAuthority':
        builder = builder.allButManageAuthority();
        break;
      case 'closeSwigAuthority':
        builder = builder.closeSwigAuthority();
        break;
      case 'rentDestination':
        builder = builder.rentDestination();
        break;
      case 'solLimit':
        builder = builder.solLimit({ amount: BigInt(perm.amount as string) });
        break;
      case 'solRecurringLimit':
        builder = builder.solRecurringLimit({
          recurringAmount: BigInt(perm.recurringAmount as string),
          window: BigInt(perm.window as string),
        });
        break;
      case 'solDestinationLimit':
        builder = builder.solDestinationLimit({
          amount: BigInt(perm.amount as string),
          destination: new PublicKey(perm.destination as string),
        });
        break;
      case 'tokenLimit':
        builder = builder.tokenLimit({
          mint: new PublicKey(perm.mint as string),
          amount: BigInt(perm.amount as string),
        });
        break;
      case 'tokenRecurringLimit':
        builder = builder.tokenRecurringLimit({
          mint: new PublicKey(perm.mint as string),
          recurringAmount: BigInt(perm.recurringAmount as string),
          window: BigInt(perm.window as string),
        });
        break;
      case 'programLimit':
        builder = builder.programLimit({
          programId: new PublicKey(perm.programId as string),
        });
        break;
      case 'programAll':
        builder = builder.programAll();
        break;
      case 'programCurated':
        builder = builder.programCurated();
        break;
      case 'subAccount':
        builder = builder.subAccount();
        break;
      case 'stakeAll':
        builder = builder.stakeAll();
        break;
      case 'stakeLimit':
        builder = builder.stakeLimit({
          amount: BigInt(perm.amount as string),
        });
        break;
      default:
        throw new Error(`Unknown permission type: ${type}`);
    }
  }

  return builder as any;
}

function serializeRole(role: Role) {
  return {
    id: role.id,
    authorityType: role.authorityType,
    isRoot: role.actions.isRoot(),
    canManageAuthority: role.actions.canManageAuthority(),
    canSpendSolMax: role.actions.canSpendSolMax(),
    solSpendLimit: role.actions.solSpendLimit()?.toString() ?? null,
    hasProgramAction: role.actions.hasProgramAction(),
  };
}

async function sendTx(
  conn: Connection,
  ixs: InstanceType<typeof Transaction>['instructions'],
  signers: Keypair[],
): Promise<string> {
  const tx = new Transaction().add(...ixs);

  // If we have a paymaster, use it
  if (paymasterConfig) {
    try {
      const { createPaymasterClient } =
        await import('@swig-wallet/paymaster-classic');
      const paymaster = createPaymasterClient({
        apiKey: paymasterConfig.apiKey,
        paymasterPubkey: paymasterConfig.pubkey,
        baseUrl: 'https://api.onswig.com',
        network: paymasterConfig.network,
      });
      const paymasterTx = await paymaster.createLegacyTransaction(ixs, signers);
      const signature = await paymaster.signAndSend(paymasterTx);
      return signature;
    } catch (e) {
      throw new Error(`Paymaster transaction failed: ${e}`);
    }
  }

  // If we have a gas sponsor URL, send there
  if (gasSponsorUrl) {
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.feePayer = signers[0].publicKey;
    for (const signer of signers) {
      tx.partialSign(signer);
    }
    const serialized = tx.serialize({ requireAllSignatures: false });
    const response = await fetch(`${gasSponsorUrl}/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: Buffer.from(serialized).toString('base64'),
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Gas sponsor returned ${response.status}: ${await response.text()}`,
      );
    }
    const { signature } = (await response.json()) as { signature: string };
    return signature;
  }

  // Self-funded
  const signature = await sendAndConfirmTransaction(conn, tx, signers, {
    commitment: 'confirmed',
  });
  return signature;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

function registerAllTools(server: McpServer) {
  // ---- Configuration Tools ----

  server.tool(
    'configure_rpc',
    'Configure the Solana RPC endpoint. Call this before any other tool.',
    {
      rpcUrl: z
        .string()
        .describe(
          'Solana RPC URL (e.g. https://api.devnet.solana.com, https://api.mainnet-beta.solana.com, or a custom RPC)',
        ),
      commitment: z
        .enum(['processed', 'confirmed', 'finalized'])
        .default('confirmed')
        .describe('Commitment level for transactions'),
    },
    async ({ rpcUrl, commitment }) => {
      connection = new Connection(rpcUrl, commitment);
      const version = await connection.getVersion();
      return {
        content: [
          {
            type: 'text' as const,
            text: `Connected to Solana RPC at ${rpcUrl} (version: ${JSON.stringify(version)}, commitment: ${commitment})`,
          },
        ],
      };
    },
  );

  server.tool(
    'configure_paymaster',
    'Configure Swig Paymaster for gasless transactions. Get credentials from dashboard.onswig.com.',
    {
      apiKey: z
        .string()
        .describe('Paymaster API key from dashboard.onswig.com'),
      paymasterPubkey: z
        .string()
        .describe('Paymaster public key from dashboard.onswig.com'),
      network: z.enum(['mainnet', 'devnet']).describe('Solana network to use'),
    },
    async ({ apiKey, paymasterPubkey, network }) => {
      paymasterConfig = { apiKey, pubkey: paymasterPubkey, network };
      gasSponsorUrl = null;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Paymaster configured for ${network}. Transactions will be gasless via Swig Paymaster (pubkey: ${paymasterPubkey}).`,
          },
        ],
      };
    },
  );

  server.tool(
    'configure_gas_sponsor',
    'Configure a custom gas sponsorship server URL for fee-sponsored transactions.',
    {
      sponsorUrl: z
        .string()
        .describe(
          'URL of the gas sponsorship server (e.g. https://myserver.com/api)',
        ),
    },
    async ({ sponsorUrl }) => {
      gasSponsorUrl = sponsorUrl;
      paymasterConfig = null;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Gas sponsor configured at ${sponsorUrl}. Transactions will be sent there for fee sponsorship.`,
          },
        ],
      };
    },
  );

  server.tool(
    'generate_agent_keypair',
    'Generate a new Ed25519 keypair for the agent. Returns the public key. The user must fund this address with SOL before transactions can be sent.',
    {
      saveToFile: z
        .string()
        .optional()
        .describe(
          'Optional file path to save the keypair JSON (e.g. agent-keypair.json)',
        ),
    },
    async ({ saveToFile }) => {
      agentKeypair = Keypair.generate();
      const pubkey = agentKeypair.publicKey.toBase58();

      if (saveToFile) {
        const fs = await import('fs');
        fs.writeFileSync(
          saveToFile,
          JSON.stringify(Array.from(agentKeypair.secretKey)),
        );
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Agent keypair generated.\nPublic key: ${pubkey}\n${saveToFile ? `Saved to: ${saveToFile}\n` : ''}Please fund this address with at least 0.01 SOL before proceeding.`,
          },
        ],
      };
    },
  );

  server.tool(
    'configure_agent_keypair',
    'Load an existing keypair for the agent from a JSON file or base58 secret key.',
    {
      secretKeyJson: z
        .string()
        .optional()
        .describe(
          'Path to a keypair JSON file (array of numbers), or a base58-encoded secret key',
        ),
    },
    async ({ secretKeyJson }) => {
      if (!secretKeyJson) {
        throw new Error(
          'Provide either a keypair file path or base58 secret key.',
        );
      }

      try {
        // Try as file path first
        const fs = await import('fs');
        if (fs.existsSync(secretKeyJson)) {
          const data = JSON.parse(fs.readFileSync(secretKeyJson, 'utf-8'));
          agentKeypair = Keypair.fromSecretKey(new Uint8Array(data));
        } else {
          // Try as base58
          const bs58 = await import('bs58');
          agentKeypair = Keypair.fromSecretKey(
            bs58.default.decode(secretKeyJson),
          );
        }
      } catch {
        throw new Error(
          'Failed to load keypair. Provide a valid JSON file path or base58 secret key.',
        );
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Agent keypair loaded. Public key: ${agentKeypair.publicKey.toBase58()}`,
          },
        ],
      };
    },
  );

  server.tool(
    'get_balance',
    'Get the SOL balance of an address.',
    {
      address: z
        .string()
        .optional()
        .describe(
          'Base58 public key to check. Defaults to the agent keypair if not provided.',
        ),
    },
    async ({ address }) => {
      const conn = getConnection();
      const pubkey = address
        ? new PublicKey(address)
        : getAgentKeypair().publicKey;
      const balance = await conn.getBalance(pubkey);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Balance of ${pubkey.toBase58()}: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`,
          },
        ],
      };
    },
  );

  // ---- Wallet Creation ----

  server.tool(
    'create_swig_wallet',
    'Create a new Swig smart wallet on Solana. Returns the Swig account address and wallet address.',
    {
      ownerPubkey: z
        .string()
        .optional()
        .describe(
          'Base58 public key of the root authority. Defaults to the agent keypair.',
        ),
      permissions: z
        .array(z.record(z.unknown()))
        .optional()
        .describe(
          'Array of permission objects for the root authority. Defaults to [{type:"all"}] (full control). Each object needs a "type" field and type-specific params.',
        ),
    },
    async ({ ownerPubkey, permissions }) => {
      const conn = getConnection();
      const payer = getAgentKeypair();
      const ownerPk = ownerPubkey
        ? new PublicKey(ownerPubkey)
        : payer.publicKey;

      const id = new Uint8Array(32);
      crypto.getRandomValues(id);

      const swigAccountAddress = findSwigPda(id);
      const rootAuthorityInfo = createEd25519AuthorityInfo(ownerPk);

      const perms = permissions ?? [{ type: 'all' }];
      const rootActions = buildActions(perms).get();

      const createSwigIx = await getCreateSwigInstruction({
        payer: payer.publicKey,
        id,
        actions: rootActions,
        authorityInfo: rootAuthorityInfo,
      });

      const signature = await sendTx(conn, [createSwigIx], [payer]);

      const swig = await fetchSwig(conn, swigAccountAddress);
      const walletAddress = await getSwigWalletAddress(swig);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                swigAccountAddress: swigAccountAddress.toBase58(),
                swigWalletAddress: walletAddress.toBase58(),
                ownerPubkey: ownerPk.toBase58(),
                signature,
                swigId: Buffer.from(id).toString('hex'),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ---- Fetch Wallet ----

  server.tool(
    'fetch_swig_wallet',
    'Fetch a Swig wallet and return its details including all roles/authorities.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
    },
    async ({ swigAccountAddress }) => {
      const conn = getConnection();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));
      const walletAddress = await getSwigWalletAddress(swig);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                swigAccountAddress,
                swigWalletAddress: walletAddress.toBase58(),
                accountVersion: swig.accountVersion(),
                rolesCount: swig.roles.length,
                roles: swig.roles.map(serializeRole),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ---- Add Authority ----

  server.tool(
    'add_authority',
    'Add a new authority (keypair/key) to a Swig wallet with specific permissions.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
      signerRoleId: z
        .number()
        .optional()
        .describe(
          'Role ID of the signing authority (must have manageAuthority permission). Auto-detected if omitted.',
        ),
      newAuthorityPubkey: z
        .string()
        .describe(
          'Authority public key. Use Base58 for ed25519/ed25519Session, hex-encoded SEC1 public key for secp256k1, and compressed hex-encoded P-256 public key for secp256r1.',
        ),
      authorityType: z
        .enum(['ed25519', 'ed25519Session', 'secp256k1', 'secp256r1'])
        .default('ed25519')
        .describe('Type of authority to add'),
      maxSessionDuration: z
        .string()
        .optional()
        .describe(
          'Max session duration in slots (only for session-based authority types)',
        ),
      permissions: z
        .array(z.record(z.unknown()))
        .describe(
          'Array of permission objects. Each needs a "type" field. Examples: [{type:"solLimit",amount:"100000000"}], [{type:"all"}], [{type:"programLimit",programId:"..."}]',
        ),
    },
    async ({
      swigAccountAddress,
      signerRoleId,
      newAuthorityPubkey,
      authorityType,
      maxSessionDuration,
      permissions,
    }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));

      // Find the signing role
      let roleId: number;
      if (signerRoleId !== undefined) {
        roleId = signerRoleId;
      } else {
        const roles = swig.findRolesByEd25519SignerPk(signer.publicKey);
        const managingRole = roles.find((r) => r.actions.canManageAuthority());
        if (!managingRole) {
          throw new Error(
            'No role found with manageAuthority permission for the agent keypair. Provide signerRoleId explicitly.',
          );
        }
        roleId = managingRole.id;
      }

      // Build authority info
      let authorityInfo;
      switch (authorityType) {
        case 'ed25519':
          authorityInfo = createEd25519AuthorityInfo(
            new PublicKey(newAuthorityPubkey),
          );
          break;
        case 'ed25519Session':
          authorityInfo = createEd25519SessionAuthorityInfo(
            new PublicKey(newAuthorityPubkey),
            BigInt(maxSessionDuration ?? '216000'),
          );
          break;
        case 'secp256k1':
          authorityInfo = createSecp256k1AuthorityInfo(newAuthorityPubkey);
          break;
        case 'secp256r1':
          authorityInfo = createSecp256r1AuthorityInfo(newAuthorityPubkey);
          break;
      }

      const actions = buildActions(permissions).get();

      const ixs = await getAddAuthorityInstructions(
        swig,
        roleId,
        authorityInfo,
        actions,
      );

      const signature = await sendTx(conn, ixs, [signer]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                signature,
                newAuthorityPubkey,
                authorityType,
                permissions,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ---- Remove Authority ----

  server.tool(
    'remove_authority',
    'Remove an authority from a Swig wallet.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
      signerRoleId: z
        .number()
        .optional()
        .describe(
          'Role ID of the signing authority. Auto-detected if omitted.',
        ),
      roleIdToRemove: z.number().describe('Role ID of the authority to remove'),
    },
    async ({ swigAccountAddress, signerRoleId, roleIdToRemove }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));

      let roleId: number;
      if (signerRoleId !== undefined) {
        roleId = signerRoleId;
      } else {
        const roles = swig.findRolesByEd25519SignerPk(signer.publicKey);
        const managingRole = roles.find((r) => r.actions.canManageAuthority());
        if (!managingRole) {
          throw new Error(
            'No role with manageAuthority permission found for agent keypair.',
          );
        }
        roleId = managingRole.id;
      }

      const ixs = await getRemoveAuthorityInstructions(
        swig,
        roleId,
        roleIdToRemove,
      );

      const signature = await sendTx(conn, ixs, [signer]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { success: true, signature, removedRoleId: roleIdToRemove },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ---- Update Authority ----

  server.tool(
    'update_authority',
    'Update the permissions of an existing authority on a Swig wallet.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
      signerRoleId: z
        .number()
        .optional()
        .describe(
          'Role ID of the signing authority. Auto-detected if omitted.',
        ),
      roleIdToUpdate: z.number().describe('Role ID of the authority to update'),
      updateKind: z
        .enum(['replaceAll', 'addActions', 'removeByType', 'removeByIndex'])
        .describe('How to update the permissions'),
      permissions: z
        .array(z.record(z.unknown()))
        .optional()
        .describe(
          'Permission objects for replaceAll or addActions update kinds.',
        ),
      removeTypes: z
        .array(z.string())
        .optional()
        .describe(
          'Permission type names to remove (for removeByType). E.g. ["SolLimit", "TokenLimit"]',
        ),
      removeIndices: z
        .array(z.number())
        .optional()
        .describe('Action indices to remove (for removeByIndex). E.g. [0, 2]'),
    },
    async ({
      swigAccountAddress,
      signerRoleId,
      roleIdToUpdate,
      updateKind,
      permissions,
      removeTypes,
      removeIndices,
    }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));

      let roleId: number;
      if (signerRoleId !== undefined) {
        roleId = signerRoleId;
      } else {
        const roles = swig.findRolesByEd25519SignerPk(signer.publicKey);
        const managingRole = roles.find((r) => r.actions.canManageAuthority());
        if (!managingRole) {
          throw new Error(
            'No role with manageAuthority permission found for agent keypair.',
          );
        }
        roleId = managingRole.id;
      }

      let updateInfo;
      switch (updateKind) {
        case 'replaceAll':
          if (!permissions)
            throw new Error('permissions required for replaceAll');
          updateInfo = updateAuthorityReplaceAllActions(
            buildActions(permissions).get(),
          );
          break;
        case 'addActions':
          if (!permissions)
            throw new Error('permissions required for addActions');
          updateInfo = updateAuthorityAddActions(
            buildActions(permissions).get(),
          );
          break;
        case 'removeByType': {
          if (!removeTypes) throw new Error('removeTypes required');
          const permissionEnums = removeTypes.map((t) => {
            const val = Permission[t as keyof typeof Permission];
            if (val === undefined)
              throw new Error(`Unknown permission type: ${t}`);
            return val;
          });
          updateInfo = updateAuthorityRemoveByType(permissionEnums);
          break;
        }
        case 'removeByIndex':
          if (!removeIndices) throw new Error('removeIndices required');
          updateInfo = updateAuthorityRemoveByIndex(removeIndices);
          break;
      }

      const ixs = await getUpdateAuthorityInstructions(
        swig,
        roleId,
        roleIdToUpdate,
        updateInfo,
      );

      const signature = await sendTx(conn, ixs, [signer]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                signature,
                updatedRoleId: roleIdToUpdate,
                updateKind,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ---- Transact (Sign inner instructions through Swig) ----

  server.tool(
    'transact_sol_transfer',
    'Transfer SOL from a Swig wallet to a recipient.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
      signerRoleId: z
        .number()
        .optional()
        .describe(
          'Role ID of the signing authority. Auto-detected if omitted.',
        ),
      recipientAddress: z.string().describe('Base58 address of the recipient'),
      amountLamports: z
        .string()
        .describe(
          'Amount in lamports to transfer (as string for bigint safety)',
        ),
    },
    async ({
      swigAccountAddress,
      signerRoleId,
      recipientAddress,
      amountLamports,
    }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));
      const walletAddress = await getSwigWalletAddress(swig);

      let roleId: number;
      if (signerRoleId !== undefined) {
        roleId = signerRoleId;
      } else {
        const roles = swig.findRolesByEd25519SignerPk(signer.publicKey);
        if (roles.length === 0) {
          throw new Error(
            'No role found for agent keypair on this Swig wallet.',
          );
        }
        // Prefer a role that can spend SOL
        const spendingRole =
          roles.find((r) => r.actions.canSpendSol(BigInt(amountLamports))) ??
          roles.find((r) => r.actions.canSpendSolMax()) ??
          roles[0];
        roleId = spendingRole.id;
      }

      const transferIx = SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: new PublicKey(recipientAddress),
        lamports: BigInt(amountLamports),
      });

      const signedIxs = await getSignInstructions(swig, roleId, [transferIx]);
      const signature = await sendTx(conn, signedIxs, [signer]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                signature,
                from: walletAddress.toBase58(),
                to: recipientAddress,
                amountLamports,
                amountSol: Number(BigInt(amountLamports)) / LAMPORTS_PER_SOL,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'transact_custom',
    'Execute a custom instruction through the Swig wallet. The Swig wallet will be the signer for the inner instruction.',
    {
      swigAccountAddress: z
        .string()
        .describe('Base58 address of the Swig account'),
      signerRoleId: z
        .number()
        .optional()
        .describe(
          'Role ID of the signing authority. Auto-detected if omitted.',
        ),
      programId: z.string().describe('Base58 program ID to call'),
      accounts: z
        .array(
          z.object({
            pubkey: z.string().describe('Base58 public key'),
            isSigner: z.boolean().describe('Whether this account is a signer'),
            isWritable: z
              .boolean()
              .describe('Whether this account is writable'),
          }),
        )
        .describe('Account metas for the instruction'),
      data: z
        .string()
        .describe('Hex-encoded instruction data (e.g. "aabbccdd")'),
    },
    async ({ swigAccountAddress, signerRoleId, programId, accounts, data }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swig = await fetchSwig(conn, new PublicKey(swigAccountAddress));

      let roleId: number;
      if (signerRoleId !== undefined) {
        roleId = signerRoleId;
      } else {
        const roles = swig.findRolesByEd25519SignerPk(signer.publicKey);
        if (roles.length === 0) {
          throw new Error(
            'No role found for agent keypair on this Swig wallet.',
          );
        }
        roleId = roles[0].id;
      }

      const { TransactionInstruction } = await import('@solana/web3.js');
      const ix = new TransactionInstruction({
        programId: new PublicKey(programId),
        keys: accounts.map((a) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })),
        data: Buffer.from(data, 'hex'),
      });

      const signedIxs = await getSignInstructions(swig, roleId, [ix]);
      const signature = await sendTx(conn, signedIxs, [signer]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { success: true, signature, programId },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
} // end registerAllTools

// Create the default server instance (used by stdio mode)
const server = new McpServer({
  name: 'swig-wallet',
  version: '1.0.0',
});
registerAllTools(server);

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: 'stdio' as 'stdio' | 'http',
    port: 3001,
    host: '0.0.0.0',
    apiKey: process.env.SWIG_MCP_API_KEY ?? (undefined as string | undefined),
    corsOrigin: '*',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--http':
        config.mode = 'http';
        break;
      case '--port':
        config.port = parseInt(args[++i], 10);
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--cors-origin':
        config.corsOrigin = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Swig Wallet MCP Server

Usage:
  swig-mcp-server              Start in stdio mode (default, for local use)
  swig-mcp-server --http       Start as HTTP server (for remote access)

Options:
  --http              Run as Streamable HTTP server instead of stdio
  --port <number>     HTTP port (default: 3001, or PORT env var)
  --host <address>    HTTP bind address (default: 0.0.0.0)
  --api-key <key>     Require Bearer token auth (or set SWIG_MCP_API_KEY env var)
  --cors-origin <o>   CORS allowed origin (default: *)
  --help, -h          Show this help

Environment Variables:
  PORT                HTTP port (overridden by --port)
  SWIG_MCP_API_KEY    API key for Bearer token auth (overridden by --api-key)

Remote MCP Server Usage:
  Users add the server URL to their MCP client config:

  Claude Code:   claude mcp add swig-wallet --transport http https://your-host.com/mcp
  Cursor:        Add URL https://your-host.com/mcp in Settings > MCP Servers
  Generic:       POST/GET to https://your-host.com/mcp (Streamable HTTP transport)
`);
        process.exit(0);
    }
  }

  // PORT env fallback
  if (config.mode === 'http' && process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10) || config.port;
  }

  return config;
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

async function startStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp(config: ReturnType<typeof parseArgs>) {
  const http = await import('node:http');
  const crypto = await import('node:crypto');
  const { StreamableHTTPServerTransport } =
    await import('@modelcontextprotocol/sdk/server/streamableHttp.js');

  // Per-session transport map for stateful sessions
  const sessions = new Map<
    string,
    InstanceType<typeof StreamableHTTPServerTransport>
  >();

  const httpServer = http.createServer(
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      );

      // --- CORS preflight ---
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': config.corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      // --- CORS headers for all responses ---
      res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

      // --- Auth check ---
      if (config.apiKey) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${config.apiKey}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Unauthorized. Provide a valid Bearer token.',
            }),
          );
          return;
        }
      }

      // --- Health check ---
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            server: 'swig-wallet-mcp',
            sessions: sessions.size,
          }),
        );
        return;
      }

      // --- MCP endpoint ---
      if (url.pathname === '/mcp') {
        // Check for existing session
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (sessionId && sessions.has(sessionId)) {
          // Route to existing session transport
          const transport = sessions.get(sessionId)!;
          await transport.handleRequest(req, res);
          return;
        }

        // For new sessions (initialization) or stateless requests
        if (req.method === 'POST') {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              sessions.delete(transport.sessionId);
            }
          };

          // Connect a fresh McpServer instance for this session.
          // Note: The tool registrations are on the module-level `server` object.
          // For a multi-session HTTP server, we re-use the same McpServer and
          // connect each transport to it. However, the McpServer high-level API
          // only supports one transport at a time. For multi-session, we need to
          // create a new McpServer per session that shares the same tool defs.
          const sessionServer = new McpServer({
            name: 'swig-wallet',
            version: '1.0.0',
          });

          // Re-register all tools on the session server
          registerAllTools(sessionServer);

          await sessionServer.connect(transport);

          if (transport.sessionId) {
            sessions.set(transport.sessionId, transport);
          }

          await transport.handleRequest(req, res);
          return;
        }

        if (req.method === 'GET') {
          // GET without session = 400 (need to initialize first)
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'No session. Send a POST with InitializeRequest first.',
            }),
          );
          return;
        }

        if (req.method === 'DELETE') {
          if (sessionId && sessions.has(sessionId)) {
            const transport = sessions.get(sessionId)!;
            await transport.close();
            sessions.delete(sessionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'session_terminated' }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
          }
          return;
        }
      }

      // --- 404 for everything else ---
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. MCP endpoint is at /mcp' }));
    },
  );

  httpServer.listen(config.port, config.host, () => {
    console.log(`Swig Wallet MCP Server (Streamable HTTP)`);
    console.log(`  Endpoint: http://${config.host}:${config.port}/mcp`);
    console.log(`  Health:   http://${config.host}:${config.port}/health`);
    console.log(
      `  Auth:     ${config.apiKey ? 'Bearer token required' : 'None (open access)'}`,
    );
    console.log(`  CORS:     ${config.corsOrigin}`);
    console.log('');
    console.log('Add as remote MCP server:');
    console.log(
      `  claude mcp add swig-wallet --transport http http://${config.host}:${config.port}/mcp`,
    );
  });
}

async function main() {
  const config = parseArgs();

  if (config.mode === 'http') {
    await startHttp(config);
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
