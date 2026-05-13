# @swig-wallet/developer-sdk

API-key SDK for Swig wallet operations.

## Flow

The SDK shape is intentionally prepare-first:

1. Call the backend through `SwigClient`.
2. Receive a prepared transaction and intent ID.
3. Sign locally with the passkey flow.
4. Either send the signed transaction from the frontend, or submit it to the backend sponsor endpoint.

## Usage

### Browser app with a server proxy

Install one server route in your app. API key access, transaction API URL, and
fee payer can come from the standard environment variables:

```typescript
// app/api/swig/[...swig]/route.ts
import { createSwigRouteHandlers } from '@swig-wallet/developer-sdk/server/next';

export const { POST } = createSwigRouteHandlers();
```

For Expo, React Native, or any app that does not host its own API routes, mount
the same proxy on any Fetch-standard server:

```typescript
import { createSwigFetchHandler } from '@swig-wallet/developer-sdk/server/fetch';

export default {
  fetch: createSwigFetchHandler(),
};
```

Point the mobile app at that deployed proxy:

```typescript
const swig = new SwigBrowserClient({
  proxyUrl: 'https://api.example.com/swig',
  network: 'devnet',
});
```

Then the browser code can prepare transactions without knowing about that proxy:

```typescript
import { SwigBrowserClient } from '@swig-wallet/developer-sdk/browser';

const swig = new SwigBrowserClient({
  network: 'devnet',
});

const wallet = swig.wallets.use({
  swigConfigAddress,
  requesterPubkey: memberPubkey,
});

const prepared = await wallet.transfer.sol({
  destination,
  amount: '1000000',
});
```

The browser client defaults to `/api/swig`. If your app mounts the route
somewhere else, pass `proxyUrl`.

```typescript
const swig = new SwigBrowserClient({
  proxyUrl: '/api/wallet',
  network: 'devnet',
});
```

The server helper reads these env vars by default:

```bash
SWIG_DEVELOPER_API_KEY=...
SWIG_TRANSACTION_API_URL=...
SWIG_FEE_PAYER=...
```

`SWIG_TRANSACTION_API_URL` and `SWIG_FEE_PAYER` are optional. The SDK defaults
to the production transaction API URL when no URL is set, and transfer
preparation falls back to the requester public key as the fee payer when no fee
payer is configured.

### Server-side preparation

```typescript
import {
  SwigClient,
  createSecp256r1PasskeySigningFn,
} from '@swig-wallet/developer-sdk';

const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  network: 'mainnet',
});

const signingFn = createSecp256r1PasskeySigningFn({
  allowCredentials: [{ id: credentialId, type: 'public-key' }],
  userVerification: 'preferred',
});

// 1. Ask the backend to prepare the wallet creation transaction.
const wallet = await swig.wallets.create({
  policyId: 'policy_123',
  feePayer,
});

const preparedCreate = wallet.creationTransaction;

if (!preparedCreate) {
  throw new Error('Wallet creation response did not include a transaction');
}

// 2. Sign locally with passkey.
const signedCreateTransaction = await signPreparedSwigTransaction(
  preparedCreate.transaction,
  signingFn,
);

// 3a. Option A: submit through the backend sponsor endpoint.
const createSubmission = await swig.transactions.sponsor({
  intentId: preparedCreate.intentId,
  transaction: signedCreateTransaction,
  transactionEncoding: preparedCreate.transactionEncoding,
});

console.log(createSubmission.signature);

// 3b. Option B: the frontend can send the signed transaction itself instead.
// await connection.sendRawTransaction(decodedSignedCreateTransaction);
```

The same prepare -> passkey sign -> sponsor/send flow applies to wallet transfers:

```typescript
const preparedTransfer = await wallet.transfer({
  feePayer,
  requesterPubkey: memberPubkey,
  destination,
  amount: 1_000_000n,
});

const signedTransferTransaction = await signPreparedSwigTransaction(
  preparedTransfer.transaction,
  signingFn,
);

const transferSubmission = await swig.transactions.sponsor({
  intentId: preparedTransfer.intentId,
  transaction: signedTransferTransaction,
  transactionEncoding: preparedTransfer.transactionEncoding,
});

console.log(transferSubmission.signature);
```

If the wallet comes from `@swig-wallet/expo-idp-sdk`, use the persisted session directly:

```typescript
const session = await idp.getPersistedSession();

if (!session) {
  throw new Error('No Swig IdP session found');
}

const wallet = swig.wallets.fromIdpSession(session, {
  network: 'devnet',
  requesterPubkey: memberPubkey,
});
```

The wallet handle supplies the Swig config address and system wallet address. Transfer preparation sends the requester's member public key, and the transaction service resolves the matching role on-chain. Signing is still a separate step: the prepared transaction must be signed by the IdP/passkey/session-authority flow before it is sent directly or submitted to `swig.transactions.sponsor`.

`signPreparedSwigTransaction` is a placeholder for the transaction-level passkey signing helper that will sit on top of the existing Swig secp256r1 WebAuthn signing function. The key rule is that passkey signing happens after the backend prepares the transaction, because signing may change the final instructions.

By default the SDK talks to `https://backend.prod.infra.onswig.com`.
Override it with `baseUrl`:

```typescript
const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  baseUrl: 'http://localhost:8080',
});
```

## Local transaction smoke

With the backend local stack running on `localhost:8080` and Surfpool on `localhost:8899`, the package includes a smoke script that seeds a throwaway org/API key/policy in local Postgres, calls the transaction API through the SDK, signs the prepared create and transfer transactions, and submits them to the local RPC:

```bash
bun --filter '@swig-wallet/developer-sdk' build
bun --filter '@swig-wallet/developer-sdk' smoke:local
```

The script defaults to:

```bash
SWIG_TRANSACTION_API_URL=http://localhost:8080
SOLANA_RPC_URL=http://localhost:8899
DATABASE_URL=postgres://swig:swig@localhost:55432/swig
```

Set `SWIG_LOCAL_SMOKE_SUBMIT=false` to stop after preparing transactions without submitting them.

## Source layout

- `src/client.ts` wires the public `SwigClient` and default API configuration.
- `src/browser.ts` owns browser-safe wallet handles that prepare through an app proxy.
- `src/core` owns HTTP transport, retry defaults, and SDK errors.
- `src/passkeys` wraps Swig passkey signing helpers.
- `src/server/fetch.ts` provides the portable Fetch-standard proxy handler.
- `src/server/next.ts` wraps the Fetch handler for Next.js catch-all routes.
- `src/transactions` owns signed transaction submission, including sponsored send.
- `src/types` contains the public TypeScript contracts split by concern.
- `src/wallets` owns wallet handles, wallet operation clients, request shaping, and response normalization.

The intended flow is `SwigClient` -> `wallets.create` or `wallets.use` -> `wallet.transfer`. Each wallet action posts an intent-style request to the backend and returns a prepared transaction. The frontend signs it, then either sends through its own Solana path or calls `swig.transactions.sponsor`.
