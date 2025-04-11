import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import {
  FaArrowLeft,
  FaCode,
  FaNetworkWired,
  FaBug,
  FaExchangeAlt,
  FaServer,
} from "react-icons/fa";
import Button from "@/components/Button";
import { Switch } from "@/components/Switch";

const DeveloperTools = () => {
  const navigate = useNavigate();
  const [testnetMode, setTestnetMode] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [selectedRPC, setSelectedRPC] = useState("mainnet");

  const handleBack = () => {
    navigate("/home", { state: { openSettingsModal: true } });
  };

  const networks = [
    { id: "mainnet", name: "Mainnet", url: "https://api.mainnet.solana.com" },
    { id: "testnet", name: "Testnet", url: "https://api.testnet.solana.com" },
    { id: "devnet", name: "Devnet", url: "https://api.devnet.solana.com" },
    { id: "localhost", name: "Localhost", url: "http://localhost:8899" },
  ];

  const toggleTestnetMode = () => {
    setTestnetMode(!testnetMode);
    // Logic to switch network would go here
  };

  const toggleAutoApprove = () => {
    setAutoApprove(!autoApprove);
  };

  const toggleLogging = () => {
    setLoggingEnabled(!loggingEnabled);
  };

  const handleNetworkChange = (networkId: string) => {
    setSelectedRPC(networkId);
    // Logic to connect to selected network would go here
  };

  const handleCustomRPC = () => {
    // Modal for custom RPC input would go here
    navigate("/developer/custom-rpc");
  };

  const handleViewLogs = () => {
    navigate("/developer/logs");
  };

  const handleResetCache = () => {
    // Logic to clear application cache would go here
    alert("Cache has been cleared");
  };

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200 max-w-md h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200">
        <FaArrowLeft onClick={handleBack} className="w-5 h-5 cursor-pointer" />
        <div className="flex-1 text-center">
          <Heading text="Developer Tools" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Testnet Mode */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaNetworkWired className="text-blue-500" />
              <h3 className="font-medium">Testnet Mode</h3>
            </div>
            <Switch checked={testnetMode} onCheckedChange={toggleTestnetMode} />
          </div>
          <p className="text-sm text-gray-600">
            When enabled, your wallet will connect to testnet by default. This
            is recommended for development.
          </p>
        </div>

        {/* Network Selection */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <FaServer className="text-blue-500" />
            <h3 className="font-medium">Network</h3>
          </div>
          <div className="space-y-2">
            {networks.map((network) => (
              <div
                key={network.id}
                onClick={() => handleNetworkChange(network.id)}
                className={`p-3 rounded-md cursor-pointer flex justify-between items-center ${
                  selectedRPC === network.id
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div>
                  <p className="font-medium">{network.name}</p>
                  <p className="text-xs text-gray-500">{network.url}</p>
                </div>
                {selectedRPC === network.id && (
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                )}
              </div>
            ))}
            <Button
              onClick={handleCustomRPC}
              text="Add Custom RPC"
              className="w-full mt-2 text-blue-500 bg-white border border-blue-300 hover:bg-blue-50"
            ></Button>
          </div>
        </div>

        {/* Auto-approve transactions */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaExchangeAlt className="text-blue-500" />
              <h3 className="font-medium">Auto-approve Transactions</h3>
            </div>
            <Switch checked={autoApprove} onCheckedChange={toggleAutoApprove} />
          </div>
          <p className="text-sm text-gray-600">
            Automatically approve transactions for faster testing. Use with
            caution!
          </p>
        </div>

        {/* Debug logging */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaBug className="text-blue-500" />
              <h3 className="font-medium">Debug Logging</h3>
            </div>
            <Switch checked={loggingEnabled} onCheckedChange={toggleLogging} />
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Enable detailed logging for better debugging of transactions and
            interactions.
          </p>
          {loggingEnabled && (
            <Button
              text="View Logs"
              onClick={handleViewLogs}
              className="w-full text-blue-500 bg-white border border-blue-300 hover:bg-blue-50"
            ></Button>
          )}
        </div>

        {/* Advanced Actions */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <FaCode className="text-blue-500" />
            <h3 className="font-medium">Advanced</h3>
          </div>
          <div className="space-y-2">
            <Button
              text="Reset Cache & Local Storage"
              onClick={handleResetCache}
              className="w-full text-red-500 bg-white border border-red-200 hover:bg-red-50"
            ></Button>
          </div>
        </div>

        {/* Developer Documentation */}
        <div className="mt-6 text-center">
          <a
            href="https://docs.yourwallet.com/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 text-sm hover:underline"
          >
            View Developer Documentation
          </a>
        </div>
      </div>
    </div>
  );
};

export default DeveloperTools;
