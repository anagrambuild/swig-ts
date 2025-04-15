export {}; // Make this file a module

// Check if Swig wallet is available
function isSwigWalletAvailable(): boolean {
  return (
    typeof window.swigWallet !== 'undefined' && window.swigWallet.isSwigWallet
  );
}

// Connect to Swig wallet with specific permissions
async function connectSwigWallet(): Promise<void> {
  if (!isSwigWalletAvailable()) {
    console.error('Swig Wallet extension is not installed or not available');
    // Show the user a message to install the extension
    const statusElement = document.getElementById('wallet-status');
    if (statusElement) {
      statusElement.textContent =
        'Swig Wallet extension not detected. Please install it to continue.';
    }
    return;
  }

  try {
    // Request to connect with specific permissions
    const result = await window.swigWallet!.connect({
      appName: 'Jupiter', // Your app name
      appIcon: 'https://jup.ag/favicon.ico', // Your app icon URL
      permissions: [
        'view_balance',
        'view_transaction_history',
        'sign_transactions',
        'create_sub_account',
        'set_up_automatic_subscriptions',
      ],
    });

    if (result.success) {
      console.log('Successfully connected to Swig Wallet');
      console.log('Approved permissions:', result.approvedPermissions);

      // Update UI to show connected state
      const statusElement = document.getElementById('wallet-status');
      const connectButton = document.getElementById(
        'connect-btn'
      ) as HTMLButtonElement | null;
      const disconnectButton = document.getElementById(
        'disconnect-btn'
      ) as HTMLButtonElement | null;

      if (statusElement) {
        statusElement.textContent = 'Connected to Swig Wallet';
      }
      if (connectButton) {
        connectButton.disabled = true;
      }
      if (disconnectButton) {
        disconnectButton.disabled = false;
      }

      // Show the approved permissions
      const permissionsList = document.getElementById('permissions-list');
      if (permissionsList && result.approvedPermissions) {
        permissionsList.innerHTML = '';
        result.approvedPermissions.forEach((permission) => {
          const listItem = document.createElement('li');
          listItem.textContent = formatPermission(permission);
          permissionsList.appendChild(listItem);
        });
      }
    } else {
      console.error('Failed to connect to Swig Wallet:', result.error);
      const statusElement = document.getElementById('wallet-status');
      if (statusElement) {
        statusElement.textContent = `Connection failed: ${
          result.error || 'Unknown error'
        }`;
      }
    }
  } catch (error) {
    console.error('Error connecting to Swig Wallet:', error);
    const statusElement = document.getElementById('wallet-status');
    if (statusElement) {
      statusElement.textContent = `Connection error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }
}

// Request additional permissions
async function requestAdditionalPermissions(): Promise<void> {
  if (!isSwigWalletAvailable()) {
    console.error('Swig Wallet extension is not installed or not available');
    return;
  }

  try {
    // Request additional permissions
    const result = await window.swigWallet!.requestPermissions([
      'create_sub_account',
      'set_up_automatic_subscriptions',
    ]);

    if (result.success) {
      console.log('Successfully requested additional permissions');
      console.log('Approved permissions:', result.approvedPermissions);

      // Update the permissions list
      const permissionsList = document.getElementById('permissions-list');
      if (permissionsList && result.approvedPermissions) {
        permissionsList.innerHTML = '';
        result.approvedPermissions.forEach((permission) => {
          const listItem = document.createElement('li');
          listItem.textContent = formatPermission(permission);
          permissionsList.appendChild(listItem);
        });
      }
    } else {
      console.error('Failed to request additional permissions:', result.error);
    }
  } catch (error) {
    console.error('Error requesting additional permissions:', error);
  }
}

// Disconnect from Swig wallet
async function disconnectSwigWallet(): Promise<void> {
  if (!isSwigWalletAvailable()) {
    console.error('Swig Wallet extension is not installed or not available');
    return;
  }

  try {
    await window.swigWallet!.disconnect();
    console.log('Disconnected from Swig Wallet');

    // Update UI to show disconnected state
    const statusElement = document.getElementById('wallet-status');
    const connectButton = document.getElementById(
      'connect-btn'
    ) as HTMLButtonElement | null;
    const disconnectButton = document.getElementById(
      'disconnect-btn'
    ) as HTMLButtonElement | null;
    const permissionsList = document.getElementById('permissions-list');

    if (statusElement) {
      statusElement.textContent = 'Disconnected from Swig Wallet';
    }
    if (connectButton) {
      connectButton.disabled = false;
    }
    if (disconnectButton) {
      disconnectButton.disabled = true;
    }
    if (permissionsList) {
      permissionsList.innerHTML = '';
    }
  } catch (error) {
    console.error('Error disconnecting from Swig Wallet:', error);
  }
}

// Format permission string for display
function formatPermission(permission: string): string {
  return permission
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Setup event listeners
  const connectButton = document.getElementById('connect-btn');
  const permissionsButton = document.getElementById('permissions-btn');
  const disconnectButton = document.getElementById('disconnect-btn');
  const statusElement = document.getElementById('wallet-status');

  if (connectButton) {
    connectButton.addEventListener('click', connectSwigWallet);
  }

  if (permissionsButton) {
    permissionsButton.addEventListener('click', requestAdditionalPermissions);
  }

  if (disconnectButton) {
    disconnectButton.addEventListener('click', disconnectSwigWallet);
  }

  // Listen for Swig wallet availability
  if (isSwigWalletAvailable()) {
    if (statusElement) {
      statusElement.textContent = 'Swig Wallet detected. Ready to connect.';
    }
  } else {
    // If not immediately available, check again when the extension injects itself
    window.addEventListener('swig-wallet-loaded', () => {
      if (statusElement) {
        statusElement.textContent = 'Swig Wallet detected. Ready to connect.';
      }
    });

    if (statusElement) {
      statusElement.textContent = 'Waiting for Swig Wallet...';
    }
  }
});
