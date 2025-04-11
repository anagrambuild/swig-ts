import {
  StandardEventsListeners,
  StandardEventsNames,
  StandardEventsChangeProperties,
  Wallet,
  WalletAccount,
  IdentifierArray,
  registerWallet,
} from "@wallet-standard/core";

// Import from Solana wallet standard
import { SOLANA_CHAINS } from "@solana/wallet-standard";

// to create an image to base64 string
// echo "data:image/png;base64,$(base64 -i /path/to/your/icon128.png)"

// Helper function to generate unique message IDs
function generateMessageId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Communication function to send messages to the extension
async function sendToExtension(action: string, data: any = {}): Promise<any> {
  console.log(`[Swig Wallet] Sending request to extension: ${action}`, data);
  return new Promise((resolve, reject) => {
    const messageId = generateMessageId();
    console.log(`[Swig Wallet] Generated message ID: ${messageId}`);

    // Create a listener for the response
    const responseListener = (event: MessageEvent) => {
      console.log(`[Swig Wallet] Received message event:`, event.data);
      if (
        event.data &&
        event.data.type === "swig_wallet_response" &&
        event.data.id === messageId
      ) {
        console.log(
          `[Swig Wallet] Matched response for ID ${messageId}:`,
          event.data.response
        );
        // Remove listener once we get our response
        window.removeEventListener("message", responseListener);
        console.log(
          `[Swig Wallet] Added message listener for ID: ${messageId}`
        );

        if (event.data.response?.success) {
          resolve(event.data.response);
        } else {
          reject(new Error(event.data.response?.error || "Unknown error"));
        }
      }
    };

    // Add listener for response
    window.addEventListener("message", responseListener);

    // Send message to content script
    window.postMessage(
      {
        type: "swig_wallet_request",
        id: messageId,
        action,
        ...data,
      },
      "*"
    );
    console.log(
      `[Swig Wallet] Posted message to window: ${action} with ID ${messageId}`
    );
    // Add timeout to prevent hanging promises
    setTimeout(() => {
      window.removeEventListener("message", responseListener);
      reject(new Error("Request to Swig wallet timed out"));
    }, 30000); // 30 second timeout
  });
}

// Utility to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
  // If it starts with 0x, remove it
  const hexString = hex.startsWith("0x") ? hex.substring(2) : hex;

  // If the length is odd, pad with a leading zero
  const normalizedHex =
    hexString.length % 2 !== 0 ? `0${hexString}` : hexString;

  const bytes = new Uint8Array(normalizedHex.length / 2);
  for (let i = 0; i < normalizedHex.length; i += 2) {
    bytes[i / 2] = parseInt(normalizedHex.substring(i, i + 2), 16);
  }

  return bytes;
}

// Define the Swig wallet account class that implements WalletAccount interface
class SwigWalletAccount implements WalletAccount {
  readonly #address: string;
  readonly #publicKey: Uint8Array;
  readonly #chains: IdentifierArray;
  readonly #features: IdentifierArray;
  readonly #label?: string;
  readonly #icon?: string;

  get address(): string {
    return this.#address;
  }

  get publicKey(): Uint8Array {
    return this.#publicKey;
  }

  get chains(): IdentifierArray {
    return this.#chains;
  }

  get features(): IdentifierArray {
    return this.#features;
  }

  get label(): string | undefined {
    return this.#label;
  }

  get icon():
    | `data:image/svg+xml;base64,${string}`
    | `data:image/webp;base64,${string}`
    | `data:image/png;base64,${string}`
    | `data:image/gif;base64,${string}`
    | undefined {
    return this.#icon as
      | `data:image/svg+xml;base64,${string}`
      | `data:image/webp;base64,${string}`
      | `data:image/png;base64,${string}`
      | `data:image/gif;base64,${string}`
      | undefined;
  }

  constructor({
    address,
    publicKey,
    chains,
    features,
    label,
    icon,
  }: {
    address: string;
    publicKey: Uint8Array;
    chains: IdentifierArray;
    features: IdentifierArray;
    label?: string;
    icon?: string;
  }) {
    this.#address = address;
    this.#publicKey = publicKey;
    this.#chains = chains;
    this.#features = features;
    this.#label = label;
    this.#icon = icon;
    Object.freeze(this);
  }
}

// Define the main Swig wallet class
class SwigWalletStandard implements Wallet {
  // Wallet properties
  readonly #name = "Swig Wallet";
  readonly #version = "1.0.0" as const;
  readonly #icon =
    "data:image/png;base64,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//HHHwkIAvXzzz9nLIIAf/75Z67//fffk+NoPxxgMQL+/vs/Zk5SyJykkPnTTz8NNZ9yyilTWRaZ0V6j8vFQpy4csI3t9An8X3/9lX777bcsWRaYaqqp8jnb+P5Hsf9r0I+y+iALO/Ujx/GUReB/GsROe4Qn355Om6I9GeyBeysFTY9qpUO57UgEYDxgGCpQq6yyStpnn33SQgstlB5//PE0/fTT/wsoxoczZfmOyeHgRIVz2k099dTp+++/T3vttVfaYost0i+//JLeeeedhAQKOeWAl49zgy79iYDDgE0//vhjmmeeedLBBx+c1lhjjfT++++nTz/9NF9jt8ANF3zmsHGygiDaOQ4/fyhkbr/99mmXXXbJWeDll19OM844Y5bFT7q1VWCkqGvF564TgAECb/vhhx/S8ssvn/bdd9+00UYbpXnnnTePhCeeeCLvY778vQBnpDQkRU1ckMCon6KQ+e1336Wddtopb6uttlqaZZZZ0rvvvps++OCDNM0002QgAoxWgMjotfCHn+znp+Ai94EHHphJufDCC+eA8ZMtRj9bwq5GNTHqXXc83XTTpW+++SZtvPHGabfddktrrbVWmn322dMnn3ySXn311SzbSA+ZQRxy/+sEYITR+F0RqBVXXDHtv//+ae21184gzDDDDGnuuefOo/Tpp5/OKZIjjB4JHPI4SKbg77DDDmmPPfZICy64YE67SDXrrLOmjz76KL1TZIJIu/qRO1aFvXRJ7/QfcsghmeTslB3mm2++HLSHH344DwTkRJThSBlkEvypC5lff/112nzzzTN2SyyxRPZ/rrnmSnPMMUcmxmuvvZZJEpjpFxgOJ380DLqaASiXDqXlpZdeOu23335pnXXWyQ4AipEzzzxzMkIcP/bYY2m6aafNqXGkucsUMG3RBijbbbdd2nvvvXPwpUAABNgywYcffpizAZnApkOJ/WhAtHpNQE1vAn3ooYfmUWqxFoQ2zc0///xppplmSsguSK5F0Mr64MZPMo38TTbZJPu5zDLLZNv5aiPP9t5776U33ngj4xKkIqOcCcryRzvuGgEYIHVJ+4svvng66KCD8lwo/TGyvABEAsAJzKMFCUYaHUAD5FdffZXnQfO+kR/B5TBiAc/8a4QA591i0881pdsEMMqRXFo255ve+PDrr79mQtLnusFgaphtttnSLbfckq+xtZHs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" as const;

  // Event listeners
  readonly #listeners: {
    change: Set<(properties: StandardEventsChangeProperties) => void>;
    connect: Set<() => void>;
    disconnect: Set<() => void>;
  } = {
    change: new Set<(properties: StandardEventsChangeProperties) => void>(),
    connect: new Set<() => void>(),
    disconnect: new Set<() => void>(),
  };

  // Account setup
  #accounts: readonly WalletAccount[] = [];
  #connected: boolean = false;

  constructor() {
    // Check if already connected
    this.#checkConnectionState();

    // Freeze the object to make it immutable
    Object.freeze(this);
  }

  // Standard wallet properties
  get version(): "1.0.0" {
    return this.#version;
  }

  get name(): string {
    return this.#name;
  }

  get icon():
    | `data:image/svg+xml;base64,${string}`
    | `data:image/webp;base64,${string}`
    | `data:image/png;base64,${string}`
    | `data:image/gif;base64,${string}` {
    return this.#icon;
  }

  get chains(): IdentifierArray {
    return SOLANA_CHAINS;
  }

  get accounts(): readonly WalletAccount[] {
    return this.#accounts;
  }

  // Standard features implementation
  get features(): {
    "standard:connect": {
      version: "1.0.0";
      connect: (options?: {
        silent?: boolean;
      }) => Promise<{ accounts: readonly WalletAccount[] }>;
    };
    "standard:disconnect": {
      version: "1.0.0";
      disconnect: () => Promise<void>;
    };
    "standard:events": {
      version: "1.0.0";
      on: <E extends StandardEventsNames>(
        event: E,
        listener: StandardEventsListeners[E]
      ) => () => void;
    };
    "solana:signTransaction": {
      version: "1.0.0";
      supportedTransactionVersions: readonly ["legacy"];
      signTransaction: (...inputs: any[]) => Promise<any[]>;
    };
    "solana:signAndSendTransaction": {
      version: "1.0.0";
      supportedTransactionVersions: readonly ["legacy"];
      signAndSendTransaction: (...inputs: any[]) => Promise<any[]>;
    };
    "solana:signMessage": {
      version: "1.0.0";
      signMessage: (...inputs: any[]) => Promise<any[]>;
    };
  } {
    return {
      "standard:connect": {
        version: "1.0.0",
        connect: async ({ silent = false } = {}) => {
          console.log("Wallet Standard connect called");
          console.log("Silent:", silent);

          if (this.#connected) {
            console.log("Already connected, returning accounts");
            return { accounts: this.#accounts };
          }
          const permissionResultId = generateMessageId();

          try {
            // Open the popup directly from here
            const popupOpened = await this.#openPermissionPopup({
              action: "request_permissions",
              data: {
                permissions: ["view_balance", "sign_transactions"],
              },
              permissionResultId,
            });

            if (!popupOpened) {
              throw new Error("Failed to open permission popup");
            }

            // Wait for the permission to be granted using this specific ID
            const permissionResult = await this.#waitForPermissionResult(
              permissionResultId
            );

            if (
              typeof permissionResult !== "object" ||
              permissionResult === null ||
              !("approved" in permissionResult)
            ) {
              throw new Error("Invalid permission result");
            }

            if (!permissionResult.approved) {
              throw new Error("Permission denied");
            }

            // Set up the account with the granted permissions
            await this.#setupConnectedAccount(permissionResult);

            // Emit the connect event
            this.#emitEvent("connect");

            return { accounts: this.#accounts };
          } catch (error) {
            console.error("Connection error:", error);
            throw new Error(
              `Failed to connect to Swig wallet: ${
                (error as Error).message ?? String(error)
              }`
            );
          }
        },
      },

      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => {
          if (!this.#connected) {
            return; // Already disconnected
          }

          await this.#disconnectWallet();
        },
      },

      // Standard events feature
      "standard:events": {
        version: "1.0.0" as const,
        on: <E extends StandardEventsNames>(
          event: E,
          listener: StandardEventsListeners[E]
        ) => {
          this.#listeners[event].add(listener as any);
          return () => {
            this.#listeners[event].delete(listener as any);
          };
        },
      },

      // Solana sign transaction feature
      "solana:signTransaction": {
        version: "1.0.0" as const,
        supportedTransactionVersions: ["legacy"] as const,
        signTransaction: async (...inputs: any[]) => {
          if (!this.#connected) throw new Error("Wallet not connected");

          const outputs = await Promise.all(
            inputs.map(async (input) => {
              try {
                const { transaction, account } = input;

                // Verify account
                if (
                  !this.#accounts.some((acc) => acc.address === account.address)
                ) {
                  throw new Error("Account mismatch");
                }

                // Send signing request
                const response = await sendToExtension("sign_transaction", {
                  transaction: Array.from(transaction),
                  account: account.address,
                });

                if (response && response.success) {
                  return {
                    signedTransaction: new Uint8Array(
                      response.signedTransaction
                    ),
                  };
                } else {
                  throw new Error(
                    response?.error || "Failed to sign transaction"
                  );
                }
              } catch (error) {
                console.error("Error signing transaction:", error);
                throw error;
              }
            })
          );

          return outputs;
        },
      },

      // Solana sign and send transaction feature
      "solana:signAndSendTransaction": {
        version: "1.0.0" as const,
        supportedTransactionVersions: ["legacy"] as const,
        signAndSendTransaction: async (...inputs: any[]) => {
          if (!this.#connected) throw new Error("Wallet not connected");

          const outputs = await Promise.all(
            inputs.map(async (input) => {
              try {
                const { transaction, account, chain, options } = input;

                // Verify account
                if (
                  !this.#accounts.some((acc) => acc.address === account.address)
                ) {
                  throw new Error("Account mismatch");
                }

                // Send signing and sending request
                const response = await sendToExtension(
                  "sign_and_send_transaction",
                  {
                    transaction: Array.from(transaction),
                    account: account.address,
                    chain,
                    options,
                  }
                );

                if (response && response.success) {
                  return {
                    signature: new Uint8Array(response.signature),
                  };
                } else {
                  throw new Error(
                    response?.error || "Failed to sign and send transaction"
                  );
                }
              } catch (error) {
                console.error("Error signing and sending transaction:", error);
                throw error;
              }
            })
          );

          return outputs;
        },
      },

      // Solana sign message feature
      "solana:signMessage": {
        version: "1.0.0" as const,
        signMessage: async (...inputs: any[]) => {
          if (!this.#connected) throw new Error("Wallet not connected");

          const outputs = await Promise.all(
            inputs.map(async (input) => {
              try {
                const { message, account } = input;

                // Verify account
                if (
                  !this.#accounts.some((acc) => acc.address === account.address)
                ) {
                  throw new Error("Account mismatch");
                }

                // Send message signing request
                const response = await sendToExtension("sign_message", {
                  message: Array.from(message),
                  account: account.address,
                });

                if (response && response.success) {
                  return {
                    signedMessage: message,
                    signature: new Uint8Array(response.signature),
                  };
                } else {
                  throw new Error(response?.error || "Failed to sign message");
                }
              } catch (error) {
                console.error("Error signing message:", error);
                throw error;
              }
            })
          );

          return outputs;
        },
      },
    };
  }

  // Check the current connection state
  async #checkConnectionState(): Promise<void> {
    try {
      const response = await sendToExtension("is_connected");
      if (response && response.connected) {
        // If we're connected, set up the account
        await this.#setupConnectedAccount(response);
      }
    } catch (error) {
      console.log("Not connected to Swig wallet", error);
    }
  }

  // Set up the account when connected
  async #setupConnectedAccount(connectionInfo: any): Promise<void> {
    try {
      // Create a byte array from the public key string
      const publicKeyBytes = hexToBytes(connectionInfo.publicKey || "");

      const account = new SwigWalletAccount({
        address: connectionInfo.publicKey || "unknown",
        publicKey: publicKeyBytes,
        chains: SOLANA_CHAINS,
        features: [
          "solana:signTransaction",
          "solana:signAndSendTransaction",
          "solana:signMessage",
        ] as IdentifierArray,
        label: connectionInfo.role || "Swig Wallet",
        icon: this.#icon,
      });

      this.#accounts = [account];
      this.#connected = true;
    } catch (error) {
      console.error("Error setting up connected account:", error);
      throw error;
    }
  }

  // Helper method to open the permission popup
  async #openPermissionPopup(options: {
    action: string;
    data?: any;
    permissionResultId: string;
  }) {
    return new Promise((resolve, reject) => {
      const messageId = generateMessageId();
      // Listen for response
      const listener = (event: MessageEvent) => {
        if (
          event.data &&
          event.data.type === "swig_wallet_response" &&
          event.data.id === messageId
        ) {
          window.removeEventListener("message", listener);
          if (event.data.response?.success) {
            resolve(event.data.response);
          } else {
            reject(
              new Error(
                event.data.response?.error || "Failed to open permission popup"
              )
            );
          }
        }
      };

      window.addEventListener("message", listener);

      // Send message to content script
      window.postMessage(
        {
          type: "swig_wallet_request",
          id: messageId,
          action: "open_permission_popup",
          options,
          permissionResultId: options.permissionResultId,
        },
        "*"
      );

      // Set timeout
      setTimeout(() => {
        window.removeEventListener("message", listener);
        reject(new Error("Request to open permission popup timed out"));
      }, 30000);
    });
  }

  // Similarly for waitForPermissionResult
  async #waitForPermissionResult(resultId: string) {
    return new Promise((resolve, reject) => {
      // Listen for response
      const listener = (event: MessageEvent) => {
        if (
          event.data &&
          event.data.type === "swig_wallet_permission_result" &&
          event.data.id === resultId
        ) {
          window.removeEventListener("message", listener);
          resolve(event.data.result);
        }
      };

      window.addEventListener("message", listener);

      // Set timeout
      setTimeout(() => {
        window.removeEventListener("message", listener);
        reject(new Error("Waiting for permission result timed out"));
      }, 120000); // 2 minutes timeout
    });
  }

  async #disconnectWallet() {
    try {
      // Call your extension to disconnect
      await sendToExtension("disconnect");

      // Clear local state
      this.#accounts = [];
      this.#connected = false;

      // Emit disconnect event to notify listeners
      this.#emitEvent("disconnect");

      return true;
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      throw error;
    }
  }

  // Helper to emit events
  #emitEvent(
    eventName: "change" | "connect" | "disconnect",
    properties?: StandardEventsChangeProperties
  ): void {
    if (eventName === "connect" || eventName === "disconnect") {
      const connectDisconnectListeners = this.#listeners[eventName] as Set<
        () => void
      >;
      connectDisconnectListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error(`Error in ${eventName} event listener:`, error);
        }
      });
    } else if (eventName === "change") {
      const changeListeners = this.#listeners.change;
      changeListeners.forEach((listener) => {
        try {
          listener(properties || {});
        } catch (error) {
          console.error(`Error in change event listener:`, error);
        }
      });
    }
  }
}

// Create and register the wallet
function registerSwigWallet() {
  try {
    const wallet = new SwigWalletStandard();
    registerWallet(wallet);
    console.log("Swig wallet registered with Wallet Standard");
  } catch (error) {
    console.error("Failed to register Swig wallet:", error);
  }
}

// Execute registration
registerSwigWallet();

// Notify that the Swig Wallet Standard has been loaded
window.dispatchEvent(new CustomEvent("swig-wallet-standard-loaded"));
