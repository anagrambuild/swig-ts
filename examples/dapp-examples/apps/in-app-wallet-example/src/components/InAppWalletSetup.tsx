import React, { useState } from 'react';
import { Button } from '@swig/ui';

interface InAppWalletSetupProps {
  onWalletCreated: (info: {
    publicKey: string;
    authMethod: string;
    walletType: string;
  }) => void;
}

const InAppWalletSetup: React.FC<InAppWalletSetupProps> = ({ onWalletCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [authMethod, setAuthMethod] = useState<string | null>(null);
  
  const authMethods = [
    { id: 'google', name: 'Google', icon: '🔍' },
    { id: 'email', name: 'Email', icon: '✉️' },
    { id: 'mobile', name: 'Mobile Number', icon: '📱' }
  ];
  
  const walletTypes = [
    { id: 'custodial', name: 'Custodial (App Managed)', description: 'We manage the wallet for you' },
    { id: 'non-custodial', name: 'Non-Custodial', description: 'You have full control of your wallet' }
  ];
  
  const [selectedWalletType, setSelectedWalletType] = useState<string | null>(null);
  
  const startWalletCreation = (method: string) => {
    setAuthMethod(method);
  };
  
  const selectWalletType = (walletType: string) => {
    setSelectedWalletType(walletType);
  };
  
  const createWallet = () => {
    setIsCreating(true);
    
    // Simulate wallet creation
    setTimeout(() => {
      // Generate a mock public key
      const mockPublicKey = 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq';
      
      // Notify parent component
      onWalletCreated({
        publicKey: mockPublicKey,
        authMethod: authMethod || 'unknown',
        walletType: selectedWalletType || 'unknown'
      });
      
      setIsCreating(false);
    }, 1500);
  };
  
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900">Create Your Swig Wallet</h2>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        Set up a wallet directly within this application using Swig's in-app wallet technology.
      </p>
      
      {!authMethod ? (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-3">Choose Authentication Method</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {authMethods.map((method) => (
              <button
                key={method.id}
                className="p-4 border rounded hover:bg-gray-50 text-left flex items-center"
                onClick={() => startWalletCreation(method.id)}
              >
                <span className="text-2xl mr-3">{method.icon}</span>
                <span>Continue with {method.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : selectedWalletType === null ? (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-3">Choose Wallet Type</h3>
          <div className="space-y-4">
            {walletTypes.map((type) => (
              <button
                key={type.id}
                className="w-full p-4 border rounded hover:bg-gray-50 text-left"
                onClick={() => selectWalletType(type.id)}
              >
                <div className="font-medium">{type.name}</div>
                <div className="text-sm text-gray-600">{type.description}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="bg-gray-50 rounded p-4 mb-4">
            <h3 className="text-lg font-medium mb-2">Wallet Configuration</h3>
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Authentication: </span>
                {authMethods.find(m => m.id === authMethod)?.name}
              </div>
              <div>
                <span className="font-medium">Wallet Type: </span>
                {walletTypes.find(t => t.id === selectedWalletType)?.name}
              </div>
            </div>
          </div>
          
          <Button
            onClick={createWallet}
            disabled={isCreating}
          >
            {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InAppWalletSetup;
