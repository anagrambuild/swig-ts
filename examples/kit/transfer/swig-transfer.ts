import {
  AccountRole,
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressDecoder,
  getSignatureFromTransaction,
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
import { ed25519 } from '@noble/curves/ed25519';
import {
  Connection,
  Keypair,
  Transaction,
  Message,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';

import bs58 from 'bs58';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
} from '@swig-wallet/kit';
import {
  SYSTEM_PROGRAM_ADDRESS,
  getTransferSolInstructionDataEncoder,
} from '@solana-program/system';

// ---------- Hardcoded Keys ----------
// Root authority private key (base58 string)
const ROOT_AUTHORITY_PRIVATE_KEY = 'qkNXrY312tzUJmcudnFJQih9yZ9e2a3ECAFgViimnVUj6TU7uj7Emo21yavtjCskV3kKQhonRm5bw5p9nzB7DvU';

// New authority private key (base58 string) - used to derive public key
const NEW_AUTHORITY_PRIVATE_KEY = '3Ne7XZ8ZrMAASw71KjWqb2jAy3otB35jEggsXA6uWn3H7HdNewWnmfJjqHqfLEb9AGdUAsGTg4sxepDK7KbaCDzH';

// Sponsored fee payer public key (base58 string)
const SPONSORED_FEE_PAYER_PUBLIC_KEY = 'FCfKAFQbDTFLPFr5QNAM6jjtL4SoJcw1HGcA171oUVWw';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}


// ---------- main ----------
console.log('starting...');

const connection = {
  rpc: createSolanaRpc('http://api.devnet.solana.com'),
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://api.devnet.solana.com'),
};

// Create web3.js Connection for sending transactions
const web3Connection = new Connection('http://api.devnet.solana.com', 'confirmed');

// Create root authority keypair from private key
const rootKeypairBytes = bs58.decode(ROOT_AUTHORITY_PRIVATE_KEY);
const rootKeypair = Keypair.fromSecretKey(rootKeypairBytes);
const rootAuthorityPublicKey = rootKeypair.publicKey;
console.log('Root authority address:', rootAuthorityPublicKey.toBase58());

// Derive new authority public key from private key
const newAuthorityKeyBytes = bs58.decode(NEW_AUTHORITY_PRIVATE_KEY);
const newAuthoritySecretKey = newAuthorityKeyBytes.slice(0, 32);
const newAuthorityPublicKeyBytes = ed25519.getPublicKey(newAuthoritySecretKey);
const newAuthorityPublicKey = new PublicKey(newAuthorityPublicKeyBytes);
console.log('New authority address:', newAuthorityPublicKey.toBase58());

// Sponsored fee payer public key
const sponsoredFeePayerPublicKey = new PublicKey(SPONSORED_FEE_PAYER_PUBLIC_KEY);
console.log('Sponsored fee payer address:', sponsoredFeePayerPublicKey.toBase58());

// Create SWIG wallet
const id = randomBytes(32);
const swigAccountAddress = await findSwigPda(id);
console.log('SWIG address:', swigAccountAddress.toString());

// Create SWIG (using web3.js Transaction for simplicity)
const rootActions = Actions.set().all().get();
const createSwigIx = await getCreateSwigInstruction({
  payer: rootAuthorityPublicKey.toBase58() as Address,
  actions: rootActions,
  authorityInfo: createEd25519AuthorityInfo(rootAuthorityPublicKey.toBase58() as Address),
  id,
});

// Build web3.js Transaction to create SWIG
console.log('Creating SWIG...');
const { blockhash: createSwigBlockhash } = await web3Connection.getLatestBlockhash();
const createSwigTx = new Transaction();
createSwigTx.feePayer = rootAuthorityPublicKey;
createSwigTx.recentBlockhash = createSwigBlockhash;

// Convert @solana/kit instruction to web3.js TransactionInstruction
createSwigTx.add({
  programId: new PublicKey(createSwigIx.programAddress.toString()),
  keys: createSwigIx.accounts.map((acc: any) => {
    const address = typeof acc.address === 'string' 
      ? acc.address 
      : acc.address.toString();
    const role = acc.role;
    const isSigner = role === AccountRole.WRITABLE_SIGNER || 
                     role === AccountRole.READONLY_SIGNER;
    const isWritable = role === AccountRole.WRITABLE_SIGNER || 
                       role === AccountRole.WRITABLE;
    return {
      pubkey: new PublicKey(address),
      isSigner,
      isWritable,
    };
  }),
  data: Buffer.from(createSwigIx.data),
});

// Sign and send
createSwigTx.sign(rootKeypair);
const createSwigSig = await web3Connection.sendRawTransaction(createSwigTx.serialize());
await web3Connection.confirmTransaction(createSwigSig, 'confirmed');
console.log('SWIG created. Transaction:', createSwigSig);

// Fetch SWIG
const swig = await fetchSwig(connection.rpc, swigAccountAddress);
const swigWalletAddress = await getSwigWalletAddress(swig);
console.log('SWIG wallet address:', swigWalletAddress.toString());

// Find root role
const rootRole = swig.findRolesByEd25519SignerPk(rootAuthorityPublicKey.toBase58() as Address)[0];
if (!rootRole) {
  throw new Error('Root role not found.');
}

// Prepare instructions to add new authority
const newAuthorityActions = Actions.set().all().get();
const addAuthorityIxs = await getAddAuthorityInstructions(
  swig,
  rootRole.id,
  createEd25519AuthorityInfo(newAuthorityPublicKey.toBase58() as Address),
  newAuthorityActions,
  { payer: sponsoredFeePayerPublicKey.toBase58() as Address },
);

// Create an instruction to transfer 0.1 SOL from sponsored fee payer to root authority
const transferIx = {
  programAddress: SYSTEM_PROGRAM_ADDRESS,
  accounts: [
    { address: sponsoredFeePayerPublicKey.toBase58() as Address, role: AccountRole.WRITABLE_SIGNER },
    { address: rootAuthorityPublicKey.toBase58() as Address, role: AccountRole.WRITABLE },
  ],
  data: new Uint8Array(
    getTransferSolInstructionDataEncoder().encode({ amount: 100_000_000n }),
  ),
} satisfies IInstruction;

// Add the transfer instruction to the existing instruction set
// addAuthorityIxs.push(transferIx);

// Get latest blockhash
const { value: blockhash } = await connection.rpc.getLatestBlockhash().send();

// Create transaction message
const txMsg = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(
    { address: sponsoredFeePayerPublicKey.toBase58() as Address } as KeyPairSigner,
    tx,
  ),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
  (tx) => appendTransactionMessageInstructions(addAuthorityIxs, tx),
);

const web3Tx = new Transaction();
web3Tx.feePayer = sponsoredFeePayerPublicKey;
web3Tx.recentBlockhash = blockhash.blockhash;

// Convert @solana/kit instructions to web3.js TransactionInstruction format
for (const ix of addAuthorityIxs) {
  web3Tx.add({
    programId: new PublicKey(ix.programAddress.toString()),
    keys: ix.accounts.map((acc: any) => {
      const address = typeof acc.address === 'string' 
        ? acc.address 
        : acc.address.toString();
      const role = acc.role;
      
      // AccountRole is an enum with values like WRITABLE_SIGNER, WRITABLE, etc.
      const isSigner = role === AccountRole.WRITABLE_SIGNER || 
                       role === AccountRole.READONLY_SIGNER;
      const isWritable = role === AccountRole.WRITABLE_SIGNER || 
                         role === AccountRole.WRITABLE;
      
      return {
        pubkey: new PublicKey(address),
        isSigner,
        isWritable,
      };
    }),
    data: Buffer.from(ix.data),
  });
}

// Get message bytes for signing (following Solana Cookbook pattern)
const realDataNeedToSign = web3Tx.serializeMessage();

// Sign the message with root authority (following Solana Cookbook pattern)
const rootSignature = ed25519.sign(realDataNeedToSign, rootKeypair.secretKey.slice(0, 32));

// Recover transaction with partial signature (Solana Cookbook pattern)
const partiallySignedTx = Transaction.populate(Message.from(realDataNeedToSign));
partiallySignedTx.addSignature(rootAuthorityPublicKey, Buffer.from(rootSignature));

// Serialize partially signed transaction
const serializedTx = partiallySignedTx.serialize({
  requireAllSignatures: false, // Allow partial signatures
  verifySignatures: false,
});

// Encode to base58
const base58Transaction = bs58.encode(serializedTx);

console.log('\n=== Partially Signed Transaction (Base58) ===');
console.log(base58Transaction);
console.log('\nTransaction is partially signed by root authority.');
console.log('Fee payer signature must be added separately.');
console.log('\nTo complete signing later:');
console.log('  const tx = Transaction.populate(Message.from(decodeBase58(base58Tx)));');
console.log('  tx.addSignature(feePayerPublicKey, feePayerSignature);');
console.log('  const completed = tx.serialize();');
