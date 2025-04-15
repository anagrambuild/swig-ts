import React, { useState } from 'react';
import { Button } from '@swig/ui';
import { useWallet } from '../contexts/WalletContext';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

// You would typically get this from your environment configuration
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

const TransactionDemo: React.FC = () => {
  const { publicKey, signAndSendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txResult, setTxResult] = useState<{
    signature: string;
    success: boolean;
  } | null>(null);

  const sendTestTransaction = async () => {
    if (!publicKey) {
      setTxResult({ signature: '', success: false });
      return;
    }

    setIsLoading(true);
    setTxResult(null);

    try {
      // Create a Solana connection
      const connection = new Connection(SOLANA_RPC_URL);

      // Create a new transaction
      // This is a dummy transaction that sends 0 SOL to yourself
      // In a real app, you would create meaningful transactions
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(publicKey),
          toPubkey: new PublicKey(publicKey),
          lamports: 0, // 0 SOL
        })
      );
      // Get the recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(publicKey);

      // Sign and send the transaction using the wallet
      const signature = await signAndSendTransaction(transaction, connection);

      setTxResult({
        signature,
        success: true,
      });
    } catch (error) {
      console.error('Transaction error:', error);
      setTxResult({
        signature: '',
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isWalletConnected = !!publicKey;

  return (
    <div>
      <h2 className='text-xl font-medium text-gray-900'>Transaction Demo</h2>
      <p className='mt-2 text-sm text-gray-600'>
        This demonstrates sending a transaction using the Solana Wallet
        Standard.
        {!isWalletConnected && ' Please connect your wallet first.'}
      </p>

      <div className='mt-4'>
        <Button
          onClick={sendTestTransaction}
          disabled={isLoading || !isWalletConnected}
        >
          {isLoading ? 'Sending...' : 'Send Test Transaction'}
        </Button>

        {txResult && (
          <div
            className={`mt-4 p-4 border rounded ${
              txResult.success ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            {txResult.success ? (
              <>
                <p className='text-sm font-medium text-green-800'>
                  Transaction Successful!
                </p>
                <p className='text-xs mt-1 text-green-700 break-all'>
                  Signature: {txResult.signature}
                </p>
              </>
            ) : (
              <p className='text-sm text-red-800'>
                Transaction failed. Please check the console for details.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionDemo;
