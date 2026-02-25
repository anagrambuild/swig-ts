import { Connection, LAMPORTS_PER_SOL, PublicKey, } from '@solana/web3.js';
export async function requestAirdropAndConfirm({ connection, recipient, solAmount, commitment = 'confirmed', }) {
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const signature = await connection.requestAirdrop(recipient, lamports);
    await connection.confirmTransaction(signature, commitment);
    return signature;
}
export async function fetchLamportBalance(connection, address, commitment = 'confirmed') {
    return connection.getBalance(address, { commitment });
}
function stringifyError(err) {
    if (!err)
        return null;
    if (typeof err === 'string')
        return err;
    if (typeof err === 'object' && 'InstructionError' in err) {
        return JSON.stringify(err);
    }
    return String(err);
}
function normalizeKey(input) {
    if (!input)
        return null;
    if (typeof input === 'string')
        return input;
    if (input instanceof PublicKey)
        return input.toBase58();
    if (typeof input.toBase58 === 'function')
        return input.toBase58();
    if (typeof input.toString === 'function')
        return input.toString();
    return null;
}
function extractAccountKeys(tx) {
    const message = tx.transaction?.message;
    const meta = tx.meta;
    const keys = new Set();
    const pushKey = (value) => {
        const key = normalizeKey(value);
        if (key)
            keys.add(key);
    };
    if (message) {
        if (Array.isArray(message.accountKeys)) {
            message.accountKeys.forEach(pushKey);
        }
        else {
            if (Array.isArray(message.staticAccountKeys)) {
                message.staticAccountKeys.forEach(pushKey);
            }
            if (typeof message.getAccountKeys === 'function') {
                const resolved = message.getAccountKeys({
                    accountKeysFromLookups: meta?.loadedAddresses,
                });
                if (resolved) {
                    if (Array.isArray(resolved.staticAccountKeys)) {
                        resolved.staticAccountKeys.forEach(pushKey);
                    }
                    if (Array.isArray(resolved.accountKeys)) {
                        resolved.accountKeys.forEach(pushKey);
                    }
                }
            }
        }
    }
    if (meta?.loadedAddresses) {
        meta.loadedAddresses.writable?.forEach(pushKey);
        meta.loadedAddresses.readonly?.forEach(pushKey);
    }
    return Array.from(keys);
}
export async function fetchTransactionHistory(connection, address, limit = 20) {
    const signatureInfos = await connection.getSignaturesForAddress(address, {
        limit,
    });
    const addressBase58 = address.toBase58();
    const transactions = await Promise.all(signatureInfos.map(async (info) => {
        const response = await connection.getTransaction(info.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        let change = null;
        if (response?.meta) {
            const keys = extractAccountKeys(response);
            const index = keys.findIndex((key) => key === addressBase58);
            if (index !== -1) {
                const pre = response.meta.preBalances?.[index];
                const post = response.meta.postBalances?.[index];
                if (typeof pre === 'number' && typeof post === 'number') {
                    change = BigInt(post) - BigInt(pre);
                }
            }
        }
        return {
            signature: info.signature,
            slot: info.slot,
            blockTime: info.blockTime ?? null,
            memo: info.memo ?? null,
            err: stringifyError(info.err),
            change,
        };
    }));
    return transactions;
}
export function lamportsToSol(lamports) {
    const amount = typeof lamports === 'bigint' ? Number(lamports) : lamports;
    return amount / LAMPORTS_PER_SOL;
}
