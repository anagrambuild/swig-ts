import { SwigWallet } from "./types";

console.log("Swig content script loaded");

// needed from solana wallet standard
// connect()
// signTransaction()
// signAndSendTransaction()
// TODO - a swig aware dapp should pass the flag "isSwig: true" to the connect() method
// like this
// window.swigWallet.connect({
//   appName: "My Swig dApp",
//   permissions: ["view_balance", "sign_transactions"],
//   isSwig: true  // This flag identifies it as Swig-aware
// });

// Helper function to generate unique message IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Create a function to inject the Swig API into the page
function injectSwigAPI() {
  // Create the Swig API object
  const swigWalletAPI: SwigWallet = {
    isSwigWallet: true,

    isConnected: async () => {
      return new Promise((resolve) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            resolve(response.connected);
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "is_connected",
            },
          })
        );
      });
    },

    connect: async (options: any = {}) => {
      return new Promise((resolve) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            resolve(response.result);
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Get the current URL origin and favicon
        const origin = window.location.origin;
        let favicon = "";
        const iconLink = document.querySelector(
          'link[rel="icon"]'
        ) as HTMLLinkElement;
        if (iconLink && iconLink.href) {
          favicon = iconLink.href;
        } else {
          const shortcutIconLink = document.querySelector(
            'link[rel="shortcut icon"]'
          ) as HTMLLinkElement;
          if (shortcutIconLink && shortcutIconLink.href) {
            favicon = shortcutIconLink.href;
          } else {
            favicon = origin + "/favicon.ico";
          }
        }

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "connect",
              permissions: options.permissions || [
                "view_balance",
                "sign_transactions",
              ],
              appName: options.appName || document.title,
              appIcon: options.appIcon || favicon,
              origin: origin,
            },
          })
        );
      });
    },

    disconnect: async () => {
      return new Promise((resolve) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            resolve();
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "disconnect",
            },
          })
        );
      });
    },

    signTransaction: async (transaction: any) => {
      return new Promise((resolve, reject) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({
                success: true,
                signature: response.signature,
              });
            }
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "sign_transaction",
              transaction,
            },
          })
        );
      });
    },

    signAllTransactions: async (transactions: any[]) => {
      return new Promise((resolve, reject) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({
                success: true,
                signatures: response.signatures,
              });
            }
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "sign_all_transactions",
              transactions,
            },
          })
        );
      });
    },

    signMessage: async (message: Uint8Array) => {
      return new Promise((resolve, reject) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({
                success: true,
                signature: response.signature,
              });
            }
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "sign_message",
              message: Array.from(message), // Convert Uint8Array to regular array for event transfer
            },
          })
        );
      });
    },

    requestPermissions: async (permissions: string[]) => {
      return new Promise((resolve, reject) => {
        const messageId = generateId();

        // Set up a one-time listener for the response
        const listener = (event: CustomEvent) => {
          const response = event.detail;
          if (response.messageId === messageId) {
            window.removeEventListener(
              "swig-wallet-response",
              listener as EventListener
            );
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve({
                success: true,
                approvedPermissions: response.approvedPermissions,
              });
            }
          }
        };

        window.addEventListener(
          "swig-wallet-response",
          listener as EventListener
        );

        // Get app info
        const origin = window.location.origin;
        let favicon = "";
        const iconLink = document.querySelector(
          'link[rel="icon"]'
        ) as HTMLLinkElement;
        if (iconLink && iconLink.href) {
          favicon = iconLink.href;
        } else {
          favicon = origin + "/favicon.ico";
        }

        // Dispatch the message to the content script
        window.dispatchEvent(
          new CustomEvent("swig-wallet-request", {
            detail: {
              messageId,
              action: "request_permissions",
              permissions,
              appName: document.title,
              appIcon: favicon,
              origin: origin,
            },
          })
        );
      });
    },
  };

  // Inject the Swig API into the window object
  window.swigWallet = swigWalletAPI;

  // Dispatch an event to let the page know the Swig wallet is available
  window.dispatchEvent(new Event("swig-wallet-loaded"));
  console.log("Swig wallet API injected into page");
}

// Listen for requests from the injected API
window.addEventListener("swig-wallet-request", async (event: Event) => {
  const customEvent = event as CustomEvent;
  const detail = customEvent.detail;
  // Using object destructuring without capturing messageId
  const { action } = detail;

  // Explicitly handle is_connected
  if (action === "is_connected") {
    // Respond immediately with a temporary connected state
    // For testing purposes, we'll respond with not connected
    console.log("Responding to is_connected request");
    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId: detail.messageId,
          connected: false,
          success: true,
        },
      })
    );
  }

  console.log("Received request from page:", action, detail);

  // Forward the request to the background script
  if (action === "connect") {
    handleConnectRequest(detail);
  } else if (action === "request_permissions") {
    handlePermissionRequest(detail);
  } else if (action === "disconnect") {
    handleDisconnectRequest(detail);
  } else if (action === "sign_transaction") {
    handleSignTransactionRequest(detail);
  } else if (action === "sign_all_transactions") {
    handleSignAllTransactionsRequest(detail);
  } else if (action === "sign_message") {
    handleSignMessageRequest(detail);
  } else if (action === "is_connected") {
    handleIsConnectedRequest(detail);
  }
});

// Handle connect request
// In content.ts
async function handleConnectRequest(detail: any) {
  const { messageId, permissions, appName, appIcon, type } = detail;

  console.log("Processing connect request:", detail);

  try {
    // Forward the request to the background script
    console.log("Forwarding connect request to background script");

    const response = await chrome.runtime.sendMessage({
      action: "connect",
      appName,
      appIcon,
      permissions,
      origin: window.location.origin,
      type: type || "wallet-standard", // Default to wallet-standard if not specified
    });

    console.log("Background script response:", response);

    if (response && response.success) {
      const requestId = response.requestId;

      // Notify the page that we're processing the request
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            processing: true,
            success: true,
          },
        })
      );

      // Start polling for the result
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max

      const checkStatus = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          console.log("Polling timed out after", maxAttempts, "attempts");
          window.dispatchEvent(
            new CustomEvent("swig-wallet-response", {
              detail: {
                messageId,
                result: {
                  success: false,
                  error: "Connection request timed out",
                },
              },
            })
          );
          return;
        }

        try {
          console.log("Checking permission status for request:", requestId);
          const statusResponse = await chrome.runtime.sendMessage({
            action: "check_permission_status",
            requestId,
          });

          console.log("Status check response:", statusResponse);

          if (statusResponse && statusResponse.status === "completed") {
            window.dispatchEvent(
              new CustomEvent("swig-wallet-response", {
                detail: {
                  messageId,
                  result: {
                    success: statusResponse.approved,
                    publicKey: statusResponse.publicKey,
                    role: statusResponse.role,
                    approvedPermissions: statusResponse.permissions,
                    error: statusResponse.approved
                      ? undefined
                      : "Permission request denied",
                  },
                },
              })
            );
          } else {
            // Continue polling
            setTimeout(checkStatus, 1000);
          }
        } catch (error) {
          console.error("Error checking permission status:", error);
          setTimeout(checkStatus, 1000);
        }
      };

      // Start polling
      setTimeout(checkStatus, 1000);
    } else {
      console.error("Failed to send connection request:", response?.error);
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            result: {
              success: false,
              error: response?.error || "Failed to send connection request",
            },
          },
        })
      );
    }
  } catch (error) {
    console.error("Error handling connect request:", error);
    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          result: {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      })
    );
  }
}

// Handle permission request
async function handlePermissionRequest(detail: any) {
  const {
    messageId,
    permissions,
    appName,
    appIcon,
    origin,
    solRequired,
    tokenAmounts,
  } = detail;

  try {
    // Send request to background script - similar to connect but for additional permissions
    const response = await chrome.runtime.sendMessage({
      action: "request_additional_permissions",
      appName,
      appIcon,
      permissions,
      origin,
      navigate: {
        screen: "permissions-request",
        params: {
          requestedPermission: permissions[0], // Assuming permissions is an array
          appName: appName,
          solRequired: solRequired,
          tokenAmounts: tokenAmounts,
        },
      },
    });

    console.log("Permission request response:", response);

    // Similar implementation as connect
    if (response && response.success) {
      // Instead of using requestId which is unused, just use _ to ignore it
      const responseId = response.requestId;
      console.log("Response ID:", responseId);

      // Temporary simplified response
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            approvedPermissions: permissions,
            success: true,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            error: response?.error || "Failed to request permissions",
            success: false,
          },
        })
      );
    }
  } catch (error) {
    console.error("Error handling permission request:", error);

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        },
      })
    );
  }
}

// Handle disconnect request
async function handleDisconnectRequest(detail: any) {
  const { messageId } = detail;

  try {
    // Send a synchronous message to the background
    chrome.runtime.sendMessage({
      action: "disconnect",
      origin: window.location.origin,
    });

    // Don't wait for the background response, immediately respond to the page
    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId: messageId,
          success: true,
        },
      })
    );
  } catch (error) {
    console.error("Error handling disconnect request:", error);
    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId: detail.messageId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
    );
  }
}

// Handle sign transaction request
async function handleSignTransactionRequest(detail: any) {
  const { messageId, transaction } = detail;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "sign_transaction",
      transaction,
    });

    if (response && response.success) {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            signature: response.signature,
            success: true,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            error: response?.error || "Failed to sign transaction",
            success: false,
          },
        })
      );
    }
  } catch (error) {
    console.error("Error handling sign transaction request:", error);

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        },
      })
    );
  }
}

// Handle sign all transactions request
async function handleSignAllTransactionsRequest(detail: any) {
  const { messageId, transactions } = detail;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "sign_all_transactions",
      transactions,
    });

    if (response && response.success) {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            signatures: response.signatures,
            success: true,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            error: response?.error || "Failed to sign transactions",
            success: false,
          },
        })
      );
    }
  } catch (error) {
    console.error("Error handling sign all transactions request:", error);

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        },
      })
    );
  }
}

// Handle sign message request
async function handleSignMessageRequest(detail: any) {
  const { messageId, message } = detail;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "sign_message",
      message,
    });

    if (response && response.success) {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            signature: response.signature,
            success: true,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-response", {
          detail: {
            messageId,
            error: response?.error || "Failed to sign message",
            success: false,
          },
        })
      );
    }
  } catch (error) {
    console.error("Error handling sign message request:", error);

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        },
      })
    );
  }
}

// Handle is connected request
async function handleIsConnectedRequest(detail: any) {
  const { messageId } = detail;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "is_connected",
    });

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          connected: response?.connected || false,
        },
      })
    );
  } catch (error) {
    console.error("Error handling is connected request:", error);

    window.dispatchEvent(
      new CustomEvent("swig-wallet-response", {
        detail: {
          messageId,
          connected: false,
        },
      })
    );
  }
}

// Inject the script into the page
const script = document.createElement("script");
script.textContent = `(${injectSwigAPI.toString()})();`;
(document.head || document.documentElement).appendChild(script);
script.remove();

console.log("Swig content script finished loading");

// Inject the wallet standard implementation
function injectWalletStandard() {
  console.log("Injecting Swig Wallet Standard implementation");
  try {
    const script = document.createElement("script");
    // Use a file from your extension instead of inline script
    script.src = chrome.runtime.getURL("injectWalletStandard.js");
    script.onload = () => {
      console.log("Swig Wallet Standard script loaded");
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error("Error injecting Swig Wallet Standard script:", error);
  }
}

// Set up communication for wallet standard requests
window.addEventListener("message", (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const data = event.data;

  // Handle wallet standard disconnect requests
  if (
    data &&
    data.type === "swig_wallet_request" &&
    data.action === "disconnect"
  ) {
    console.log("Swig Wallet Standard disconnect request received");

    // Forward the disconnect request to your existing handler
    window.dispatchEvent(
      new CustomEvent("swig-wallet-request", {
        detail: {
          messageId: data.id,
          action: "disconnect",
        },
      })
    );
  }

  // Check if this is a wallet standard request
  else if (data && data.type === "swig_wallet_request") {
    console.log("Swig Wallet Standard request received:", data.action);

    // Handle different types of wallet standard requests
    if (data.action === "connect") {
      // Check if this is a Swig-aware app request
      const isSwig = data.isSwig === true;

      // Convert to the format expected by your existing code
      window.dispatchEvent(
        new CustomEvent("swig-wallet-request", {
          detail: {
            messageId: data.id,
            action: "connect",
            permissions: data.permissions || [
              "view_balance",
              "sign_transactions",
            ],
            appName: data.appName || document.title,
            appIcon: data.appIcon || "",
            origin: window.location.origin,
            type: isSwig ? "swig-native" : "wallet-standard", // Set the type based on the flag
          },
        })
      );
    } else if (data.action === "sign_transaction") {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-request", {
          detail: {
            messageId: data.id,
            action: "sign_transaction",
            transaction: data.transaction,
          },
        })
      );
    } else if (data.action === "sign_and_send_transaction") {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-request", {
          detail: {
            messageId: data.id,
            action: "sign_transaction", // Map to your existing method
            transaction: data.transaction,
            sendAfterSign: true,
            chain: data.chain,
            options: data.options,
          },
        })
      );
    } else if (data.action === "sign_message") {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-request", {
          detail: {
            messageId: data.id,
            action: "sign_message",
            message: data.message,
          },
        })
      );
    } else if (data.action === "is_connected") {
      window.dispatchEvent(
        new CustomEvent("swig-wallet-request", {
          detail: {
            messageId: data.id,
            action: "is_connected",
          },
        })
      );
    } else if (data.action === "open_permission_popup") {
      const permissionResultId = data.permissionResultId;

      chrome.runtime.sendMessage(
        {
          action: "connect",
          permissions: data.options.permissions,
          appName: document.title,
          appIcon: getAppIcon(),
          origin: window.location.origin,
          type: data.options.isSwig ? "swig-native" : "wallet-standard",
          permissionResultId: permissionResultId,
        },
        (response) => {
          // Forward response back to the page
          window.postMessage(
            {
              type: "swig_wallet_response",
              id: data.id,
              response: response,
            },
            "*"
          );

          // If successful, set up a listener for permission results
          if (response && response.success && response.requestId) {
            setupPermissionResultListener(
              permissionResultId,
              response.requestId
            );
          }
        }
      );
    }
  }
});

// Listen for responses from your existing wallet implementation
// and forward them to the wallet standard implementation
window.addEventListener("swig-wallet-response", (event) => {
  const customEvent = event as CustomEvent;
  const detail = customEvent.detail;

  if (detail && detail.messageId) {
    // Format to match what the wallet standard expects
    window.postMessage(
      {
        type: "swig_wallet_response",
        id: detail.messageId,
        response: {
          success: detail.success !== false,
          ...detail.result, // Include any result data
          error: detail.error,
          signature: detail.signature,
          signatures: detail.signatures,
          connected: detail.connected,
          signedTransaction: detail.signedTransaction,
        },
      },
      "*"
    );
  }
});

function setupPermissionResultListener(
  permissionResultId: any,
  requestId: any
) {
  const checkInterval = setInterval(() => {
    chrome.runtime.sendMessage(
      {
        action: "check_permission_status",
        requestId,
      },
      (response: {
        status: string;
        approved: any;
        publicKey: any;
        role: any;
        permissions: any;
      }) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error checking permission status:",
            chrome.runtime.lastError
          );
          return;
        }

        if (response && response.status === "completed") {
          clearInterval(checkInterval);

          window.postMessage(
            {
              type: "swig_wallet_permission_result",
              id: permissionResultId, // Include the original ID
              result: {
                approved: response.approved,
                publicKey: response.publicKey,
                role: response.role,
                permissions: response.permissions,
              },
            },
            "*"
          );
        } else {
          console.log(
            "Permission request still pending or failed. Status:",
            response?.status || "unknown"
          );
        }
      }
    );
  }, 1000); // Check every second

  // Stop checking after 2 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 120000);
}

function getAppIcon() {
  let favicon = "";
  const iconLink = document.querySelector(
    'link[rel="icon"]'
  ) as HTMLLinkElement;
  if (iconLink && iconLink.href) {
    favicon = iconLink.href;
  } else {
    const shortcutIconLink = document.querySelector(
      'link[rel="shortcut icon"]'
    ) as HTMLLinkElement;
    if (shortcutIconLink && shortcutIconLink.href) {
      favicon = shortcutIconLink.href;
    } else {
      favicon = window.location.origin + "/favicon.ico";
    }
  }
  return favicon;
}

// Call the injection function
injectWalletStandard();
