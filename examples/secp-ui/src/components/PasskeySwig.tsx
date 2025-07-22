import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { PasskeyManager } from '@/helpers/passkey';
import { payerKeypair } from '@/helpers/solana';
import { useRequestAirdrop, useSwigAddres, useSwigBalance } from '@/hooks';
import {
  useClearPasskey,
  useCreatePasskey,
  useCreateSwigWithPasskey,
  usePasskeyCredential,
  usePasskeySupport,
  useSwigTransferWithPasskey,
} from '@/hooks/passkey';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { AuthorityType, getSignInstructions, Role } from '@swig-wallet/classic';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoToExplorer } from './GoToExplorer';

// Interface for storing previous signature data
interface StoredSignatureData {
  signature: Uint8Array;
  prefix: Uint8Array;
  message: Uint8Array;
  authority: any;
  timestamp: number;
}

export function PasskeySwig() {
  const { isSupported } = usePasskeySupport();
  const { credential, hasCredential } = usePasskeyCredential();
  const { createPasskey, isPending: isCreatingPasskey } = useCreatePasskey();
  const { clearPasskey, isPending: isClearingPasskey } = useClearPasskey();
  const { createSwigWithPasskey, isPending: isCreatingSwig } =
    useCreateSwigWithPasskey();
  const {
    isPending: isTransferring,
    swig,
    transferWithPasskeyAsync,
  } = useSwigTransferWithPasskey();
  const { requestAirdropAsync } = useRequestAirdrop();
  const { swigBalance } = useSwigBalance();
  const { swigAddress } = useSwigAddres();
  const { connection } = useConnection();

  const [username, setUsername] = useState('');
  const [storedSignature, setStoredSignature] =
    useState<StoredSignatureData | null>(null);
  const [isReplayTransferring, setIsReplayTransferring] = useState(false);

  // Modified transfer function that stores signature data
  const transferAndStoreSignature = async () => {
    if (!credential) {
      throw new Error('No passkey credential found');
    }

    if (!swig) {
      throw new Error('Swig wallet not found. Please create one first.');
    }

    // Find the secp256r1 authority role
    await swig.refetch();
    let signerRole: any | undefined;

    // Look for secp256r1 authorities that match our passkey public key
    for (const role of swig.roles) {
      if (role.authority.type === AuthorityType.Secp256r1) {
        const authorityData = role.authority.data;
        if (authorityData.length >= 33) {
          const authorityPublicKey = authorityData.slice(0, 33);

          if (
            authorityPublicKey.length === credential.publicKey.length &&
            authorityPublicKey.every(
              (byte: number, index: number) =>
                byte === credential.publicKey[index],
            )
          ) {
            signerRole = role;
            break;
          }
        }
      }
    }

    if (!signerRole) {
      throw new Error('No matching secp256r1 authority found for this passkey');
    }

    let capturedSignatureData: StoredSignatureData | null = null;

    const ixs = await getSignInstructions(
      swig,
      signerRole.id,
      [
        SystemProgram.transfer({
          lamports: 0.1 * LAMPORTS_PER_SOL,
          fromPubkey: swigAddress!,
          toPubkey: Keypair.generate().publicKey,
        }),
      ],
      false,
      {
        payer: payerKeypair.publicKey,
        currentSlot: BigInt(await connection.getSlot()),
        signingFn: async (message: Uint8Array) => {
          // Sign with passkey (this will trigger browser authentication)
          const signingResult = await PasskeyManager.signWithPasskey(message);

          // Store the signature data for potential replay
          capturedSignatureData = {
            signature: signingResult.signature,
            prefix: signingResult.prefix!,
            message: signingResult.message!,
            authority: signerRole.authority,
            timestamp: Date.now(),
          };

          return signingResult;
        },
      },
    );

    const transaction = new Transaction({
      feePayer: payerKeypair.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).add(...ixs);

    const tx = await sendAndConfirmTransaction(connection, transaction, [
      payerKeypair,
    ]);

    // Store the captured signature data
    if (capturedSignatureData) {
      setStoredSignature(capturedSignatureData);
      toast.success('Signature data captured for replay test!');
    }

    return tx;
  };

  // Replay transfer function that reuses stored signature data
  const replayTransfer = async () => {
    if (!storedSignature) {
      toast.error('No stored signature data found. Complete a transfer first.');
      return;
    }

    if (!swig) {
      throw new Error('Swig wallet not found.');
    }

    setIsReplayTransferring(true);

    try {
      // IMPORTANT: Refetch the swig state to get the updated authority with current counter
      await swig.refetch();

      let currentRole: Role | undefined;

      // Look for secp256r1 authorities that match our passkey public key
      for (const signerRole of swig.roles) {
        if (signerRole.authority.type === AuthorityType.Secp256r1) {
          // For secp256r1, we need to check if the public key matches
          // The authority data should contain the 33-byte compressed public key
          const authorityData = signerRole.authority.data;
          if (authorityData.length >= 33) {
            const authorityPublicKey = authorityData.slice(0, 33);

            // Compare public keys (both should be 33-byte compressed format)
            if (
              authorityPublicKey.length === credential!.publicKey.length &&
              authorityPublicKey.every(
                (byte: number, index: number) =>
                  byte === credential!.publicKey[index],
              )
            ) {
              currentRole = signerRole;
              break;
            }
          }
        }
      }

      if (!currentRole) {
        throw new Error(
          'No matching secp256r1 authority found for this passkey',
        );
      }

      console.log(
        'Stored authority counter:',
        storedSignature.authority.odometer?.(),
      );
      console.log(
        'Current authority counter:',
        (currentRole.authority as any).odometer?.(),
      );

      const ixs = await getSignInstructions(
        swig,
        currentRole.id,
        [
          SystemProgram.transfer({
            lamports: 0.1 * LAMPORTS_PER_SOL,
            fromPubkey: swigAddress!,
            toPubkey: Keypair.generate().publicKey,
          }),
        ],
        false,
        {
          payer: payerKeypair.publicKey,
          currentSlot: BigInt(await connection.getSlot()),
          signingFn: async (message: Uint8Array) => {
            console.log('Attempting replay with stored signature data...');
            console.log('New message:', Array.from(message));
            console.log('Stored message:', Array.from(storedSignature.message));
            //  console.log('Expected counter (from current authority):', counter);
            console.log(
              'Stored signature prefix length:',
              storedSignature.prefix?.length || 0,
            );
            console.log(
              'Stored signature prefix (first 50 bytes):',
              storedSignature.prefix
                ? Array.from(storedSignature.prefix.slice(0, 50))
                : 'NO PREFIX',
            );

            // Return the OLD signature data (this should fail due to counter verification)
            return {
              signature: storedSignature.signature,
              prefix: storedSignature.prefix,
              message: storedSignature.message,
            };
          },
        },
      );

      const transaction = new Transaction({
        feePayer: payerKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).add(...ixs);

      const tx = await sendAndConfirmTransaction(connection, transaction, [
        payerKeypair,
      ]);

      // If we get here, the replay attack succeeded (which would be bad!)
      toast.error('🚨 SECURITY ISSUE: Signature replay attack succeeded!', {
        action: <GoToExplorer tx={tx} />,
        className: 'w-max',
      });
    } catch (error: any) {
      // This is the expected behavior - the replay should fail
      console.log('Replay attack failed (as expected):', error);

      if (error.message?.includes('0xbca') || error.message?.includes('3018')) {
        toast.success(
          '✅ Replay attack blocked! Counter verification working correctly.',
        );
      } else {
        toast.success(`✅ Replay attack failed: ${error.message || error}`);
      }
    } finally {
      setIsReplayTransferring(false);
    }
  };

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

        {storedSignature && (
          <CardDescription className="text-sm text-blue-600">
            🔐 Signature captured at{' '}
            {new Date(storedSignature.timestamp).toLocaleTimeString()}
            <br />
            Ready for replay attack test!
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
          <div className="items-center w-full space-y-4">
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
                <>
                  <Button
                    onClick={() => requestAirdropAsync()}
                    variant="outline"
                  >
                    Request Airdrop
                  </Button>
                  <Button
                    onClick={() => transferWithPasskeyAsync()}
                    disabled={!hasMatchingAuthority || isTransferring}
                  >
                    {isTransferring ? 'Transferring...' : 'Transfer 0.1 SOL'}
                  </Button>
                </>
              )}
            </div>
            <CardDescription className="text-xs text-gray-500 text-center">
              {!hasCredential
                ? 'Create a passkey to get started with secure authentication'
                : hasMatchingAuthority
                  ? storedSignature
                    ? 'Ready to test signature replay protection! Click the red button to attempt replay attack.'
                    : 'Ready to sign transactions with your passkey! The first transfer will store signature data for replay testing.'
                  : 'Create a Swig wallet or add this passkey as an authority'}
            </CardDescription>
            <div className="items-center w-full space-x-4">
              <Button
                onClick={async () => {
                  try {
                    const tx = await transferAndStoreSignature();
                    toast.success(
                      'Transfer completed with passkey authentication!',
                      {
                        action: <GoToExplorer tx={tx} />,
                        className: 'w-max',
                      },
                    );
                  } catch (error: any) {
                    console.error('Transfer error:', error);
                    toast.error(`Transfer failed: ${error.message || error}`);
                  }
                }}
                disabled={!hasMatchingAuthority || isTransferring}
              >
                {isTransferring
                  ? 'Transferring...'
                  : 'Transfer 0.1 SOL & Store Signature'}
              </Button>

              {storedSignature && (
                <Button
                  onClick={replayTransfer}
                  disabled={isReplayTransferring}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isReplayTransferring
                    ? 'Attempting Replay...'
                    : '🚨 Test Signature Replay Attack'}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
