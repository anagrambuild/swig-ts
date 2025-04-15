import React, { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';

interface SwigPermissionsDemoProps {
  publicKey: string;
  role: string | null;
}

const SwigPermissionsDemo: React.FC<SwigPermissionsDemoProps> = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  // set by the admin
  const [selectedLendingPermission, setSelectedLendingPermission] = useState<
    string[]
  >([]);
  const [selectedDcaPermission, setSelectedDcaPermission] = useState<string[]>(
    []
  );
  const [selectedTradingPermission, setSelectedTradingPermission] = useState<
    string[]
  >([]);

  const [lendingSolRequired, setLendingSolRequired] = useState<number>(0);
  const [dcaSolRequired, setDcaSolRequired] = useState<number>(0);
  const [tradingSolRequired, setTradingSolRequired] = useState<number>(0);

  const [lendingTokens, setLendingTokens] = useState<string[]>([]);
  const [dcaTokens, setDcaTokens] = useState<string[]>([]);
  const [tradingTokens, setTradingTokens] = useState<string[]>([]);

  // set by the user
  const [userLendingTokens, setUserLendingTokens] = useState<string[]>([]);
  const [userDcaTokens, setUserDcaTokens] = useState<string[]>([]);
  const [userTradingTokens, setUserTradingTokens] = useState<string[]>([]);

  const [userLendingTokenAmounts, setUserLendingTokenAmounts] = useState<
    { token: string; amount: number }[]
  >([]);
  const [userDcaTokenAmounts, setUserDcaTokenAmounts] = useState<
    { token: string; amount: number }[]
  >([]);
  const [userTradingTokenAmounts, setUserTradingTokenAmounts] = useState<
    { token: string; amount: number }[]
  >([]);

  const handleLendingAmountChange = (token: string, value: string) => {
    const numValue = Number(value) || 0;
    setUserLendingTokenAmounts((prev) => {
      const existing = prev.find((item) => item.token === token);
      if (existing) {
        // Update existing token amount
        return prev.map((item) =>
          item.token === token ? { ...item, amount: numValue } : item
        );
      } else {
        // Add new token amount
        return [...prev, { token, amount: numValue }];
      }
    });
  };

  const handleDcaAmountChange = (token: string, value: string) => {
    const numValue = Number(value) || 0;
    setUserDcaTokenAmounts((prev) => {
      const existing = prev.find((item) => item.token === token);
      if (existing) {
        return prev.map((item) =>
          item.token === token ? { ...item, amount: numValue } : item
        );
      } else {
        return [...prev, { token, amount: numValue }];
      }
    });
  };

  const handleTradingAmountChange = (token: string, value: string) => {
    const numValue = Number(value) || 0;
    setUserTradingTokenAmounts((prev) => {
      const existing = prev.find((item) => item.token === token);
      if (existing) {
        return prev.map((item) =>
          item.token === token ? { ...item, amount: numValue } : item
        );
      } else {
        return [...prev, { token, amount: numValue }];
      }
    });
  };

  // This is the Chrome extension ID for the Swig wallet
  // Replace with your actual extension ID
  const swigExtensionId = 'khnahinkhjfaolcbjaamlopkknpcapgn';
  const jupLogo = 'https://cryptologos.cc/logos/jupiter-ag-jup-logo.png?v=040';

  const requestPermission = async (
    permissions: string[],
    solRequired: number,
    tokenAmounts: { token: string; amount: number }[]
  ) => {
    setLoading(true);
    setError(null);
    setStatus(`Requesting permissions...`);

    try {
      // Check if chrome.runtime is available
      if (window.chrome && window.chrome.runtime) {
        // Open the extension with a permission request
        window.chrome.runtime.sendMessage(
          swigExtensionId,
          {
            action: 'request_permissions',
            appName: 'Jupiter DEX',
            appIcon: jupLogo,
            permissions: permissions,
            origin: window.location.origin,
            solRequired: solRequired,
            tokenAmounts: tokenAmounts,
            isSwig: true, // Add this flag to identify as a Swig-aware dApp
            navigate: {
              screen: 'permissions-request',
              params: {
                requestedPermissions: permissions,
                solRequired,
                tokenAmounts,
              },
            },
          },
          (response) => {
            setLoading(false);

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
              return;
            }

            if (response && response.success) {
              setStatus(
                `Permission request sent to Swig Wallet. Check the extension to approve.`
              );
            } else {
              setError(response?.error || 'Failed to send permission request');
            }
          }
        );
      } else {
        throw new Error(
          'Chrome extension API not available. Try using Chrome browser.'
        );
      }
    } catch (error) {
      setLoading(false);
      setError(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fallback approach - try to open the extension in a new tab
      try {
        window.open(
          `chrome-extension://${swigExtensionId}/index.html#/permissions-request`,
          '_blank'
        );
        setStatus('Attempted to open Swig extension in a new tab');
      } catch (fallbackError) {
        setError(
          `Fallback also failed: ${
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Unknown error'
          }`
        );
      }
    }
  };

  // const openSwigExtension = () => {
  //   setLoading(true);
  //   setError(null);
  //   setStatus('Opening Swig extension...');

  //   try {
  //     // Check if chrome.runtime is available
  //     if (window.chrome && window.chrome.runtime) {
  //       // Try to open the extension using Chrome's API
  //       window.chrome.runtime.sendMessage(
  //         swigExtensionId,
  //         { action: 'open_popup' },
  //         (response) => {
  //           setLoading(false);

  //           if (window.chrome?.runtime.lastError) {
  //             console.error(
  //               'Error opening extension:',
  //               window.chrome.runtime.lastError
  //             );
  //             setError(
  //               `Error opening extension: ${
  //                 window.chrome.runtime.lastError.message || 'Unknown error'
  //               }`
  //             );
  //             return;
  //           }

  //           if (response && response.success) {
  //             setStatus('Swig extension opened successfully');
  //           } else {
  //             setError(response?.error || 'Failed to open Swig extension');
  //           }
  //         }
  //       );
  //     } else {
  //       throw new Error(
  //         'Chrome extension API not available. Try using Chrome browser.'
  //       );
  //     }
  //   } catch (error) {
  //     setLoading(false);
  //     setError(
  //       `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  //     );

  //     // Fallback approach
  //     try {
  //       window.open(
  //         `chrome-extension://${swigExtensionId}/index.html`,
  //         '_blank'
  //       );
  //       setStatus('Attempted to open Swig extension in a new tab');
  //     } catch (fallbackError) {
  //       setError(
  //         `Fallback also failed: ${
  //           fallbackError instanceof Error
  //             ? fallbackError.message
  //             : 'Unknown error'
  //         }`
  //       );
  //     }
  //   }
  // };

  // TODO - a swig aware dapp should pass the flag "isSwig: true" to the connect() method
  // like this
  // window.swigWallet.connect({
  //   appName: "My Swig dApp",
  //   permissions: ["view_balance", "sign_transactions"],
  //   isSwig: true  // This flag identifies it as Swig-aware
  // });

  return (
    <div className='flex flex-col gap-4'>
      <h2 className='text-xl font-medium text-gray-900'>
        Swig Permissions Demo
      </h2>
      <p className='mt-2 text-sm text-gray-600'>
        Test opening the Swig wallet extension to request different permissions.
      </p>
      <div className='flex flex-row gap-4 items-center'>
        <img
          src={jupLogo}
          alt='Jupiter DEX'
          className='w-1/2 rounded-md'
          style={{ width: '100px', height: '100px' }}
        />
        <h1 className='text-2xl font-medium text-gray-900'>Jupiter DEX</h1>
      </div>
      <div className='flex flex-row gap-4 w-1/2 rounded-md'>
        <div
          className={`w-1/2 bg-gray-100 p-4 rounded-md cursor-pointer ${
            isAdmin ? 'bg-green-500 text-white' : ''
          }`}
          onClick={() => setIsAdmin(true)}
        >
          Admin dashboard
        </div>
        <div
          className={`w-1/2 bg-gray-100 p-4 rounded-md cursor-pointer ${
            !isAdmin ? 'bg-green-500 text-white' : ''
          }`}
          onClick={() => setIsAdmin(false)}
        >
          User dashboard
        </div>
      </div>

      {error && (
        <div className='mt-4 p-3 bg-red-100 text-red-700 rounded-md'>
          {error}
        </div>
      )}

      {status && !error && (
        <div className='mt-4 p-3 bg-green-100 text-green-700 rounded-md'>
          {status}
        </div>
      )}

      {isAdmin ? (
        <AdminDashboard
          selectedLendingPermission={selectedLendingPermission}
          setSelectedLendingPermission={setSelectedLendingPermission}
          selectedDcaPermission={selectedDcaPermission}
          setSelectedDcaPermission={setSelectedDcaPermission}
          selectedTradingPermission={selectedTradingPermission}
          setSelectedTradingPermission={setSelectedTradingPermission}
          lendingSolRequired={lendingSolRequired}
          setLendingSolRequired={setLendingSolRequired}
          dcaSolRequired={dcaSolRequired}
          setDcaSolRequired={setDcaSolRequired}
          tradingSolRequired={tradingSolRequired}
          setTradingSolRequired={setTradingSolRequired}
          lendingTokens={lendingTokens}
          setLendingTokens={setLendingTokens}
          dcaTokens={dcaTokens}
          setDcaTokens={setDcaTokens}
          tradingTokens={tradingTokens}
          setTradingTokens={setTradingTokens}
        />
      ) : (
        <UserDashboard
          requestPermission={requestPermission}
          loading={loading}
          selectedLendingPermission={selectedLendingPermission}
          selectedDcaPermission={selectedDcaPermission}
          selectedTradingPermission={selectedTradingPermission}
          lendingSolRequired={lendingSolRequired}
          dcaSolRequired={dcaSolRequired}
          tradingSolRequired={tradingSolRequired}
          lendingTokens={lendingTokens}
          dcaTokens={dcaTokens}
          tradingTokens={tradingTokens}
          userLendingTokens={userLendingTokens}
          setUserLendingTokens={setUserLendingTokens}
          userDcaTokens={userDcaTokens}
          setUserDcaTokens={setUserDcaTokens}
          userTradingTokens={userTradingTokens}
          setUserTradingTokens={setUserTradingTokens}
          userLendingTokenAmounts={userLendingTokenAmounts}
          handleLendingAmountChange={handleLendingAmountChange}
          userDcaTokenAmounts={userDcaTokenAmounts}
          handleDcaAmountChange={handleDcaAmountChange}
          userTradingTokenAmounts={userTradingTokenAmounts}
          handleTradingAmountChange={handleTradingAmountChange}
        />
      )}
    </div>
  );
};

export default SwigPermissionsDemo;
