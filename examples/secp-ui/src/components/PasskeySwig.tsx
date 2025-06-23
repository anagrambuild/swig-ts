import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useRequestAirdrop, useSwigAddres, useSwigBalance } from '@/hooks';
import {
  useClearPasskey,
  useCreatePasskey,
  useCreateSwigWithPasskey,
  usePasskeyCredential,
  usePasskeySupport,
  useSwigTransferWithPasskey,
} from '@/hooks/passkey';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AuthorityType } from '@swig-wallet/classic';
import { useState } from 'react';

export function PasskeySwig() {
  const { isSupported } = usePasskeySupport();
  const { credential, hasCredential } = usePasskeyCredential();
  const { createPasskey, isPending: isCreatingPasskey } = useCreatePasskey();
  const { clearPasskey, isPending: isClearingPasskey } = useClearPasskey();
  const { createSwigWithPasskey, isPending: isCreatingSwig } =
    useCreateSwigWithPasskey();
  const {
    transferWithPasskey,
    isPending: isTransferring,
    swig,
  } = useSwigTransferWithPasskey();
  const { requestAirdropAsync } = useRequestAirdrop();
  const { swigBalance } = useSwigBalance();
  const { swigAddress } = useSwigAddres();

  const [username, setUsername] = useState('');

  const lamports = swigBalance ?? 0;
  const sol = (lamports / LAMPORTS_PER_SOL).toFixed(2);

  // Check if the current passkey has an authority in the Swig wallet
  const hasMatchingAuthority =
    swig && credential
      ? swig.roles.some((role) => {
          //   console.log({ role });
          if (role.authority.type === AuthorityType.Secp256r1) {
            const authorityData = role.authority.data;
            if (authorityData.length >= 33) {
              const authorityPublicKey = authorityData.slice(0, 33);
              return authorityPublicKey.every(
                (byte: number, index: number) =>
                  byte === credential.publicKey[index],
              );
            }
          }
          return false;
        })
      : false;

  if (!isSupported) {
    return (
      <Card className="max-w-3xl w-full">
        <CardHeader>
          <CardDescription className="text-red-600">
            Passkeys are not supported in this browser. Please use a modern
            browser with WebAuthn support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl w-full">
      <CardHeader>
        <h2 className="text-xl font-semibold">Passkey-Based Swig Wallet</h2>
        <CardDescription>
          Swig Address: {swigAddress?.toBase58() || '...'}
        </CardDescription>
        {credential && (
          <CardDescription className="text-sm text-green-600">
            Passkey ID: {credential.id.slice(0, 16)}...
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="text-6xl text-primary">
          {sol} <span className="text-xl">SOL</span>
        </CardDescription>
        <CardDescription>Swig Balance: {lamports} lamports</CardDescription>

        {swig && (
          <CardDescription className="text-sm">
            Wallet Status:{' '}
            {hasMatchingAuthority
              ? '✅ Passkey has authority'
              : '❌ Passkey not authorized'}
          </CardDescription>
        )}
      </CardContent>

      <CardFooter className="flex flex-col space-y-4">
        {!hasCredential ? (
          <div className="flex flex-col space-y-2 w-full">
            <input
              type="text"
              placeholder="Username (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
            <Button
              onClick={() => createPasskey(username || undefined)}
              disabled={isCreatingPasskey}
              className="w-full"
            >
              {isCreatingPasskey ? 'Creating Passkey...' : 'Create Passkey'}
            </Button>
          </div>
        ) : (
          <div className="items-center w-full space-x-4">
            <Button
              variant="destructive"
              onClick={() => clearPasskey()}
              disabled={isClearingPasskey}
            >
              {isClearingPasskey ? 'Clearing...' : 'Clear Passkey'}
            </Button>

            {!swig ? (
              <Button
                onClick={() => createSwigWithPasskey()}
                disabled={isCreatingSwig}
              >
                {isCreatingSwig ? 'Creating...' : 'Create Swig Wallet'}
              </Button>
            ) : (
              <Button onClick={() => requestAirdropAsync()} variant="outline">
                Request Airdrop
              </Button>
            )}

            <Button
              onClick={() => transferWithPasskey()}
              disabled={hasMatchingAuthority && isTransferring}
            >
              {isTransferring ? 'Transferring...' : 'Transfer 0.1 SOL'}
            </Button>
          </div>
        )}

        <CardDescription className="text-xs text-gray-500 text-center">
          {!hasCredential
            ? 'Create a passkey to get started with secure authentication'
            : hasMatchingAuthority
              ? 'Ready to sign transactions with your passkey!'
              : 'Create a Swig wallet or add this passkey as an authority'}
        </CardDescription>
      </CardFooter>
    </Card>
  );
}
