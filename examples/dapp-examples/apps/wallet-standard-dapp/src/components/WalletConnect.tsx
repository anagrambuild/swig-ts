import React, { useState } from 'react';
import { Button } from '@swig/ui';
import { useWallet } from '../contexts/WalletContext';

const WalletConnect: React.FC = () => {
  const {
    wallets,
    selectedWallet,
    publicKey,
    connecting,
    connected,
    connectWallet,
    disconnectWallet,
  } = useWallet();
  const [showWalletList, setShowWalletList] = useState(false);

  // Function to open Swig extension directly
  // const openSwigExtension = () => {
  //   console.log('Opening Swig Extension');

  //   // This is the Chrome extension ID for your Swig wallet
  //   // Replace with your actual extension ID
  //   const swigExtensionId = 'khnahinkhjfaolcbjaamlopkknpcapgn';

  //   try {
  //     // Check if chrome.runtime is available
  //     if (window.chrome && window.chrome.runtime) {
  //       // Try to open the extension using Chrome's API
  //       window.chrome.runtime.sendMessage(swigExtensionId, {
  //         action: 'open_popup',
  //       });
  //       console.log('Extension open request sent');
  //     } else {
  //       // Fallback for browsers without chrome.runtime
  //       throw new Error('Chrome extension API not available');
  //     }
  //   } catch (error) {
  //     console.error('Error opening extension:', error);

  //     // Fallback: Try to open extension page in a new tab
  //     window.open(`chrome-extension://${swigExtensionId}/index.html`, '_blank');
  //   }
  // };

  const handleConnectClick = () => {
    setShowWalletList(!showWalletList);
  };

  const handleWalletSelect = async (wallet: any) => {
    try {
      await connectWallet(wallet);
      setShowWalletList(false);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      // You could show an error message to the user here
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  return (
    <div>
      <h2 className='text-xl font-medium text-gray-900'>Wallet Connection</h2>

      {!connected ? (
        <div className='mt-4'>
          <Button onClick={handleConnectClick} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>

          {showWalletList && wallets && wallets.length > 0 && (
            <div className='mt-2 bg-white border border-gray-200 rounded shadow-lg p-4'>
              <h3 className='text-lg font-medium mb-2'>Select a wallet</h3>
              <ul className='space-y-2'>
                {wallets.map((wallet, index) => (
                  <li key={wallet.adapter?.name || `wallet-${index}`}>
                    <button
                      className='w-full text-left px-4 py-2 rounded hover:bg-gray-100 flex items-center'
                      onClick={() => handleWalletSelect(wallet)}
                    >
                      {wallet.adapter?.icon && (
                        <img
                          src={wallet.adapter.icon}
                          alt={`${wallet.adapter.name} icon`}
                          className='w-6 h-6 mr-2'
                        />
                      )}
                      {wallet.adapter?.name || 'Unknown Wallet'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showWalletList && (!wallets || wallets.length === 0) && (
            <div className='mt-2 bg-white border border-gray-200 rounded shadow-lg p-4'>
              <p className='text-sm text-gray-600'>
                No compatible wallets found. Please install a Solana wallet
                extension that supports the Wallet Standard.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className='mt-4'>
          <div className='flex items-center'>
            <span className='font-medium mr-2'>Connected:</span>
            <span className='font-mono text-sm truncate max-w-xs'>
              {publicKey}
            </span>
            <Button
              variant='secondary'
              onClick={handleDisconnect}
              className='ml-4'
            >
              Disconnect
            </Button>
          </div>
          {selectedWallet && (
            <div className='mt-2 text-sm text-gray-600'>
              Wallet: {selectedWallet.adapter?.name || 'Unknown Wallet'}
            </div>
          )}
        </div>
      )}
      {/* <Button onClick={openSwigExtension} variant='secondary'>
        Open Swig Extension Directly
      </Button> */}
    </div>
  );
};

export default WalletConnect;
