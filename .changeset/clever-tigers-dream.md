---
'@swig-paymaster/core': minor
---

Initial release of @swig-paymaster/core - the foundation package for Solana gasless transactions.

Provides `PaymasterClient` with low-level methods to sign and send serialized transactions with paymaster fee payment:

- `signSerializedTransaction`: Sign a serialized transaction with the paymaster
- `signAndSendSerializedTransaction`: Sign and submit a transaction to the Solana network
- `isPaymasterFeePayer`: Helper to verify if a transaction uses the paymaster as fee payer
