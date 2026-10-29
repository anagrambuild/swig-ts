---
'@swig-wallet/mcp-server': minor
'@swig-wallet/coder': minor
'@swig-wallet/lib': minor
---

Update the wallet MCP to the 2026-07-28 MCP protocol and the current Swig wallet instruction and permission layouts. Add Ed25519 signer replacement, rent claimer setup, complete V2 sub-account operations (create, fetch, toggle, sign, SOL and token withdrawals, and close), V1 sub-account close, parent wallet and token account close, and reserved wallet creation. Correct V2 account detection after the sub-account counter changes, and reject the removed RentDestination permission.
