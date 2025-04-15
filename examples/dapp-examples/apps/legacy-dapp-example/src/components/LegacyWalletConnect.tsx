import React, { useState } from 'react';
import { Button } from '@swig/ui';

// Mock wallet adapter for demonstration
const mockWallets = [
  { name: 'Phantom', icon: '👻' },
  { name: 'Solflare', icon: '🔆' },
  { name: 'Sollet', icon: '💳' }
];

interface LegacyWalletConnectProps {
  onConnect: (publicKey: string) => void;
  onDisconnect: () => void;
}

const LegacyWalletConnect: React.FC<LegacyWalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const [wallets] = useState(mockWallets);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showWalletList, setShowWalletList] = useState(false);
  
  const connectWallet = (walletName: string) => {
    console.log(`Connecting to ${walletName}...`);
    // Simulate successful connection
    setTimeout(() => {
      const mockPublicKey = 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq';
      setSelectedWallet(walletName);
      setShowWalletList(false);
      onConnect(mockPublicKey);
    }, 500);
  };
  
  const disconnectWallet = () => {
    console.log('Disconnecting wallet...');
    setSelectedWallet(null);
    onDisconnect();
  };
  
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900">Legacy Wallet Connection</h2>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        This example demonstrates connecting to a wallet using legacy (pre-Wallet Standard) methods.
      </p>
      
      {!selectedWallet ? (
        <div className="mt-4">
          <Button onClick={() => setShowWalletList(!showWalletList)}>
            Connect Wallet
          </Button>
          
          {showWalletList && (
            <div className="mt-2 bg-white border border-gray-200 rounded shadow-lg p-4">
              <h3 className="text-lg font-medium mb-2">Select a wallet</h3>
              <ul className="space-y-2">
                {wallets.map((wallet) => (
                  <li key={wallet.name}>
                    <button
                      className="w-full text-left px-4 py-2 rounded hover:bg-gray-100 flex items-center"
                      onClick={() => connectWallet(wallet.name)}
                    >
                      <span className="mr-2">{wallet.icon}</span>
                      {wallet.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center">
            <span className="mr-2">
              {wallets.find(w => w.name === selectedWallet)?.icon}
            </span>
            <span className="font-medium">{selectedWallet}</span>
            <Button 
              variant="secondary" 
              onClick={disconnectWallet}
              className="ml-4"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegacyWalletConnect;
