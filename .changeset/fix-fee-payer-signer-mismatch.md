---
"@swig-wallet/lib": minor
---

Fix fee payer is_signer mismatch in message hash computation for secp256r1/secp256k1 authorities. When the fee payer appeared as a transfer destination in inner instructions, the client computed the hash with is_signer=false while the on-chain program saw is_signer=true, causing error 0xbd2 (PermissionDeniedSecp256r1InvalidMessageHash). The payer is now correctly marked as a signer in the accounts list before hash computation.
