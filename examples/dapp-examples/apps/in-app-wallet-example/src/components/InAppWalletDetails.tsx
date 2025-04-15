import React from 'react';
import { Button } from '@swig/ui';

interface InAppWalletDetailsProps {
  walletInfo: {
    publicKey: string;
    authMethod: string;
    walletType: string;
  };
  onLogout: () => void;
}

const InAppWalletDetails: React.FC<InAppWalletDetailsProps> = ({
  walletInfo,
  onLogout
}) => {
  const { publicKey, authMethod, walletType } = walletInfo;
  
  // Map auth method ID to display name
  const getAuthMethodName = (id: string) => {
    const methods: { [key: string]: string } = {
      'google': 'Google',
      'email': 'Email',
      'mobile': 'Mobile Number'
    };
    return methods[id] || id;
  };
  
  // Map wallet type ID to display name
  const getWalletTypeName = (id: string) => {
    const types: { [key: string]: string } = {
      'custodial': 'Custodial (App Managed)',
      'non-custodial': 'Non-Custodial'
    };
    return types[id] || id;
  };
  
  return (
    <div>
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-medium text-gray-900">Your Swig Wallet</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your wallet has been created and is ready to use.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={onLogout}
        >
          Log Out
        </Button>
      </div>
      
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <div className="mb-4">
          <div className="text-sm text-gray-500">Public Key</div>
          <div className="font-mono text-sm break-all">{publicKey}</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Authentication Method</div>
            <div>{getAuthMethodName(authMethod)}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500">Wallet Type</div>
            <div>{getWalletTypeName(walletType)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InAppWalletDetails;
