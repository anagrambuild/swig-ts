import React, { useState } from 'react';
// import SwigNativeConnect from './components/SwigNativeConnect';
// import SwigNativeTransactionDemo from './components/SwigNativeTransactionDemo';
import SwigPermissionsDemo from './components/SwigPermissionsDemo';

const App: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  return (
    <div className='min-h-screen bg-gray-100'>
      <header className='bg-white shadow'>
        <div className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
          <h1 className='text-3xl font-bold text-gray-900'>
            Swig Native Dapp Example
          </h1>
          <p className='mt-2 text-gray-600'>
            This demonstrates a dapp that is integrated with Swig's role-based
            permission system
          </p>
        </div>
      </header>
      <main className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
        <div className='bg-white shadow overflow-hidden sm:rounded-lg p-6'>
          {/* <SwigNativeConnect
            onConnect={(pubkey, role) => {
              setConnected(true);
              setPublicKey(pubkey);
              setSelectedRole(role);
            }}
            onDisconnect={() => {
              setConnected(false);
              setPublicKey('');
              setSelectedRole(null);
            }}
          /> */}

          {/* {connected && publicKey && ( */}
          <div className='mt-8'>
            {/* <h2 className='text-xl font-medium text-gray-900'>
              Connected Account
            </h2>
            <p className='mt-2 text-sm text-gray-600 break-all'>{publicKey}</p> */}

            {selectedRole && (
              <div className='mt-2'>
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                  Role: {selectedRole}
                </span>
              </div>
            )}

            {/* <div className='mt-8'>
              <SwigNativeTransactionDemo publicKey={publicKey} />
            </div> */}

            <div className='mt-8'>
              <SwigPermissionsDemo publicKey={publicKey} role={selectedRole} />
            </div>
          </div>
          {/* // )} */}
        </div>
      </main>
    </div>
  );
};

export default App;
