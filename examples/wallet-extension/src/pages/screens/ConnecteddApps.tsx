import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import { FaArrowLeft, FaGlobe, FaExclamationTriangle } from "react-icons/fa";
import Button from "@/components/Button";
import { Switch } from "@/components/Switch";

// Define the dApp interface
interface DApp {
  id: number;
  name: string;
  url: string;
  icon: string;
  lastAccessed: string;
  permissions: string[];
  autoApprove: boolean;
}

const ConnectedDapps: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleBack = (): void => {
    navigate("/home", { state: { openSettingsModal: true } });
  };

  // Mock data for connected dApps
  const [connectedDapps, setConnectedDapps] = useState<DApp[]>([
    {
      id: 1,
      name: "Solana DEX",
      url: "app.solanadex.io",
      icon: "https://via.placeholder.com/40",
      lastAccessed: "2 hours ago",
      permissions: ["View address", "Sign transactions"],
      autoApprove: false,
    },
    {
      id: 2,
      name: "NFT Marketplace",
      url: "nftmarketplace.io",
      icon: "https://via.placeholder.com/40",
      lastAccessed: "Yesterday",
      permissions: ["View address", "Sign transactions", "Auto-approve"],
      autoApprove: true,
    },
  ]);

  const handleToggleAutoApprove = (dappId: number): void => {
    setConnectedDapps(
      connectedDapps.map((dapp) =>
        dapp.id === dappId ? { ...dapp, autoApprove: !dapp.autoApprove } : dapp
      )
    );
  };

  const handleDisconnect = (dappId: number): void => {
    // Show confirmation dialog in a real implementation
    setConnectedDapps(connectedDapps.filter((dapp) => dapp.id !== dappId));
  };

  const handleDisconnectAll = (): void => {
    // Show confirmation dialog in a real implementation
    setConnectedDapps([]);
  };

  const filteredDapps = connectedDapps.filter(
    (dapp) =>
      dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dapp.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200 max-w-md h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200">
        <FaArrowLeft onClick={handleBack} className="w-5 h-5 cursor-pointer" />
        <div className="flex-1 text-center">
          <Heading text="Connected dApps" />
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search dApps..."
            className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
          />
        </div>
      </div>

      {/* Content */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 180px)" }}
      >
        {filteredDapps.length > 0 ? (
          <>
            {/* Connected dApps list */}
            <div className="p-4 space-y-4">
              {filteredDapps.map((dapp) => (
                <div
                  key={dapp.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* dApp header */}
                  <div className="flex items-center p-4 bg-gray-50">
                    <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden mr-3">
                      <img
                        src="/api/placeholder/40/40"
                        alt={dapp.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{dapp.name}</h3>
                      <div className="flex items-center text-xs text-gray-500">
                        <FaGlobe className="mr-1" />
                        <span>{dapp.url}</span>
                      </div>
                    </div>
                    <div className="text-xs text-right text-gray-500">
                      Last used <br /> {dapp.lastAccessed}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="p-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-2">Permissions</h4>
                    <div className="space-y-2">
                      {dapp.permissions.map((permission, idx) => (
                        <div key={idx} className="flex items-center text-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span>{permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm mr-3">Auto-approve</span>
                      <Switch
                        checked={dapp.autoApprove}
                        onChange={() => handleToggleAutoApprove(dapp.id)}
                      />
                    </div>
                    <Button
                      text="Disconnect"
                      onClick={() => handleDisconnect(dapp.id)}
                      className="text-red-500 bg-white border border-red-300 hover:bg-red-50 text-sm px-3 py-1"
                    />
                  </div>

                  {/* Warning for auto-approve */}
                  {dapp.autoApprove && (
                    <div className="p-3 bg-yellow-50 border-t border-yellow-200 flex items-start">
                      <FaExclamationTriangle className="text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-xs text-yellow-700">
                        Auto-approve is enabled. This dApp can request
                        transaction approvals without prompting you.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          // Empty state
          <div className="p-8 text-center">
            {searchQuery ? (
              <>
                <p className="text-gray-500 mb-2">
                  No dApps match "{searchQuery}"
                </p>
                <Button
                  onClick={() => setSearchQuery("")}
                  text="Clear search"
                  className="text-blue-500 bg-white border border-blue-300 hover:bg-blue-50"
                />
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaGlobe className="text-gray-400 text-xl" />
                </div>
                <h3 className="font-medium text-gray-800 mb-1">
                  No connected dApps
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  When you connect to dApps, they will appear here
                </p>
              </>
            )}
          </div>
        )}
      </div>
      {/* Footer with actions */}
      {connectedDapps.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleDisconnectAll}
            text="Disconnect All dApps"
            className="w-full text-red-500 bg-white border border-red-300 hover:bg-red-50"
          />
        </div>
      )}
    </div>
  );
};

export default ConnectedDapps;
