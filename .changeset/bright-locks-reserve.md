---
'@swig-wallet/coder': minor
'@swig-wallet/lib': minor
'@swig-wallet/kit': minor
'@swig-wallet/classic': minor
---

Add authorization lock support: the `AddAuthorizationLockV1` (25) and `RemoveAuthorizationLockV1` (26) instructions for Ed25519, Secp256k1, Secp256r1, ProgramExec and session authorities, the `ManageAuthorizationLocks` permission (27) with its `maxDurationSlots` data, and a decoder for the locks stored in the swig config account's tail. Kit and classic gain `getAddAuthorizationLockInstructions`, `getAddSolAuthorizationLockInstructions`, `getAddTokenAuthorizationLockInstructions`, `getRemoveAuthorizationLockInstructions`, `fetchSwigAuthorizationLocks` and `fetchActiveSwigAuthorizationLocks`.
