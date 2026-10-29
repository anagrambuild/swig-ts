import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
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
  AuthorityType,
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
import {
  createV2SubAccountInstruction,
  deriveV2SubAccountAddresses,
  replaceEd25519AuthorityInstruction,
  setRentClaimerInstruction,
  toggleV2SubAccountInstruction,
  withdrawSolFromV2SubAccountInstruction,
} from './protocol';

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

function permissionU32(perm: Record<string, unknown>, field: string): number {
  const value = perm[field];
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffffffff
  ) {
    throw new Error(`${field} must be a u32 number`);
  }
  return value;
}

function buildActions(
  permissions: Array<Record<string, unknown>>,
): ReturnType<typeof Actions.set> {
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
        throw new Error(
          'rentDestination is not a permission in the current Swig protocol',
        );
      case 'replaceAuthority':
        builder = builder.replaceAuthority({
          roleId: permissionU32(perm, 'roleId'),
        });
        break;
      case 'subAccountV2Create':
        builder = builder.subAccountV2Create();
        break;
      case 'subAccountV2All':
        builder = builder.subAccountV2All({
          subAccountId: permissionU32(perm, 'subAccountId'),
        });
        break;
      case 'subAccountV2Sign':
        builder = builder.subAccountV2Sign({
          subAccountId: permissionU32(perm, 'subAccountId'),
        });
        break;
      case 'subAccountV2Withdraw':
        builder = builder.subAccountV2Withdraw({
          subAccountId: permissionU32(perm, 'subAccountId'),
        });
        break;
      case 'subAccountV2Toggle':
        builder = builder.subAccountV2Toggle({
          subAccountId: permissionU32(perm, 'subAccountId'),
        });
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

  return builder;
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

  server.registerTool(
    'configure_rpc',
    {
      description:
        'Configure the Solana RPC endpoint. Call this before any other tool.',
      inputSchema: z.object({
        rpcUrl: z
          .string()
          .describe(
            'Solana RPC URL (e.g. https://api.devnet.solana.com, https://api.mainnet-beta.solana.com, or a custom RPC)',
          ),
        commitment: z
          .enum(['processed', 'confirmed', 'finalized'])
          .default('confirmed')
          .describe('Commitment level for transactions'),
      }),
    },
    async ({ rpcUrl, commitment }) => {
      const nextConnection = new Connection(rpcUrl, commitment);
      const version = await nextConnection.getVersion();
      connection = nextConnection;
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

  server.registerTool(
    'configure_paymaster',
    {
      description:
        'Configure Swig Paymaster for gasless transactions. Get credentials from dashboard.onswig.com.',
      inputSchema: z.object({
        apiKey: z
          .string()
          .describe('Paymaster API key from dashboard.onswig.com'),
        paymasterPubkey: z
          .string()
          .describe('Paymaster public key from dashboard.onswig.com'),
        network: z
          .enum(['mainnet', 'devnet'])
          .describe('Solana network to use'),
      }),
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

  server.registerTool(
    'configure_gas_sponsor',
    {
      description:
        'Configure a custom gas sponsorship server URL for fee-sponsored transactions.',
      inputSchema: z.object({
        sponsorUrl: z
          .string()
          .describe(
            'URL of the gas sponsorship server (e.g. https://myserver.com/api)',
          ),
      }),
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

  server.registerTool(
    'generate_agent_keypair',
    {
      description:
        'Generate a new Ed25519 keypair for the agent. Returns the public key. The user must fund this address with SOL before transactions can be sent.',
      inputSchema: z.object({
        saveToFile: z
          .string()
          .optional()
          .describe(
            'Optional file path to save the keypair JSON (e.g. agent-keypair.json)',
          ),
      }),
    },
    async ({ saveToFile }) => {
      const nextKeypair = Keypair.generate();
      const pubkey = nextKeypair.publicKey.toBase58();

      if (saveToFile) {
        const fs = await import('fs');
        fs.writeFileSync(
          saveToFile,
          JSON.stringify(Array.from(nextKeypair.secretKey)),
          { mode: 0o600, flag: 'wx' },
        );
      }

      agentKeypair = nextKeypair;

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

  server.registerTool(
    'configure_agent_keypair',
    {
      description:
        'Load an existing keypair for the agent from a JSON file or base58 secret key.',
      inputSchema: z.object({
        secretKeyJson: z
          .string()
          .optional()
          .describe(
            'Path to a keypair JSON file (array of numbers), or a base58-encoded secret key',
          ),
      }),
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

  server.registerTool(
    'get_balance',
    {
      description: 'Get the SOL balance of an address.',
      inputSchema: z.object({
        address: z
          .string()
          .optional()
          .describe(
            'Base58 public key to check. Defaults to the agent keypair if not provided.',
          ),
      }),
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

  server.registerTool(
    'create_swig_wallet',
    {
      description:
        'Create a new Swig smart wallet on Solana. Returns the Swig account address and wallet address.',
      inputSchema: z.object({
        ownerPubkey: z
          .string()
          .optional()
          .describe(
            'Base58 public key of the root authority. Defaults to the agent keypair.',
          ),
        permissions: z
          .array(z.record(z.string(), z.unknown()))
          .optional()
          .describe(
            'Array of permission objects for the root authority. Defaults to [{type:"all"}] (full control). Each object needs a "type" field and type-specific params.',
          ),
      }),
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

  server.registerTool(
    'fetch_swig_wallet',
    {
      description:
        'Fetch a Swig wallet and return its details including all roles/authorities.',
      inputSchema: z.object({
        swigAccountAddress: z
          .string()
          .describe('Base58 address of the Swig account'),
      }),
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
                subAccountV2Counter: swig.subAccountV2Counter(),
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

  server.registerTool(
    'add_authority',
    {
      description:
        'Add a new authority (keypair/key) to a Swig wallet with specific permissions.',
      inputSchema: z.object({
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
          .array(z.record(z.string(), z.unknown()))
          .describe(
            'Array of permission objects. Each needs a "type" field. Examples: [{type:"solLimit",amount:"100000000"}], [{type:"all"}], [{type:"programLimit",programId:"..."}]',
          ),
      }),
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

  server.registerTool(
    'remove_authority',
    {
      description: 'Remove an authority from a Swig wallet.',
      inputSchema: z.object({
        swigAccountAddress: z
          .string()
          .describe('Base58 address of the Swig account'),
        signerRoleId: z
          .number()
          .optional()
          .describe(
            'Role ID of the signing authority. Auto-detected if omitted.',
          ),
        roleIdToRemove: z
          .number()
          .describe('Role ID of the authority to remove'),
      }),
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

  server.registerTool(
    'update_authority',
    {
      description:
        'Update the permissions of an existing authority on a Swig wallet.',
      inputSchema: z.object({
        swigAccountAddress: z
          .string()
          .describe('Base58 address of the Swig account'),
        signerRoleId: z
          .number()
          .optional()
          .describe(
            'Role ID of the signing authority. Auto-detected if omitted.',
          ),
        roleIdToUpdate: z
          .number()
          .describe('Role ID of the authority to update'),
        updateKind: z
          .enum(['replaceAll', 'addActions', 'removeByType', 'removeByIndex'])
          .describe('How to update the permissions'),
        permissions: z
          .array(z.record(z.string(), z.unknown()))
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
          .describe(
            'Action indices to remove (for removeByIndex). E.g. [0, 2]',
          ),
      }),
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
            if (t === 'RentDestination') {
              throw new Error(
                'RentDestination is not a permission in the current Swig protocol',
              );
            }
            const val = Permission[t as keyof typeof Permission];
            if (typeof val !== 'number')
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

  server.registerTool(
    'replace_ed25519_authority',
    {
      description:
        'Replace the Ed25519 signer of an existing role without changing its permissions. The acting role needs All, ManageAuthority, or ReplaceAuthority scoped to the target role.',
      inputSchema: z.object({
        swigAccountAddress: z.string().describe('Base58 Swig config account'),
        signerRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Acting Ed25519 role ID'),
        targetRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Role whose signer will be replaced'),
        newSignerPubkey: z.string().describe('New Ed25519 public key'),
      }),
    },
    async ({
      swigAccountAddress,
      signerRoleId,
      targetRoleId,
      newSignerPubkey,
    }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swigAddress = new PublicKey(swigAccountAddress);
      const swig = await fetchSwig(conn, swigAddress);
      const actingRole = swig
        .findRolesByEd25519SignerPk(signer.publicKey)
        .find((role) => role.id === signerRoleId);
      if (!actingRole)
        throw new Error('Agent keypair does not match the acting Ed25519 role');
      const targetRole = swig.findRoleById(targetRoleId);
      if (!targetRole) throw new Error('Target role not found');
      if (targetRole.authorityType !== AuthorityType.Ed25519)
        throw new Error('Target role must be Ed25519');
      const ix = replaceEd25519AuthorityInstruction({
        swig: swigAddress,
        signer: signer.publicKey,
        actingRoleId: signerRoleId,
        targetRoleId,
        newSigner: new PublicKey(newSignerPubkey),
      });
      const signature = await sendTx(conn, [ix], [signer]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              signature,
              targetRoleId,
              newSignerPubkey,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'set_rent_claimer',
    {
      description:
        'Set the immutable rent claimer on a V2 Swig wallet. The acting Ed25519 role needs All or CloseSwigAuthority.',
      inputSchema: z.object({
        swigAccountAddress: z.string().describe('Base58 Swig config account'),
        signerRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Acting Ed25519 role ID'),
        rentClaimer: z
          .string()
          .describe('Base58 account that will receive reclaimed rent'),
      }),
    },
    async ({ swigAccountAddress, signerRoleId, rentClaimer }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swigAddress = new PublicKey(swigAccountAddress);
      const swig = await fetchSwig(conn, swigAddress);
      if (swig.accountVersion() !== 'v2')
        throw new Error('SetRentClaimerV1 requires a V2 Swig wallet');
      const actingRole = swig
        .findRolesByEd25519SignerPk(signer.publicKey)
        .find((role) => role.id === signerRoleId);
      if (!actingRole)
        throw new Error('Agent keypair does not match the acting Ed25519 role');
      const ix = setRentClaimerInstruction({
        swig: swigAddress,
        payer: signer.publicKey,
        signer: signer.publicKey,
        roleId: signerRoleId,
        rentClaimer: new PublicKey(rentClaimer),
      });
      const signature = await sendTx(conn, [ix], [signer]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, signature, rentClaimer }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'create_v2_sub_account',
    {
      description:
        'Create a V2 sub-account. The acting Ed25519 role needs SubAccountV2Create; All alone does not grant creation. The creator receives SubAccountV2All for the new ID.',
      inputSchema: z.object({
        swigAccountAddress: z.string().describe('Base58 Swig config account'),
        signerRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Acting Ed25519 role ID'),
      }),
    },
    async ({ swigAccountAddress, signerRoleId }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swigAddress = new PublicKey(swigAccountAddress);
      const swig = await fetchSwig(conn, swigAddress);
      if (swig.accountVersion() !== 'v2')
        throw new Error('V2 sub-accounts require a V2 Swig wallet');
      const actingRole = swig
        .findRolesByEd25519SignerPk(signer.publicKey)
        .find((role) => role.id === signerRoleId);
      if (!actingRole)
        throw new Error('Agent keypair does not match the acting Ed25519 role');
      const subAccountId = swig.subAccountV2Counter();
      if (subAccountId === null)
        throw new Error('V2 sub-account counter unavailable');
      const addresses = deriveV2SubAccountAddresses(swigAddress, subAccountId);
      const ix = createV2SubAccountInstruction({
        swig: swigAddress,
        payer: signer.publicKey,
        signer: signer.publicKey,
        roleId: signerRoleId,
        subAccountId,
      });
      const signature = await sendTx(conn, [ix], [signer]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              signature,
              subAccountId,
              stateAddress: addresses.state.toBase58(),
              assetAddress: addresses.asset.toBase58(),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'toggle_v2_sub_account',
    {
      description:
        'Enable or disable a V2 sub-account. The acting Ed25519 role needs SubAccountV2Toggle or SubAccountV2All scoped to this ID.',
      inputSchema: z.object({
        swigAccountAddress: z.string().describe('Base58 Swig config account'),
        signerRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Acting Ed25519 role ID'),
        subAccountId: z.number().int().min(0).describe('V2 sub-account ID'),
        enabled: z.boolean().describe('Desired enabled state'),
      }),
    },
    async ({ swigAccountAddress, signerRoleId, subAccountId, enabled }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swigAddress = new PublicKey(swigAccountAddress);
      const swig = await fetchSwig(conn, swigAddress);
      if (swig.accountVersion() !== 'v2')
        throw new Error('V2 sub-accounts require a V2 Swig wallet');
      const actingRole = swig
        .findRolesByEd25519SignerPk(signer.publicKey)
        .find((role) => role.id === signerRoleId);
      if (!actingRole)
        throw new Error('Agent keypair does not match the acting Ed25519 role');
      const ix = toggleV2SubAccountInstruction({
        swig: swigAddress,
        payer: signer.publicKey,
        signer: signer.publicKey,
        roleId: signerRoleId,
        subAccountId,
        enabled,
      });
      const signature = await sendTx(conn, [ix], [signer]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              signature,
              subAccountId,
              enabled,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'withdraw_sol_from_v2_sub_account',
    {
      description:
        'Withdraw SOL from one V2 sub-account into its parent Swig wallet address. The acting Ed25519 role needs SubAccountV2Withdraw or SubAccountV2All scoped to this ID.',
      inputSchema: z.object({
        swigAccountAddress: z.string().describe('Base58 Swig config account'),
        signerRoleId: z
          .number()
          .int()
          .min(0)
          .describe('Acting Ed25519 role ID'),
        subAccountId: z.number().int().min(0).describe('V2 sub-account ID'),
        amountLamports: z.string().describe('Unsigned SOL amount in lamports'),
      }),
    },
    async ({
      swigAccountAddress,
      signerRoleId,
      subAccountId,
      amountLamports,
    }) => {
      const conn = getConnection();
      const signer = getAgentKeypair();
      const swigAddress = new PublicKey(swigAccountAddress);
      const swig = await fetchSwig(conn, swigAddress);
      if (swig.accountVersion() !== 'v2')
        throw new Error('V2 sub-accounts require a V2 Swig wallet');
      const actingRole = swig
        .findRolesByEd25519SignerPk(signer.publicKey)
        .find((role) => role.id === signerRoleId);
      if (!actingRole)
        throw new Error('Agent keypair does not match the acting Ed25519 role');
      const ix = withdrawSolFromV2SubAccountInstruction({
        swig: swigAddress,
        payer: signer.publicKey,
        signer: signer.publicKey,
        swigWalletAddress: await getSwigWalletAddress(swig),
        roleId: signerRoleId,
        subAccountId,
        amountLamports: BigInt(amountLamports),
      });
      const signature = await sendTx(conn, [ix], [signer]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              signature,
              subAccountId,
              amountLamports,
            }),
          },
        ],
      };
    },
  );

  // ---- Transact (Sign inner instructions through Swig) ----

  server.registerTool(
    'transact_sol_transfer',
    {
      description: 'Transfer SOL from a Swig wallet to a recipient.',
      inputSchema: z.object({
        swigAccountAddress: z
          .string()
          .describe('Base58 address of the Swig account'),
        signerRoleId: z
          .number()
          .optional()
          .describe(
            'Role ID of the signing authority. Auto-detected if omitted.',
          ),
        recipientAddress: z
          .string()
          .describe('Base58 address of the recipient'),
        amountLamports: z
          .string()
          .describe(
            'Amount in lamports to transfer (as string for bigint safety)',
          ),
      }),
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

  server.registerTool(
    'transact_custom',
    {
      description:
        'Execute a custom instruction through the Swig wallet. The Swig wallet will be the signer for the inner instruction.',
      inputSchema: z.object({
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
              isSigner: z
                .boolean()
                .describe('Whether this account is a signer'),
              isWritable: z
                .boolean()
                .describe('Whether this account is writable'),
            }),
          )
          .describe('Account metas for the instruction'),
        data: z
          .string()
          .describe('Hex-encoded instruction data (e.g. "aabbccdd")'),
      }),
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

function createServer(): McpServer {
  const server = new McpServer({ name: 'swig-wallet', version: '1.0.0' });
  registerAllTools(server);
  return server;
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: 'stdio' as 'stdio' | 'http',
    port: parseInt(process.env.PORT ?? '', 10) || 3001,
    host: '127.0.0.1',
    apiKey: process.env.SWIG_MCP_API_KEY ?? (undefined as string | undefined),
    corsOrigin: process.env.SWIG_MCP_CORS_ORIGIN ?? '',
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
  --host <address>    HTTP bind address (default: 127.0.0.1)
  --api-key <key>     Bearer token (required when binding beyond loopback)
  --cors-origin <o>   Explicit browser origin allowed to call the server
  --help, -h          Show this help

Environment Variables:
  PORT                HTTP port (overridden by --port)
  SWIG_MCP_API_KEY    API key for Bearer token auth (overridden by --api-key)
  SWIG_MCP_CORS_ORIGIN  Browser origin allowed to call the server

Remote MCP Server Usage:
  Users add the server URL to their MCP client config:

  Claude Code:   claude mcp add swig-wallet --transport http https://your-host.com/mcp
  Cursor:        Add URL https://your-host.com/mcp in Settings > MCP Servers
  Generic:       Use https://your-host.com/mcp as a Streamable HTTP endpoint
`);
        process.exit(0);
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

async function startStdio() {
  serveStdio(createServer);
}

async function startHttp(config: ReturnType<typeof parseArgs>) {
  const http = await import('node:http');
  const { timingSafeEqual } = await import('node:crypto');
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(config.host);
  if (!isLoopback && !config.apiKey) {
    throw new Error(
      'SWIG_MCP_API_KEY or --api-key is required for remote HTTP',
    );
  }
  const handler = createMcpHandler(createServer, { responseMode: 'json' });
  const nodeHandler = toNodeHandler(handler);
  const validateLocalHost = localhostHostValidation();
  const validateLocalOrigin = localhostOriginValidation();

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      );
      if (isLoopback && !validateLocalHost(req, res)) {
        return;
      }
      if (isLoopback && !config.corsOrigin && !validateLocalOrigin(req, res)) {
        return;
      }
      if (req.headers.origin && req.headers.origin !== config.corsOrigin) {
        res.writeHead(403).end();
        return;
      }
      if (config.corsOrigin && req.headers.origin === config.corsOrigin) {
        res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res
          .writeHead(204, {
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers':
              'Content-Type, Accept, Authorization, MCP-Protocol-Version',
          })
          .end();
        return;
      }
      if (config.apiKey) {
        const supplied = req.headers.authorization;
        const expected = Buffer.from(`Bearer ${config.apiKey}`);
        const actual = Buffer.from(supplied ?? '');
        if (
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)
        ) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'swig-wallet-mcp' }));
        return;
      }
      if (url.pathname === '/mcp') {
        await nodeHandler(req, res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. MCP endpoint is at /mcp' }));
    } catch (error) {
      console.error('MCP HTTP request failed:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  httpServer.listen(config.port, config.host, () => {
    console.log(`Swig Wallet MCP Server (Streamable HTTP)`);
    console.log(`  Endpoint: http://${config.host}:${config.port}/mcp`);
    console.log(`  Health:   http://${config.host}:${config.port}/health`);
    console.log(
      `  Auth:     ${config.apiKey ? 'Bearer token required' : 'Loopback only'}`,
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
