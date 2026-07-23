---
'@swig-wallet/developer-sdk': minor
---

Expose Meld ramp country subdivision options and require normalized ramp quote
provider codes.

Ramp options now include country metadata with subdivision codes and labels so
clients can build region-aware country selectors. Ramp quote normalization now
treats `serviceProviderCode` as required and preserves the Meld provider
identity across TypeScript and Python clients.
