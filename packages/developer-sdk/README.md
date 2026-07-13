# Swig Developer SDKs

The developer SDK is available in two languages with the same product surface:

- [`typescript`](./typescript): `@swig-wallet/developer-sdk`
- [`python`](./python): `swig-developer-sdk`

Both SDKs keep the same boundary: the Swig API prepares transactions, and the
application signs and finalizes them locally. TypeScript uses
`@solana/web3.js`; Python uses `solders`.

See [`PARITY.md`](./PARITY.md) for the cross-language contract.
