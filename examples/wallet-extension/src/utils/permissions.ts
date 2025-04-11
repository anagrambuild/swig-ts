// Define permission types
export const PERMISSION_TYPES = {
  VIEW_BALANCE: 'view_balance',
  VIEW_TRANSACTION_HISTORY: 'view_transaction_history',
  SIGN_TRANSACTIONS: 'sign_transactions',
  CREATE_SUB_ACCOUNT: 'create_sub_account',
  AUTOMATIC_SUBSCRIPTIONS: 'set_up_automatic_subscriptions',
};

// Interface for permission request
export interface PermissionRequest {
  id: string;
  origin: string;
  url: string;
  appName: string;
  appIcon?: string;
  permissions: string[];
  timestamp: number;
}

// Interface for approved permissions
export interface ApprovedPermissions {
  origin: string;
  appName: string;
  permissions: string[];
  dateApproved: number;
  expiresAt?: number; // Optional expiration time
}

// Check if a permission exists for an origin
export const hasPermission = async (
  origin: string,
  permission: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['approved_permissions'], (result) => {
      const approvedPermissions = result.approved_permissions || {};
      const appPermissions = approvedPermissions[origin];

      if (!appPermissions) {
        resolve(false);
        return;
      }

      // Check if permission exists and is not expired
      if (appPermissions.permissions.includes(permission)) {
        if (appPermissions.expiresAt && appPermissions.expiresAt < Date.now()) {
          resolve(false);
        } else {
          resolve(true);
        }
      } else {
        resolve(false);
      }
    });
  });
};

// Get all approved permissions
export const getAllApprovedPermissions = async (): Promise<
  Record<string, ApprovedPermissions>
> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['approved_permissions'], (result) => {
      resolve(result.approved_permissions || {});
    });
  });
};

// Save approved permissions for an origin
export const saveApprovedPermissions = async (
  origin: string,
  appName: string,
  permissions: string[],
  expiresInMs?: number
): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['approved_permissions'], (result) => {
      const approvedPermissions = result.approved_permissions || {};

      approvedPermissions[origin] = {
        origin,
        appName,
        permissions,
        dateApproved: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
      };

      chrome.storage.local.set(
        { approved_permissions: approvedPermissions },
        () => {
          resolve();
        }
      );
    });
  });
};

// Remove permissions for an origin
export const removePermissions = async (origin: string): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['approved_permissions'], (result) => {
      const approvedPermissions = result.approved_permissions || {};

      if (approvedPermissions[origin]) {
        delete approvedPermissions[origin];
        chrome.storage.local.set(
          { approved_permissions: approvedPermissions },
          () => {
            resolve();
          }
        );
      } else {
        resolve();
      }
    });
  });
};

// Format a permission string for display
export const formatPermission = (permission: string): string => {
  return permission
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Get description for a permission
export const getPermissionDescription = (permission: string): string => {
  switch (permission) {
    case PERMISSION_TYPES.VIEW_BALANCE:
      return 'View your account balances';
    case PERMISSION_TYPES.VIEW_TRANSACTION_HISTORY:
      return 'Access your transaction history';
    case PERMISSION_TYPES.SIGN_TRANSACTIONS:
      return 'Sign transactions on your behalf';
    case PERMISSION_TYPES.CREATE_SUB_ACCOUNT:
      return 'Create sub-accounts under your wallet';
    case PERMISSION_TYPES.AUTOMATIC_SUBSCRIPTIONS:
      return 'Set up recurring payments or subscriptions';
    default:
      return 'Unknown permission';
  }
};
