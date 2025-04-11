import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import Button from "@/components/Button";

interface PermissionRequest {
  id: string;
  origin: string;
  url: string;
  appName: string;
  appIcon?: string;
  permissions: string[];
  timestamp: number;
  solRequired?: number;
  tokenAmounts?: Array<{ token: string; amount: number }>;
  navigate?: {
    screen?: string;
    params?: {
      requestedPermission?: string;
      [key: string]: any;
    };
  };
}

const PermissionsRequest: React.FC = () => {
  const [request, setRequest] = useState<PermissionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlightedPermission, setHighlightedPermission] = useState<
    string | null
  >(null);
  const location = useLocation();
  const navigate = useNavigate();

  console.log("PermissionsRequest loading");

  // Parse the request ID from the URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const requestId = queryParams.get("requestId");
    const specificPermission = queryParams.get("permission");

    if (specificPermission) {
      setHighlightedPermission(specificPermission);
    }

    if (requestId) {
      // Fetch the permission request details from the background script
      chrome.runtime.sendMessage(
        { action: "get_permission_request", requestId },
        (response) => {
          if (response.success && response.request) {
            setRequest(response.request);

            // Check for highlighted permission from navigation params
            if (response.request.navigate?.params?.requestedPermission) {
              setHighlightedPermission(
                response.request.navigate.params.requestedPermission
              );
            }
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

            // Check for highlighted permission from navigation params
            if (response.requests[0].navigate?.params?.requestedPermission) {
              setHighlightedPermission(
                response.requests[0].navigate.params.requestedPermission
              );
            }
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
        permissions: request.permissions, // Use all permissions from the request
      },
      (response) => {
        if (response.success) {
          // Navigate back to home after approval
          navigate("/home");
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
      },
      (response) => {
        if (response.success) {
          // Navigate back to home after denial
          navigate("/home");
        }
      }
    );
  };

  // Format permission text for display
  const formatPermission = (permission: string) => {
    return permission
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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
        <p className="text-xl text-gray-900">No permission request found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="text-center p-4 border-b border-gray-200">
        <Heading text="Connect Wallet Screen" />
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
              Request to connect with Swig
            </h3>
          </div>

          {/* App Details */}
          <div className="mb-4">
            <div className="text-xl font-semibold text-gray-900">
              {request.appName}
            </div>
            <div className="text-sm text-gray-500">{request.origin}</div>
          </div>

          {/* Highlighted Permission (if a specific one was requested) */}
          {highlightedPermission && (
            <div className="p-3 bg-blue-50 rounded-lg mb-4">
              <p className="text-sm text-blue-700 mb-1">
                Specifically requesting:
              </p>
              <p className="text-lg font-medium text-blue-800">
                {formatPermission(highlightedPermission)}
              </p>
            </div>
          )}

          {/* SOL Required Section - Only show if solRequired > 0 */}
          {request.solRequired && request.solRequired > 0 && (
            <div className="p-3 bg-yellow-50 rounded-lg mb-4">
              <p className="text-sm text-yellow-700 mb-1">
                SOL Required for Transaction Fees:
              </p>
              <p className="text-lg font-medium text-yellow-800">
                {request.solRequired} SOL
              </p>
            </div>
          )}

          {/* Permissions Section */}
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <h4 className="text-md text-gray-700 font-medium mb-2">
              Requested permissions:
            </h4>
            <div className="space-y-2">
              {request.permissions.map((permission) => (
                <div
                  key={permission}
                  className={`py-2 border-b border-gray-200 last:border-0 ${
                    permission === highlightedPermission
                      ? "bg-blue-50 px-2 -mx-2 rounded"
                      : ""
                  }`}
                >
                  <div className="flex items-center">
                    <span
                      className={`text-md text-gray-800 ${
                        permission === highlightedPermission
                          ? "font-medium"
                          : ""
                      }`}
                    >
                      {formatPermission(permission)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token Amounts Section - Only show if tokenAmounts has items */}
          {request.tokenAmounts && request.tokenAmounts.length > 0 && (
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <h4 className="text-md text-gray-700 font-medium mb-2">
                Token Permissions:
              </h4>
              <div className="space-y-2">
                {request.tokenAmounts.map((item) => (
                  <div
                    key={item.token}
                    className="py-2 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-md text-gray-800">
                        {item.token}
                      </span>
                      <span className="text-md font-medium text-gray-900">
                        {item.amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Message */}
          <div className="text-sm text-gray-600 mb-4">
            <p className="mb-2">
              Granting access will enable {request.appName} to create a
              permissions account that you can view in settings
            </p>
            <p className="text-yellow-600 font-medium">
              Only grant access for permissions to websites that you trust
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              text="Deny"
              onClick={handleDeny}
              className="bg-gray-400 text-white text-[16px] w-full p-4"
            />
            <Button
              text="Approve"
              onClick={handleApprove}
              className="bg-blue-600 text-white text-[16px] w-full p-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsRequest;
