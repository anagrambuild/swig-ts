// State to store permission requests
interface PermissionRequest {
  id: string;
  origin: string;
  url: string | undefined;
  appName: string;
  appIcon?: string;
  permissions: string[];
  timestamp: number;
  solRequired?: number;
  tokenAmounts?: Array<{ token: string; amount: number }>;
  type?: string;
  navigate?: {
    screen: string;
    params?: {
      requestedPermission?: string;
      [key: string]: any;
    };
  };
}

// Track pending permission requests
const pendingPermissionRequests: Record<string, PermissionRequest> = {};

// Mock wallet state for development (replace with real implementation)
let walletState = {
  connected: false,
  publicKey: "CgHZaWrdZ6oUHVsu7WntKxp1JqNNnmiT5BGPXbicF5F",
  selectedRole: "default",
  approvedPermissions: [] as string[],
};

// Keep the service worker alive
let keepAliveInterval: ReturnType<typeof setInterval>;

function startKeepAlive() {
  keepAliveInterval = setInterval(() => {
    console.log(
      "Background service worker alive: " + new Date().toLocaleTimeString()
    );
  }, 20000); // Every 20 seconds
}

// Generate a unique ID for permission requests
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Start the keep-alive on initialization
startKeepAlive();

// Navigate to the permissions request page
function navigateToPermissionsRequest(requestId: string) {
  // Get the navigation info from the stored request
  const request = pendingPermissionRequests[requestId];
  const navigateInfo = request?.navigate || { screen: "permissions-request" };

  let url = chrome.runtime.getURL(
    `index.html#/${
      navigateInfo.screen || "permissions-request"
    }?requestId=${requestId}`
  );

  if (navigateInfo.params) {
    const queryString = Object.entries(navigateInfo.params)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");

    if (queryString) {
      url += `&${queryString}`;
    }
  }

  console.log("Navigating to permissions request:", {
    requestId,
    navigateInfo,
    request: pendingPermissionRequests[requestId], // Add full request logging for debugging
  });

  // Try to use the storage approach first (more reliable)
  chrome.storage.local.set(
    {
      currentPermissionRequest: {
        requestId,
        screen: navigateInfo.screen || "permissions-request",
        params: navigateInfo.params || {},
      },
    },
    () => {
      // After setting the storage, try to open the popup
      try {
        // This will open the popup, which should check storage on load
        chrome.action.openPopup();

        // As a backup, also try sending a direct message
        chrome.runtime.sendMessage(
          {
            action: "navigate_to_permissions_request",
            requestId,
            screen: navigateInfo.screen,
            params: navigateInfo.params,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Navigation message error:",
                chrome.runtime.lastError
              );
            } else {
              console.log("Navigation message successful:", response);
            }
          }
        );
      } catch (error) {
        console.error("Error opening popup:", error);

        // Fallback: Open in a new tab if popup fails
        let url = chrome.runtime.getURL(
          `index.html#/${
            navigateInfo.screen || "permissions-request"
          }?requestId=${requestId}`
        );

        // Add params as query parameters if available
        if (navigateInfo.params) {
          const queryString = Object.entries(navigateInfo.params)
            .map(
              ([key, value]) => `${key}=${encodeURIComponent(String(value))}`
            )
            .join("&");

          if (queryString) {
            url += `&${queryString}`;
          }
        }

        console.log("Opening in new tab:", url);
        chrome.tabs.create({ url });
      }
    }
  );
}

// Listen for external messages (from websites)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log("Received external message:", message, "from:", sender?.url);

    // Check if this is an open request
    if (message && message.action === "open_popup") {
      console.log("Opening popup...");

      try {
        // This doesn't work in MV3, but we'll try anyway
        chrome.action.openPopup();
        sendResponse({ success: true, message: "Extension opened" });
      } catch (error: unknown) {
        console.error("Error opening popup:", error);
        try {
          // Alternative: Open the extension in a new tab
          chrome.tabs.create({
            url: chrome.runtime.getURL("index.html"),
          });
          sendResponse({ success: true, message: "Extension opened in tab" });
        } catch (tabError) {
          console.error("Error opening extension in tab:", tabError);
          if (error instanceof Error) {
            sendResponse({ success: false, error: error.message });
          } else {
            sendResponse({
              success: false,
              error: "An unknown error occurred",
            });
          }
        }
      }
    }

    // Handle permission request from a native Swig app
    else if (message && message.action === "request_permissions") {
      console.log("Received permission request:", message);

      if (!sender?.url) {
        sendResponse({ success: false, error: "Missing sender URL" });
        return true;
      }

      if (!message.appName || !Array.isArray(message.permissions)) {
        sendResponse({
          success: false,
          error: "Invalid permission request format",
        });
        return true;
      }

      try {
        const requestId = generateRequestId();
        const origin = new URL(sender.url).origin;

        // Store the permission request with any navigation info
        pendingPermissionRequests[requestId] = {
          id: requestId,
          origin,
          url: sender.url,
          appName: message.appName,
          appIcon: message.appIcon || "",
          permissions: message.permissions,
          solRequired: message.solRequired || 0,
          tokenAmounts: message.tokenAmounts || [],
          timestamp: Date.now(),
          // Store navigation information if provided
          navigate: message.navigate || { screen: "permissions-request" },
        };

        // Then call your navigateToPermissionsRequest function with the requestId
        navigateToPermissionsRequest(requestId);

        sendResponse({
          success: true,
          message: "Permission request received",
          requestId,
        });
      } catch (error: unknown) {
        console.error("Error processing permission request:", error);
        if (error instanceof Error) {
          sendResponse({ success: false, error: error.message });
        } else {
          sendResponse({ success: false, error: "An unknown error occurred" });
        }
      }
    }

    // Handle additional permissions request
    else if (message && message.action === "request_additional_permissions") {
      console.log("Received additional permission request:", message);

      if (!sender?.url) {
        sendResponse({ success: false, error: "Missing sender URL" });
        return true;
      }

      if (!message.appName || !Array.isArray(message.permissions)) {
        sendResponse({
          success: false,
          error: "Invalid permission request format",
        });
        return true;
      }

      try {
        const requestId = generateRequestId();
        const origin = new URL(sender.url).origin;

        // Store the permission request
        pendingPermissionRequests[requestId] = {
          id: requestId,
          origin,
          url: sender.url,
          appName: message.appName,
          appIcon: message.appIcon || "",
          permissions: message.permissions,
          timestamp: Date.now(),
        };

        // Send a message to the popup or open it
        navigateToPermissionsRequest(requestId);

        sendResponse({
          success: true,
          message: "Additional permission request received",
          requestId,
        });
      } catch (error: unknown) {
        console.error("Error processing additional permission request:", error);
        if (error instanceof Error) {
          sendResponse({ success: false, error: error.message });
        } else {
          sendResponse({ success: false, error: "An unknown error occurred" });
        }
      }
    }

    // Check status of a permission request
    else if (
      message &&
      message.action === "check_permission_status" &&
      message.requestId
    ) {
      const requestId = message.requestId;
      const request = pendingPermissionRequests[requestId];

      if (!request) {
        sendResponse({ success: false, error: "Permission request not found" });
        return true;
      }

      // Check if we have a result for this request in storage
      chrome.storage.local.get(["permission_results"], (result) => {
        const permissionResults = result.permission_results || {};

        if (permissionResults[requestId]) {
          const permResult = permissionResults[requestId];

          // Clean up after sending the result
          delete pendingPermissionRequests[requestId];

          // Remove from storage to avoid clutter
          delete permissionResults[requestId];
          chrome.storage.local.set({ permission_results: permissionResults });

          sendResponse({
            success: true,
            status: "completed",
            approved: permResult.approved,
            publicKey: walletState.publicKey,
            role: walletState.selectedRole,
            permissions: permResult.permissions,
          });
        } else {
          // Request still pending
          sendResponse({
            success: true,
            status: "pending",
          });
        }
      });
    }

    // Handle sign transaction request
    else if (message && message.action === "sign_transaction") {
      console.log("Received sign transaction request:", message);

      // Check if the wallet is connected
      if (!walletState.connected) {
        sendResponse({ success: false, error: "Wallet not connected" });
        return true;
      }

      // Check if the wallet has the required permission
      if (!walletState.approvedPermissions.includes("sign_transactions")) {
        sendResponse({
          success: false,
          error: "Permission denied: Missing sign_transactions permission",
        });
        return true;
      }

      // TODO: Implement actual transaction signing logic here
      // For now, we'll just generate a mock signature
      const mockSignature =
        "sig_" + Math.random().toString(36).substring(2, 15);

      sendResponse({
        success: true,
        signature: mockSignature,
      });
    }

    // Handle sign all transactions request
    else if (message && message.action === "sign_all_transactions") {
      console.log("Received sign all transactions request:", message);

      // Check if the wallet is connected
      if (!walletState.connected) {
        sendResponse({ success: false, error: "Wallet not connected" });
        return true;
      }

      // Check if the wallet has the required permission
      if (!walletState.approvedPermissions.includes("sign_transactions")) {
        sendResponse({
          success: false,
          error: "Permission denied: Missing sign_transactions permission",
        });
        return true;
      }

      // TODO: Implement actual transaction signing logic here
      // For now, we'll just generate mock signatures
      const mockSignatures = message.transactions.map(
        () => "sig_" + Math.random().toString(36).substring(2, 15)
      );

      sendResponse({
        success: true,
        signatures: mockSignatures,
      });
    }

    // Handle sign message request
    else if (message && message.action === "sign_message") {
      console.log("Received sign message request:", message);

      // Check if the wallet is connected
      if (!walletState.connected) {
        sendResponse({ success: false, error: "Wallet not connected" });
        return true;
      }

      // Check if the wallet has the required permission
      if (!walletState.approvedPermissions.includes("sign_transactions")) {
        // Usually sign_message would be its own permission
        sendResponse({
          success: false,
          error: "Permission denied: Missing sign permission",
        });
        return true;
      }

      // TODO: Implement actual message signing logic here
      // For now, we'll just generate a mock signature
      const mockSignature =
        "msg_sig_" + Math.random().toString(36).substring(2, 15);

      sendResponse({
        success: true,
        signature: mockSignature,
      });
    }

    // Check if the wallet is connected
    else if (message && message.action === "is_connected") {
      sendResponse({
        success: true,
        connected: walletState.connected,
      });
    }

    // Handle disconnect request
    else if (message && message.action === "disconnect") {
      // Set the wallet state to disconnected immediately
      walletState.connected = false;
      walletState.approvedPermissions = [];

      // Send the response immediately
      sendResponse({
        success: true,
        message: "Wallet disconnected successfully",
      });

      // Then do any additional cleanup asynchronously
      if (sender?.url) {
        const origin = new URL(sender.url).origin;
        chrome.storage.local.get(["connected_sites"], (result) => {
          const connectedSites = result.connected_sites || {};
          delete connectedSites[origin];
          chrome.storage.local.set({ connected_sites: connectedSites });
        });
      }

      // Return false to indicate synchronous response
      return false;
    }

    // Handle standard wallet connect request
    else if (message && message.action === "connect") {
      if (!sender?.url) {
        sendResponse({ success: false, error: "Missing sender URL" });
        return true;
      }

      try {
        const requestId = message.permissionResultId || generateRequestId();
        const origin =
          message.origin ||
          (sender?.url ? new URL(sender.url).origin : "unknown");
        const connectionType = message.type || "wallet-standard";

        // Determine which screen to navigate to based on the type
        const screenName =
          connectionType === "wallet-standard"
            ? "connect-wallet"
            : "permissions-request";

        // Store the permission request
        pendingPermissionRequests[requestId] = {
          id: requestId,
          origin,
          url: sender.url,
          appName: message.appName || "Unknown App",
          appIcon: message.appIcon || "",
          permissions: message.permissions || [
            "view_balance",
            "sign_transactions",
          ],
          timestamp: Date.now(),
          // Include the type in the request
          type: connectionType,
          // Set the navigation based on the connection type
          navigate: {
            screen: screenName,
            params: {
              type: connectionType,
              // Include any other params needed
            },
          },
        };
        // Open the popup to handle permission
        navigateToPermissionsRequest(requestId);

        sendResponse({
          success: true,
          message: "Connection request received",
          requestId,
        });
      } catch (error) {
        console.error("Error processing connect request:", error);
        if (error instanceof Error) {
          sendResponse({ success: false, error: error.message });
        } else {
          sendResponse({ success: false, error: "An unknown error occurred" });
        }
      }
    }

    // Return true to indicate you'll send a response asynchronously
    return true;
  }
);

// Listen for messages from content scripts and extension pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "get_pending_permission_requests") {
    sendResponse({
      success: true,
      requests: Object.values(pendingPermissionRequests),
    });
  } else if (message && message.action === "get_permission_request") {
    const requestId = message.requestId;
    if (!requestId) {
      sendResponse({ success: false, error: "Missing requestId" });
      return true;
    }

    const request = pendingPermissionRequests[requestId];
    if (!request) {
      sendResponse({ success: false, error: "Permission request not found" });
      return true;
    }

    sendResponse({
      success: true,
      request,
    });
  } else if (message && message.action === "resolve_permission_request") {
    const { requestId, approved, permissions } = message;

    if (!requestId || approved === undefined) {
      sendResponse({ success: false, error: "Invalid resolution format" });
      return true;
    }

    const request = pendingPermissionRequests[requestId];
    if (!request) {
      sendResponse({ success: false, error: "Permission request not found" });
      return true;
    }

    // Store the result in local storage so it can be retrieved by checkPermissionStatus
    chrome.storage.local.get(["permission_results"], (result) => {
      const permissionResults = result.permission_results || {};
      permissionResults[requestId] = {
        approved,
        permissions: approved ? permissions || request.permissions : [],
      };

      chrome.storage.local.set(
        { permission_results: permissionResults },
        () => {
          // After storage update completes, verify it's there
          chrome.storage.local.get(["permission_results"], (check) => {
            console.log(
              "Verification - permission results in storage:",
              check.permission_results
            );

            // If approved, update the wallet state
            if (approved) {
              walletState.connected = true;
              walletState.approvedPermissions =
                permissions || request.permissions;
            }

            // Remove from pending requests AFTER verification
            setTimeout(() => {
              delete pendingPermissionRequests[requestId];
            }, 5000);

            sendResponse({ success: true });
          });
        }
      );
    });
  } else if (message && message.action === "connect") {
    try {
      const requestId = message.permissionResultId || generateRequestId();
      const origin =
        message.origin ||
        (sender?.url ? new URL(sender.url).origin : "unknown");
      const connectionType = message.type || "wallet-standard"; // Default to wallet-standard

      // Determine which screen to navigate to based on the type
      const screenName =
        connectionType === "wallet-standard"
          ? "connect-wallet"
          : "permissions-request";

      // Store the permission request
      pendingPermissionRequests[requestId] = {
        id: requestId,
        origin,
        url: sender.url,
        appName: message.appName || "Unknown App",
        appIcon: message.appIcon || "",
        permissions: message.permissions || [
          "view_balance",
          "sign_transactions",
        ],
        timestamp: Date.now(),
        // Include the type in the request
        type: connectionType,
        // Set the navigation based on the connection type
        navigate: {
          screen: screenName,
          params: {
            type: connectionType,
            // Include any other params needed
          },
        },
      };

      // Open the popup to handle permission
      navigateToPermissionsRequest(requestId);

      sendResponse({
        success: true,
        message: "Connection request received",
        requestId,
      });
    } catch (error) {
      console.error("Error processing connect request:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else if (
    message &&
    message.action === "check_permission_status" &&
    message.requestId
  ) {
    const requestId = message.requestId;

    const request = pendingPermissionRequests[requestId];
    if (!request) {
      console.log("Request not found in pending requests:", requestId);
      sendResponse({ success: false, error: "Permission request not found" });
      return true;
    }

    // Check if we have a result for this request in storage
    chrome.storage.local.get(["permission_results"], (result) => {
      const permissionResults = result.permission_results || {};

      if (permissionResults[requestId]) {
        const permResult = permissionResults[requestId];

        // Clean up after sending the result
        delete pendingPermissionRequests[requestId];

        // Remove from storage to avoid clutter
        delete permissionResults[requestId];
        chrome.storage.local.set({ permission_results: permissionResults });

        sendResponse({
          success: true,
          status: "completed",
          approved: permResult.approved,
          publicKey: walletState.publicKey,
          role: walletState.selectedRole,
          permissions: permResult.permissions,
        });
      } else {
        sendResponse({
          success: true,
          status: "pending",
        });
      }
    });

    // check if connection request has been approved
  } else if (
    message &&
    message.action === "check_permission_status" &&
    message.requestId
  ) {
    const requestId = message.requestId;

    // First check if we have a result for this request in storage
    chrome.storage.local.get(["permission_results"], (result) => {
      const permissionResults = result.permission_results || {};

      if (permissionResults[requestId]) {
        // We have a result in storage - return it
        const permResult = permissionResults[requestId];

        // Remove from storage to avoid clutter
        delete permissionResults[requestId];
        chrome.storage.local.set({ permission_results: permissionResults });

        sendResponse({
          success: true,
          status: "completed",
          approved: permResult.approved,
          publicKey: walletState.publicKey,
          role: walletState.selectedRole,
          permissions: permResult.permissions,
        });
      } else {
        // No result in storage, check pending requests
        const request = pendingPermissionRequests[requestId];
        if (!request) {
          sendResponse({
            success: false,
            error: "Permission request not found",
          });
        } else {
          sendResponse({
            success: true,
            status: "pending",
          });
        }
      }
    });

    return true;
  }

  return true;
});

// Log when the service worker is started
console.log(
  "Background service worker initialized: " + new Date().toLocaleTimeString()
);
