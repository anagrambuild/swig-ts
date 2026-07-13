# Developer SDK parity

Python mirrors the TypeScript SDK by behavior and client hierarchy. Python
uses snake_case names while TypeScript uses camelCase.

| Surface             | TypeScript                                       | Python                                              | Parity target                                           |
| ------------------- | ------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| API client          | `SwigClient`                                     | `SwigClient`                                        | same auth, retry, network, and error behavior           |
| Wallet creation     | `swig.wallets.create`                            | `swig.wallets.create`                               | same request and normalized transaction groups          |
| Wallet handle       | `wallets.use`, `fromIdpSession`                  | `wallets.use`, `from_idp_session`                   | same inherited wallet, network, and requester authority |
| Grouped preparation | `wallet.prepare`                                 | `wallet.prepare`                                    | same operation wire shape and normalized response       |
| Transfers           | `wallet.transfer.sol/token/splToken`             | `wallet.transfer.sol/token/spl_token`               | same endpoints and prepared transaction output          |
| Jupiter swap        | `wallet.swap.jupiter`                            | `wallet.swap.jupiter`                               | same optional swap controls                             |
| Recovery            | `wallet.recovery.*`                              | `wallet.recovery.*`                                 | same prepare, start, cancel, and execute behavior       |
| Generic execution   | `wallet.execute`                                 | `wallet.execute`                                    | same instruction normalization                          |
| Wallet reads        | balance, token balances, transactions            | balance, token balances, transactions               | same required-field validation                          |
| Paymaster           | balance and IDP balance                          | balance and IDP balance                             | same query and normalization                            |
| Sponsorship         | `transactions.sponsor`                           | `transactions.sponsor`                              | base64 input converted to base58 for the sponsor API    |
| Ramp                | options, quote, session, transaction reads       | same                                                | same enum conversion and required-field validation      |
| One Business        | grant URL, redirect, and callback parsing        | same                                                | same query contract and errors                          |
| Generic signing     | callback and signer object                       | callback and signer protocol                        | same metadata preservation                              |
| Swig r1 signing     | passkey callback and local transaction patching  | WebAuthn callback and `solders` patching            | byte-for-byte transaction semantics                     |
| Swig k1 signing     | EIP-1193 callback and local transaction patching | EIP-1193-compatible callback and `solders` patching | byte-for-byte transaction semantics                     |
| App proxy           | Fetch/Next/Nest adapters                         | framework-neutral proxy handler                     | same routes, validation, and resolver boundaries        |

Framework-specific TypeScript wrappers remain in the TypeScript package. The
Python package exposes the underlying proxy handler so FastAPI, Flask, Django,
or another framework can adapt it without making one framework a core
dependency.
