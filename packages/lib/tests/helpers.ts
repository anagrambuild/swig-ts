import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  address,
  getAddressCodec,
  getAddressDecoder,
  getAddressEncoder,
  type Address,
  type IAccountMeta,
} from '@solana/kit';
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from 'litesvm';
import {
  SolPublicKey,
  SwigInstructionContext,
  type KitInstruction,
  type SigningFn,
  type SolPublicKeyData,
  type Web3Instruction,
} from '../src';
import type { TestAuthority } from './fixtures/authorities';

// ============================================================================
// Address/PublicKey Conversion Utilities
// ============================================================================

/**
 * Convert an @solana/kit Address to a web3.js PublicKey for LiteSVM
 */
export function addressToLiteSvmPublicKey(addr: Address): PublicKey {
  return new PublicKey(getAddressEncoder().encode(addr));
}

/**
 * Convert SolPublicKeyData to @solana/kit Address
 */
export function toAddress(data: SolPublicKeyData): Address {
  if (typeof data === 'string') {
    return data as Address;
  }
  if (data instanceof Uint8Array || Array.isArray(data)) {
    return getAddressDecoder().decode(new Uint8Array(data));
  }
  // SolPublicKey instance
  return address((data as any).toBase58());
}

/**
 * Convert SolPublicKeyData to web3.js PublicKey for LiteSVM
 */
export function toPublicKey(solPublicKeyData: SolPublicKeyData): PublicKey {
  const publicKeyBytes = new SolPublicKey(solPublicKeyData).toBytes();
  return new PublicKey(publicKeyBytes);
}

// ============================================================================
// Test Keypair - Bridges @solana/kit KeyPairSigner with web3.js Keypair
// ============================================================================

/**
 * TestKeypair wraps both kit and web3.js key types for LiteSVM testing.
 * Use .address for kit-style access, internal web3.js keypair for LiteSVM signing.
 */
export interface TestKeypair {
  /** The address as @solana/kit Address type */
  address: Address;
  /** The public key bytes */
  publicKey: PublicKey;
  /** Internal web3.js keypair for LiteSVM signing */
  _keypair: Keypair;
}

/**
 * Generate a test keypair that works with both kit types and LiteSVM
 */
export function generateTestKeypair(): TestKeypair {
  const keypair = Keypair.generate();
  return {
    address: getAddressDecoder().decode(keypair.publicKey.toBytes()),
    publicKey: keypair.publicKey,
    _keypair: keypair,
  };
}

// ============================================================================
// Byte Utilities
// ============================================================================

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => {
    const passed = value === b[index];
    if (!passed)
      console.log('❌ not passed.', 'index:', index, 'value:', value);
    return passed;
  });
}

// ============================================================================
// Mock Data Generators
// ============================================================================

export function mockPublicKey(byte: number) {
  return new PublicKey(Uint8Array.from(Array(32).fill(byte)));
}

export function mockAddress(byte: number): Address {
  return getAddressCodec().decode(Uint8Array.from(Array(32).fill(byte)));
}

export function mockBytesArray(byte: number, length: number) {
  return Uint8Array.from(Array(length).fill(byte));
}

// ============================================================================
// Transaction Helpers
// ============================================================================

export function sendSwigSVMTransaction(
  svm: LiteSVM,
  swigIxCtx: SwigInstructionContext,
  payer: TestKeypair,
  signers: TestKeypair[] = [],
) {
  return sendSVMTransaction(
    svm,
    getInstructionsFromContext(swigIxCtx),
    payer,
    signers,
  );
}

export function sendSVMTransaction(
  svm: LiteSVM,
  instructions: TransactionInstruction[],
  payer: TestKeypair,
  signers: TestKeypair[] = [],
) {
  const transaction = new Transaction();
  transaction.instructions = instructions;
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = svm.latestBlockhash();

  transaction.sign(payer._keypair, ...signers.map((s) => s._keypair));

  const tx = svm.sendTransaction(transaction);

  if (tx instanceof FailedTransactionMetadata) {
    console.log('tx:', tx.meta().logs());
    throw new Error(tx.err().toString());
  }

  if (tx instanceof TransactionMetadata) {
    // console.log("tx:", tx.logs())
  }
}

export function randomBytes(length: number): Uint8Array {
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  return randomArray;
}

/**
 * Generate a random Address for test purposes (e.g., recipient, program ID)
 */
export function randomAddress(): Address {
  return generateTestKeypair().address;
}

/**
 * Generate a random PublicKey bytes for test purposes
 */
export function randomPublicKeyBytes(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

export function getInstructionsFromContext(
  swigContext: SwigInstructionContext,
): TransactionInstruction[] {
  return swigContext
    .getWeb3Instructions()
    .map(getTransactionInstructionFromWeb3Instruction);
}

function getTransactionInstructionFromWeb3Instruction(
  ix: Web3Instruction,
): TransactionInstruction {
  return {
    programId: new PublicKey(ix.programId.toBytes()),
    keys: ix.keys.map((meta) => ({
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
      pubkey: new PublicKey(meta.pubkey.toBytes()),
    })),
    data: Buffer.from(ix.data),
  };
}

// ============================================================================
// Authority Test Helpers
// ============================================================================

/**
 * Get signing options for an authority test fixture.
 * Returns the appropriate signingFn for Secp authorities or null for Ed25519.
 */
export function getSigningOptions(
  authority: TestAuthority,
  payer: TestKeypair,
  currentSlot: bigint,
): { payer: Address; currentSlot: bigint; signingFn?: SigningFn } {
  const options: {
    payer: Address;
    currentSlot: bigint;
    signingFn?: SigningFn;
  } = {
    payer: payer.address,
    currentSlot,
  };

  if (authority.signingFn) {
    options.signingFn = authority.signingFn;
  }

  return options;
}

/**
 * Get the signers array for a transaction based on authority type.
 * Ed25519 authorities need their keypair in signers, Secp authorities don't.
 */
export function getAuthoritySigners(authority: TestAuthority): TestKeypair[] {
  if (authority.signer) {
    return [authority.signer];
  }
  return [];
}

/**
 * Helper to check if transaction execution should fail
 */
export function expectTransactionToFail(
  svm: LiteSVM,
  swigIxCtx: SwigInstructionContext,
  payer: TestKeypair,
  signers: TestKeypair[] = [],
): void {
  expect(() =>
    sendSwigSVMTransaction(svm, swigIxCtx, payer, signers),
  ).toThrow();
}

/**
 * Helper to check if transaction execution should succeed
 */
export function expectTransactionToSucceed(
  svm: LiteSVM,
  swigIxCtx: SwigInstructionContext,
  payer: TestKeypair,
  signers: TestKeypair[] = [],
): void {
  expect(() =>
    sendSwigSVMTransaction(svm, swigIxCtx, payer, signers),
  ).not.toThrow();
}

// ============================================================================
// SOL Transfer Instruction Helper
// ============================================================================

/**
 * Creates a SOL transfer instruction using Address types instead of TransactionSigner.
 * This is needed because Swig signs on behalf of the wallet address, not a traditional signer.
 *
 * Unlike getTransferSolInstruction from @solana-program/system which expects TransactionSigner,
 * this helper builds the instruction manually with Address types.
 */
export function getTransferSolInstruction(args: {
  source: Address;
  destination: Address;
  amount: bigint;
}): KitInstruction<IAccountMeta[], Uint8Array> {
  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      { address: args.source, role: AccountRole.WRITABLE_SIGNER },
      { address: args.destination, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array(
      getTransferSolInstructionDataEncoder().encode({ amount: args.amount }),
    ),
  };
}
