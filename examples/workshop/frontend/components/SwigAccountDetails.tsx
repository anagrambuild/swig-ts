import { useEffect, useMemo, useState } from 'react';
import type { SwigAccount } from '../hooks/useSwig';
import { apiClient } from '../lib/api';
import { getAccountExplorerUrl } from '../lib/explorer';
import ExternalLinkIcon from './ExternalLinkIcon';

interface Props {
  account: SwigAccount;
  refreshSwig?: () => Promise<void>;
}

export default function SwigAccountDetails({ account, refreshSwig }: Props) {
  const [backendAddress, setBackendAddress] = useState<string | null>(null);

  // Fetch backend address on mount
  useEffect(() => {
    const fetchBackendAddress = async () => {
      try {
        const response = await apiClient.getBackendAddress();
        if (response.success && response.backendAddress) {
          setBackendAddress(response.backendAddress);
        }
      } catch (err) {
        console.error('Error fetching backend address:', err);
      }
    };

    fetchBackendAddress();
  }, []);

  const roleInfo = useMemo(() => {
    if (!account.swig) return null;

    try {
      // Find roles for the user and manager keypairs
      const userRoles = account.swig.findRolesByEd25519SignerPk(
        account.userKeypair.address,
      );
      const managerRoles = account.swig.findRolesByEd25519SignerPk(
        account.managerKeypair.address,
      );

      // Find roles for the backend address if available
      let backendRoles: any[] = [];
      if (backendAddress) {
        try {
          backendRoles = account.swig.findRolesByEd25519SignerPk(
            backendAddress as any,
          );
        } catch (err) {
          console.log(
            'No backend roles found or error finding backend roles:',
            err,
          );
        }
      }

      // Debug: log all available data about the Swig account
      if (backendAddress) {
        console.log('Backend address:', backendAddress);
        console.log('Swig account data:', account.swig);
        console.log(
          'All roles in Swig:',
          account.swig.roles || 'No roles property',
        );
      }

      return {
        userRoles,
        managerRoles,
        backendRoles,
        backendAddress,
        totalRoles:
          userRoles.length + managerRoles.length + backendRoles.length,
      };
    } catch (error) {
      console.error('Error parsing roles:', error);
      return null;
    }
  }, [
    account.swig,
    account.userKeypair.address,
    account.managerKeypair.address,
    backendAddress,
  ]);

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Swig Account Details</h3>

      <div className="space-y-6">
        {/* Account Addresses */}
        <div>
          <h4 className="font-semibold mb-3">Account Addresses</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium text-sm">Swig Address</div>
                <div className="font-mono text-xs text-gray-600">
                  {account.address}
                </div>
              </div>
              <a
                href={getAccountExplorerUrl(account.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
              >
                Explorer <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium text-sm">User Address</div>
                <div className="font-mono text-xs text-gray-600">
                  {account.userKeypair.address}
                </div>
              </div>
              <a
                href={getAccountExplorerUrl(account.userKeypair.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
              >
                Explorer <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium text-sm">Manager Address</div>
                <div className="font-mono text-xs text-gray-600">
                  {account.managerKeypair.address}
                </div>
              </div>
              <a
                href={getAccountExplorerUrl(account.managerKeypair.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
              >
                Explorer <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Role Information */}
        {roleInfo && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Role Information</h4>
              {refreshSwig && (
                <button
                  onClick={refreshSwig}
                  className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 border border-blue-300 rounded"
                >
                  Refresh Authorities
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="font-medium text-blue-900 mb-2">User Roles</div>
                {roleInfo.userRoles.length > 0 ? (
                  <div className="space-y-1">
                    {roleInfo.userRoles.map((role, index) => (
                      <div key={index} className="text-sm">
                        Role ID: {role.id} (Root Role)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-blue-600">
                    No user roles found
                  </div>
                )}
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="font-medium text-green-900 mb-2">
                  Manager Roles
                </div>
                {roleInfo.managerRoles.length > 0 ? (
                  <div className="space-y-1">
                    {roleInfo.managerRoles.map((role, index) => (
                      <div key={index} className="text-sm">
                        Role ID: {role.id} (Manager Role)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-green-600">
                    No manager roles found
                  </div>
                )}
              </div>

              {/* Backend Roles */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="font-medium text-purple-900 mb-2">
                  Backend Roles{' '}
                  {roleInfo.backendAddress && (
                    <a
                      href={getAccountExplorerUrl(roleInfo.backendAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-purple-600 hover:text-purple-700"
                    >
                      <ExternalLinkIcon className="w-3 h-3 inline" />
                    </a>
                  )}
                </div>
                {roleInfo.backendRoles && roleInfo.backendRoles.length > 0 ? (
                  <div className="space-y-1">
                    {roleInfo.backendRoles.map((role, index) => (
                      <div key={index} className="text-sm">
                        Role ID: {role.id} (Backend Delegation)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-purple-600">
                    {roleInfo.backendAddress
                      ? 'No backend delegations found'
                      : 'Backend address not available'}
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600">
                Total Roles: {roleInfo.totalRoles}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
