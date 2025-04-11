import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import Button from "@/components/Button";

interface ConnectionRequest {
  id: string;
  origin: string;
  url: string;
  appName: string;
  appIcon?: string;
  timestamp: number;
  permissions: string[];
}

const WalletConnectionRequest: React.FC = () => {
  const [request, setRequest] = useState<ConnectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Parse the request ID from the URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const requestId = queryParams.get("requestId");
    const connectionType = queryParams.get("type");

    // Only handle standard wallet connections in this component
    if (connectionType !== "wallet-standard") {
      navigate("/permissions-request" + location.search);
      return;
    }

    if (requestId) {
      // Fetch the connection request details from the background script
      chrome.runtime.sendMessage(
        { action: "get_permission_request", requestId },
        (response) => {
          if (response.success && response.request) {
            setRequest(response.request);
          } else {
            // If the request doesn't exist, navigate back to home
            navigate("/home");
          }
          setLoading(false);
        }
      );
    } else {
      // If no request ID is provided, try to get any pending requests
      chrome.runtime.sendMessage(
        { action: "get_pending_permission_requests" },
        (response) => {
          if (
            response.success &&
            response.requests &&
            response.requests.length > 0
          ) {
            // Take the first pending request
            setRequest(response.requests[0]);
          } else {
            // If no pending requests, navigate back to home
            navigate("/home");
          }
          setLoading(false);
        }
      );
    }
  }, [location.search, navigate]);

  const handleApprove = () => {
    if (!request) return;
    chrome.runtime.sendMessage(
      {
        action: "resolve_permission_request",
        requestId: request.id,
        approved: true,
        permissions: request.permissions,
        walletStandard: true,
      },
      (response) => {
        if (response.success) {
          // Add a short delay before navigating
          setTimeout(() => {
            window.close();
          }, 500);
        }
      }
    );
  };

  const handleDeny = () => {
    if (!request) return;
    chrome.runtime.sendMessage(
      {
        action: "resolve_permission_request",
        requestId: request.id,
        approved: false,
        walletStandard: true, // Flag to indicate this is a wallet standard request
      },
      (response) => {
        if (response.success) {
          // Navigate back to home after denial
          navigate("/home");
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <p className="text-xl text-gray-900">Loading...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <p className="text-xl text-gray-900">No connection request found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="text-center p-4 border-b border-gray-200">
        <Heading text="Connect Wallet" />
      </div>

      <div className="p-4">
        <div className="bg-white rounded-lg w-full overflow-hidden">
          {/* App Logo/Header */}
          <div className="flex flex-col items-center mb-4">
            {request.appIcon ? (
              <img
                src={request.appIcon}
                alt={`${request.appName} logo`}
                className="w-16 h-16 rounded-full mb-2"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-gray-600">++</span>
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              Connection Request
            </h3>
          </div>

          {/* App Details */}
          <div className="mb-4">
            <div className="text-xl font-semibold text-gray-900">
              {request.appName}
            </div>
            <div className="text-sm text-gray-500">{request.origin}</div>
          </div>

          {/* Info Message */}
          <div className="text-sm text-gray-600 mb-4">
            <p className="mb-2">
              This application would like to connect to your Swig wallet.
              Connecting will allow the application to see your wallet address.
            </p>
            <p className="text-yellow-600 font-medium">
              Only connect with websites you trust.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              text="Reject"
              onClick={handleDeny}
              className="bg-gray-400 text-white text-[16px] w-full p-4"
            />
            <Button
              text="Connect"
              onClick={handleApprove}
              className="bg-blue-600 text-white text-[16px] w-full p-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletConnectionRequest;
