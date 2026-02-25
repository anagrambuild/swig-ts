import { Keypair } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { base64ToBytes, bytesToBase64 } from '@/lib/bytes';
const EMBEDDED_SECRET_KEY = 'swig-wallet/embedded-secret';
export function useEmbeddedKeypair() {
    const [storedSecret, setStoredSecret] = useLocalStorage(EMBEDDED_SECRET_KEY, () => null);
    const [keypair, setKeypair] = useState(null);
    useEffect(() => {
        if (keypair)
            return;
        if (storedSecret) {
            try {
                const existing = Keypair.fromSecretKey(base64ToBytes(storedSecret));
                setKeypair(existing);
                return;
            }
            catch (error) {
                console.warn('Failed to restore embedded keypair. Regenerating.', error);
            }
        }
        const generated = Keypair.generate();
        setKeypair(generated);
        setStoredSecret(bytesToBase64(generated.secretKey));
    }, [keypair, setStoredSecret, storedSecret]);
    const regenerate = useCallback(() => {
        const generated = Keypair.generate();
        setKeypair(generated);
        setStoredSecret(bytesToBase64(generated.secretKey));
        return generated;
    }, [setStoredSecret]);
    const secretBase64 = useMemo(() => (keypair ? bytesToBase64(keypair.secretKey) : null), [keypair]);
    return {
        keypair,
        regenerate,
        secretBase64,
        publicKey: keypair?.publicKey,
        publicKeyBase58: keypair?.publicKey.toBase58() ?? null,
    };
}
