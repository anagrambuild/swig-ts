import React, { useState } from 'react';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Authority, createSwig, findSwigPda } from '@swig/classic';
import { Buffer } from 'buffer';
import InAppWalletSetup from './components/InAppWalletSetup';
import InAppWalletDetails from './components/InAppWalletDetails';
import InAppTransactionDemo from './components/InAppTransactionDemo';

// Make Buffer available globally
window.Buffer = Buffer;

const App: React.FC = () => {
  const [walletCreated, setWalletCreated] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    publicKey: string;
    authMethod: string;
    walletType: string;
  } | null>(null);

  const handleWalletCreated = (info: {
    publicKey: string;
    authMethod: string;
    walletType: string;
  }) => {
    setWalletCreated(true);
    setWalletInfo(info);
  };

  const handleLogout = () => {
    setWalletCreated(false);
    setWalletInfo(null);
  };

  const testCreateSwig = async () => {
    try {
      const connection = new Connection('http://localhost:8899', 'confirmed');

      // Generate a random ID for the Swig
      const id = new Uint8Array(13);
      crypto.getRandomValues(id);

      // Generate a keypair for the root authority
      const rootKeypair = Keypair.generate();

      // Request airdrop for the root authority and wait for confirmation
      const airdropSignature = await connection.requestAirdrop(
        rootKeypair.publicKey,
        LAMPORTS_PER_SOL
      );

      // Wait for the airdrop to be confirmed
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: airdropSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      // Find the Swig PDA
      const [swigAddress] = findSwigPda(id);

      // Create the root authority
      const rootAuthority = Authority.ed25519(rootKeypair.publicKey);

      // Create the Swig
      await createSwig(
        connection,
        id,
        rootAuthority,
        0n,
        0n,
        rootKeypair.publicKey,
        [rootKeypair]
      );

      console.log('Swig created successfully!');
      console.log('Swig address:', swigAddress.toString());
    } catch (error: any) {
      console.error('Error creating Swig:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
    }
  };

  return (
    <div className='min-h-screen bg-gray-100'>
      <header className='bg-white shadow'>
        <div className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
          <h1 className='text-3xl font-bold text-gray-900'>
            Swig In-App Wallet Example
          </h1>
          <p className='mt-2 text-gray-600'>
            This demonstrates a dapp that creates a Swig wallet for users within
            the application
          </p>
        </div>
      </header>
      <main className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
        <div className='bg-white shadow overflow-hidden sm:rounded-lg p-6'>
          <div className='mb-4'>
            <button
              onClick={testCreateSwig}
              className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
            >
              Test Create Swig
            </button>
          </div>
          {!walletCreated ? (
            <InAppWalletSetup onWalletCreated={handleWalletCreated} />
          ) : (
            <>
              {walletInfo && (
                <InAppWalletDetails
                  walletInfo={walletInfo}
                  onLogout={handleLogout}
                />
              )}

              <div className='mt-8'>
                <InAppTransactionDemo publicKey={walletInfo?.publicKey || ''} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
