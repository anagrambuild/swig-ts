---
"@swig-wallet/lib": minor
---

- Add `address`, `addressString`, `signerAddress`, `signerAddressString` properties and `matchesAddress()` method to Authority. 
- Add `address()` and `addressString()` to AuthorityInfo for converting policy-level pubkey bytes to on-chain authority address representation. 
- Add `findRolesByAuthorityAddress()` to Swig for looking up roles by authority address. Deprecate `id` and `signer` in favor of `address` and `signerAddress`. 
- Fix `Ox` typo to `0x` in `secp256k1AddressString`.
