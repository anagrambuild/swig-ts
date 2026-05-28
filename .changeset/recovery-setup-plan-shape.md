---
'@swig-wallet/developer-sdk': patch
---

Update the documented recovery setup flow to feed the create-time `recoverySetup` plan directly into `wallet.recovery.prepareSetup`, and avoid defaulting `targetRoleId` into that plan unless explicitly provided.
