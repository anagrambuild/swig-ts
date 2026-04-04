---
'@swig-wallet/coder': patch
'@swig-wallet/lib': patch
---

Fix `ProgramCurated` action encoding to include the reserved 32-byte payload so generated SignV2 instructions match on-chain expectations.
