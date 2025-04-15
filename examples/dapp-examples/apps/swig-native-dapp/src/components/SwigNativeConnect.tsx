import React, { useState, useEffect } from 'react';
import { Button } from '@swig/ui';
import type { SwigWallet } from '../types/swig';

declare global {
  interface Window {
    swigWallet?: SwigWallet;
  }
}

interface SwigNativeConnectProps {
  onConnect: (publicKey: string, role: string) => void;
  onDisconnect: () => void;
}

const SwigNativeConnect: React.FC<SwigNativeConnectProps> = ({
  onConnect,
  onDisconnect,
}) => {
  // This is the Chrome extension ID for your Swig wallet
  // Replace with your actual extension ID
  const swigExtensionId = 'khnahinkhjfaolcbjaamlopkknpcapgn';

  const [walletDetected, setWalletDetected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [approvedPermissions, setApprovedPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extensionOpened, setExtensionOpened] = useState<boolean>(false);

  // Check if Swig wallet is available
  const isSwigWalletAvailable = (): boolean => {
    return (
      typeof window.swigWallet !== 'undefined' &&
      window.swigWallet.isSwigWallet === true
    );
  };

  // Open the Swig wallet extension
  const openSwigExtension = () => {
    console.log('Opening Swig Extension');
    setExtensionOpened(true);

    try {
      // Check if chrome.runtime is available
      if (window.chrome && window.chrome.runtime) {
        // Try to open the extension using Chrome's API
        window.chrome.runtime.sendMessage(
          swigExtensionId,
          { action: 'open_popup' },
          (response) => {
            if (window.chrome?.runtime.lastError) {
              console.error(
                'Error opening extension:',
                window.chrome.runtime.lastError
              );
              setError(
                `Error opening extension: ${
                  window.chrome.runtime.lastError.message || 'Unknown error'
                }`
              );
            } else if (response && response.success) {
              console.log('Extension opened successfully');
            } else {
              console.error('Failed to open extension:', response);
              setError(
                'Failed to open extension. Please check if it is installed.'
              );
            }
          }
        );
        console.log('Extension open request sent');
      } else {
        // Fallback for browsers without chrome.runtime
        throw new Error('Chrome extension API not available');
      }
    } catch (error) {
      console.error('Error opening extension:', error);
      setError(
        `Error opening extension: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );

      // Fallback: Try to open extension page in a new tab
      window.open(`chrome-extension://${swigExtensionId}/index.html`, '_blank');
    }
  };

  // Check for wallet on load and when it might be injected later
  useEffect(() => {
    const checkWallet = () => {
      const detected = isSwigWalletAvailable();
      setWalletDetected(detected);
      console.log('Swig wallet detected:', detected);
    };

    // Check immediately
    checkWallet();

    // Also listen for the wallet to be injected
    const handleWalletLoaded = () => {
      console.log('Swig wallet loaded event received');
      setWalletDetected(true);
    };

    window.addEventListener('swig-wallet-loaded', handleWalletLoaded);

    // Set up an interval to periodically check for the wallet
    // This is useful if the extension injects the wallet after our component has loaded
    const checkInterval = setInterval(checkWallet, 1000);

    // Clean up
    return () => {
      window.removeEventListener('swig-wallet-loaded', handleWalletLoaded);
      clearInterval(checkInterval);
    };
  }, []);

  // Format permission string for display
  const formatPermission = (permission: string): string => {
    return permission
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Connect to Swig wallet with specific permissions
  const connectWallet = async () => {
    if (!isSwigWalletAvailable()) {
      setError('Swig Wallet extension not detected. Opening extension...');
      openSwigExtension();
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Request to connect with specific permissions
      const result = await window.swigWallet!.connect({
        appName: 'Jupiter DEX', // Your app name
        appIcon: '/logo192.png', // Your app icon URL (update with your actual path)
        permissions: [
          'view_balance',
          'view_transaction_history',
          'sign_transactions',
          'create_sub_account',
          'set_up_automatic_subscriptions',
        ],
      });

      if (result.success && result.publicKey) {
        setConnected(true);
        setPublicKey(result.publicKey);
        setRole(result.role || 'default');
        setApprovedPermissions(result.approvedPermissions || []);

        // Notify parent component
        onConnect(result.publicKey, result.role || 'default');
      } else {
        setError(result.error || 'Failed to connect to Swig Wallet');
      }
    } catch (err) {
      setError(
        `Error connecting to Swig Wallet: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect from Swig wallet
  const disconnectWallet = async () => {
    if (!isSwigWalletAvailable()) {
      setError('Swig Wallet extension not detected.');
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      await window.swigWallet!.disconnect();

      setConnected(false);
      setPublicKey(null);
      setRole(null);
      setApprovedPermissions([]);

      // Notify parent component
      onDisconnect();
    } catch (err) {
      setError(
        `Error disconnecting from Swig Wallet: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className='swig-native-connect'>
      <h2 className='text-xl font-medium text-gray-900'>
        Swig Wallet Connection
      </h2>

      {error && (
        <div className='mt-2 p-3 bg-red-100 text-red-700 rounded-md'>
          {error}
        </div>
      )}

      <div className='mt-4'>
        {!walletDetected ? (
          <div>
            <div className='p-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-md'>
              <p className='text-yellow-700'>
                Swig Wallet extension not detected. Please install it or click
                below to open it.
              </p>
            </div>
            <Button
              onClick={openSwigExtension}
              className='w-full sm:w-auto'
              disabled={extensionOpened}
            >
              {extensionOpened ? 'Opening Extension...' : 'Open Swig Extension'}
            </Button>
          </div>
        ) : !connected ? (
          <Button
            onClick={connectWallet}
            disabled={connecting}
            className='w-full sm:w-auto'
          >
            {connecting ? 'Connecting...' : 'Connect with Swig'}
          </Button>
        ) : (
          <div>
            <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-md'>
              <p className='text-green-700'>Connected to Swig Wallet</p>
              {publicKey && (
                <p className='mt-1 text-sm text-gray-600 break-all'>
                  {publicKey}
                </p>
              )}
            </div>

            {approvedPermissions.length > 0 && (
              <div className='mt-4 mb-4'>
                <h3 className='text-sm font-medium text-gray-700'>
                  Approved Permissions:
                </h3>
                <ul className='mt-2 pl-5 list-disc text-sm text-gray-600'>
                  {approvedPermissions.map((permission, index) => (
                    <li key={index}>{formatPermission(permission)}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={disconnectWallet}
              variant='secondary'
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwigNativeConnect;
