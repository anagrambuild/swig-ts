---
'@swig-wallet/lib': patch
---

Fix `allButManageAuthority` action checks in the TypeScript SDK so it correctly allows unlimited SOL and SPL token spending and program interactions, while still disallowing authority management.
