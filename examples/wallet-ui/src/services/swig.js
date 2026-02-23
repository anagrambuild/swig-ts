import { Buffer } from 'buffer';
import { Actions, createEd25519AuthorityInfo, fetchSwig, findSwigPda, getAddAuthorityInstructionContext, getCreateSwigInstruction, getRemoveAuthorityInstructionContext, getSwigFetchFn, Swig, } from '@swig-wallet/classic';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, } from '@solana/web3.js';
import { base64ToBytes, bytesToBase64, randomBytes } from '@/lib/bytes';
export function serializeSwigReference(id, address) {
    return {
        idBase64: bytesToBase64(id),
        address: address.toBase58(),
    };
}
export function deserializeSwigReference(serialized) {
    return {
        id: base64ToBytes(serialized.idBase64),
        address: new PublicKey(serialized.address),
    };
}
export async function createSwigWallet(args) {
    const id = args.id ?? randomBytes(32);
    const swigAddress = findSwigPda(id);
    const rootActions = Actions.set().all().get();
    const authorityInfo = createEd25519AuthorityInfo(args.payer.publicKey);
    const instruction = await getCreateSwigInstruction({
        payer: args.payer.publicKey,
        id,
        authorityInfo,
        actions: rootActions,
    });
    const tx = new Transaction().add(instruction);
    tx.feePayer = args.payer.publicKey;
    const signature = await sendAndConfirmTransaction(args.connection, tx, [args.payer]);
    const swig = await fetchSwig(args.connection, swigAddress);
    swig.setSwigFetchFn(getSwigFetchFn(args.connection));
    return {
        swig,
        swigAddress,
        swigId: id,
        signature,
        actions: rootActions,
    };
}
export async function refreshSwig(connection, reference) {
    const { address } = deserializeSwigReference(reference);
    const swig = await fetchSwig(connection, address);
    swig.setSwigFetchFn(getSwigFetchFn(connection));
    return swig;
}
export async function addAuthorityToSwig(args) {
    const context = await getAddAuthorityInstructionContext(args.swig, args.actingRoleId, createEd25519AuthorityInfo(args.authorityInfo), args.actions, { payer: args.payer.publicKey });
    const transaction = new Transaction({ feePayer: args.payer.publicKey });
    context
        .getWeb3Instructions()
        .map((ix) => new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.keys.map((meta) => ({
            pubkey: new PublicKey(meta.pubkey),
            isSigner: meta.isSigner,
            isWritable: meta.isWritable,
        })),
        data: Buffer.from(ix.data),
    }))
        .forEach((ix) => transaction.add(ix));
    const signature = await sendAndConfirmTransaction(args.connection, transaction, [args.payer]);
    await args.swig.refetch();
    return signature;
}
export async function removeAuthorityFromSwig(args) {
    const context = await getRemoveAuthorityInstructionContext(args.swig, args.actingRoleId, args.roleIdToRemove, { payer: args.payer.publicKey });
    const transaction = new Transaction({ feePayer: args.payer.publicKey });
    context
        .getWeb3Instructions()
        .map((ix) => new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.keys.map((meta) => ({
            pubkey: new PublicKey(meta.pubkey),
            isSigner: meta.isSigner,
            isWritable: meta.isWritable,
        })),
        data: Buffer.from(ix.data),
    }))
        .forEach((ix) => transaction.add(ix));
    const signature = await sendAndConfirmTransaction(args.connection, transaction, [args.payer]);
    await args.swig.refetch();
    return signature;
}
export function findRootRole(roles, owner) {
    if (!owner)
        return null;
    return (roles.find((role) => role.authority.matchesSigner(owner.toBytes())) ?? null);
}
