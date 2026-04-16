---
'@swig-wallet/lib': patch
---

Allow sub-account withdrawals to target a different role via `subAccountRoleId`, so `.all()` authorities can withdraw from another role's sub-account (including expired session-owned sub-accounts) without being forced to derive the acting role's sub-account PDA.

Also adds a regression test covering root `.all()` recovery of another role's sub-account.
