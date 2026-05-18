# @swig-wallet/developer-sdk

API-key SDK for preparing Swig wallet operations on a server and signing the
prepared transaction from a client.

## Flow

The SDK is prepare-first:

1. Your server creates a `SwigClient` with an API key.
2. Your server prepares a wallet operation and receives one or more unsigned
   transactions.
3. Your client signs the prepared transaction locally.
4. Your app either sends the signed transaction directly or submits it to a
   backend sponsor endpoint.

## Framework Proxy Routes

If your app only needs an API-key proxy and does not need to inspect or modify
prepared transactions, use the framework route helpers:

- [Next.js](./next/README.md)
- [NestJS](./nest/README.md)

## Server-Side TypeScript SDK

Use the TypeScript server SDK when you want control over the route shape, auth
context, request validation, response format, or any transaction massage before
returning a prepared payload to the client.

Create an API key from the [Swig dashboard](https://dashboard.onswig.com).

```typescript
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';

const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  network: 'mainnet',
});
```

By default the SDK talks to `https://backend.prod.infra.onswig.com`. Override it
with `baseUrl`:

```typescript
const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  baseUrl: 'http://localhost:8080',
  network: 'devnet',
});
```

### Create Wallet

```typescript
const wallet = await swig.wallets.create({
  feePayer,
  policyId,
});

const preparedCreate = wallet.creationTransaction;

if (!preparedCreate) {
  throw new Error('Wallet creation response did not include a transaction');
}

return preparedCreate;
```

If `policyId` is omitted, the backend can create a no-recovery policy from an
inline `initialUser`. For a passkey initial user, provide the secp256r1 public
key:

```typescript
const wallet = await swig.wallets.create({
  feePayer,
  initialUser: {
    secp256r1: {
      publicKey: passkeyPublicKey,
    },
  },
});

return wallet.creationTransaction;
```

Wallet creation can return multiple prepared transactions when policy setup
requires additional work, such as add-authority or recovery configuration.

### Prepare Transfer

```typescript
const wallet = swig.wallets.use({
  swigConfigAddress,
  walletAddress,
  requesterPubkey,
});

const preparedTransfer = await wallet.transfer.sol({
  feePayer,
  requesterPubkey,
  destination,
  amount: 1_000_000n,
});

return preparedTransfer;
```

Token transfers derive backend-only fields such as token program, source ATA,
destination ATA, and destination ATA creation:

```typescript
const preparedTokenTransfer = await wallet.transfer.token({
  feePayer,
  requesterPubkey,
  mint,
  destinationOwner,
  amount: 10_000n,
});

return preparedTokenTransfer;
```

### Prepare Swap

```typescript
const preparedSwap = await wallet.swap.jupiter({
  feePayer,
  requesterPubkey,
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount: 10_000n,
  slippageBps: 100,
  wrapAndUnwrapSol: true,
});

return preparedSwap;
```

## Client Signing

Client code should only sign prepared transactions. It should not hold the API
key or call the Swig backend directly.

### Prepared Transaction Signing

```typescript
import {
  createSecp256r1PasskeySigningFn,
  signPreparedTransaction,
  type PreparedTransaction,
} from '@swig-wallet/developer-sdk/client';

const passkeySigningFn = createSecp256r1PasskeySigningFn({
  allowCredentials: [{ id: credentialId, type: 'public-key' }],
  userVerification: 'preferred',
});

// The client SDK only signs. Your app owns fetching or passing in the prepared
// payload returned by the server-side SDK.
//
// const prepared = await fetch('/your-app-prepare-route', ...).then((response) =>
//   response.json(),
// );
declare const prepared: PreparedTransaction;

const signed = await signPreparedTransaction(prepared, {
  signTransaction: (transaction) =>
    signPreparedSwigTransaction(transaction, passkeySigningFn),
});
```

After signing, pass `signed` to your app-owned send or sponsor flow. The client
SDK stops at producing the signed prepared transaction payload.

`signPreparedSwigTransaction` is intentionally app-provided for now. It should
wrap the Swig passkey transaction signing flow for the specific transaction
format returned by the backend.

## Public Entrypoints

- `@swig-wallet/developer-sdk/server/typescript`: API-key server SDK for manual
  transaction preparation.
- `@swig-wallet/developer-sdk/client`: client-only signing helpers.
- `@swig-wallet/developer-sdk/server`: server SDK aggregate exports.
