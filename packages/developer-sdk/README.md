# @swig-wallet/developer-sdk

API-key SDK for Swig wallet operations.

## Flow

The SDK shape is intentionally prepare-first:

1. Call the backend through `SwigClient`.
2. Receive a prepared transaction and intent ID.
3. Sign locally with the passkey flow.
4. Either send the signed transaction from the frontend, or submit it to the backend sponsor endpoint.

## Usage

### Server route

Framework-specific setup guides:

- [Next.js](./next/README.md)
- [NestJS](./nest/README.md)

Install one server route in your app. API key access, transaction API URL, and
fee payer can come from the standard environment variables:

```typescript
// app/api/swig/[...swig]/route.ts
import { createSwigRouteHandlers } from '@swig-wallet/developer-sdk/next';

export const { POST } = createSwigRouteHandlers();
```

For NestJS, add one controller method:

```typescript
import { Controller, Post, Req, Res } from '@nestjs/common';
import { createSwigNestHandler } from '@swig-wallet/developer-sdk/nest';

const swigHandler = createSwigNestHandler();

@Controller('swig')
export class SwigController {
  @Post('*')
  handle(@Req() request: Request, @Res() response: Response) {
    return swigHandler(request, response);
  }
}
```

For Expo, React Native, or any app that does not host its own API routes, mount
the same proxy on any Fetch-standard server:

```typescript
import { createSwigFetchHandler } from '@swig-wallet/developer-sdk/server/fetch';

export default {
  fetch: createSwigFetchHandler(),
};
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

### Client signing

Client code should only sign prepared transactions. It should call your app's
server route to create or prepare the transaction, then sign the returned
payload locally:

```typescript
import {
  createSecp256r1PasskeySigningFn,
  signPreparedTransaction,
} from '@swig-wallet/developer-sdk/client';

const signingFn = createSecp256r1PasskeySigningFn({
  allowCredentials: [{ id: credentialId, type: 'public-key' }],
  userVerification: 'preferred',
});

const { prepared } = await fetch('/api/swig/transfer/sol', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    network: 'devnet',
    wallet: {
      swigConfigAddress,
      walletAddress,
      requesterPubkey,
    },
    destination,
    amount: '1000000',
  }),
}).then((response) => response.json());

const signed = await signPreparedTransaction(prepared, {
  signTransaction: (transaction) =>
    signPreparedSwigTransaction(transaction, signingFn),
});

// Option A: submit through your backend sponsor endpoint.
await fetch('/api/swig/sponsor', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(signed),
});

// Option B: decode and send the signed transaction from the client.
// await connection.sendRawTransaction(decodedSignedTransaction);
```

`signPreparedSwigTransaction` is intentionally app-provided for now. It should
wrap the existing Swig passkey transaction signing flow for the specific
transaction format returned by the backend.

### Server-side preparation

```typescript
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';

const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  network: 'mainnet',
});

// 1. Ask the backend to prepare the wallet creation transaction(s).
const wallet = await swig.wallets.create({
  feePayer,
  initialUser: {
    secp256r1: {
      publicKey: passkeyPublicKey,
    },
  },
});

// If you already have a saved policy template, pass `policyId` instead. When
// `policyId` is omitted, the backend creates a no-recovery policy from
// `initialUser` and uses it for this wallet creation.

// Wallet creation can return multiple transactions for policies that also need
// setup work such as add-authority or recovery configuration.
for (const prepared of wallet.creationTransactions) {
  console.log(prepared.kind, prepared.intentId);
}

const preparedCreate = wallet.creationTransaction;

if (!preparedCreate) {
  throw new Error('Wallet creation response did not include a transaction');
}

// Return this payload to the client for signing.
return preparedCreate;
```

The same prepare flow applies to wallet transfers:

```typescript
const preparedTransfer = await wallet.transfer.sol({
  feePayer,
  requesterPubkey: memberPubkey,
  destination,
  amount: 1_000_000n,
});

return preparedTransfer;
```

The opinionated transfer helpers avoid backend-only fields. Token program,
source ATA, destination ATA, and destination ATA creation are derived by the
transaction API:

```typescript
const preparedSolTransfer = await wallet.transfer.sol({
  feePayer,
  requesterPubkey: memberPubkey,
  destination,
  amount: 1_000_000n,
});

const preparedTokenTransfer = await wallet.transfer.token({
  feePayer,
  requesterPubkey: memberPubkey,
  mint,
  destinationOwner,
  amount: 10_000n,
});
```

And swaps use the same wallet handle. The backend prepares a Jupiter swap
transaction, then the client signs locally:

```typescript
const preparedSwap = await wallet.swap.jupiter({
  feePayer,
  requesterPubkey: memberPubkey,
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount: 10_000n,
  slippageBps: 100,
  wrapAndUnwrapSol: true,
});

return preparedSwap;
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

The wallet handle supplies the Swig config address and system wallet address.
Transfer preparation sends the requester's member public key, and the
transaction service resolves the matching role on-chain. Signing is still a
separate client step: the prepared transaction must be signed by the
IdP/passkey/session-authority flow before it is sent directly or submitted to
`swig.transactions.sponsor`.

By default the SDK talks to `https://backend.prod.infra.onswig.com`.
Override it with `baseUrl`:

```typescript
const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  baseUrl: 'http://localhost:8080',
});
```

## Local transaction smoke

With the backend local stack running on `localhost:8080` and Surfpool on `localhost:8899`, the package includes a smoke script that seeds a throwaway org/API key in local Postgres, creates a wallet through the no-policy inline-initial-user path, calls the transaction API through the SDK, signs the prepared create, transfer, and Jupiter swap transactions, submits them to the local RPC, then exercises the NestJS proxy handler against the same local API:

```bash
bun --filter '@swig-wallet/developer-sdk' build
bun --filter '@swig-wallet/developer-sdk' smoke:local
```

## Source layout

- `src/client` exposes client-only signing helpers.
- `src/browser.ts` is a browser-compatible alias for the client signing helpers.
- `src/core` owns HTTP transport, retry defaults, and SDK errors.
- `src/next.ts` and `src/nest.ts` expose framework-focused proxy helpers.
- `src/passkeys` wraps Swig passkey signing helpers.
- `src/server` groups server-only SDK surfaces.
- `src/server/typescript` exposes the direct HTTP API client as `SwigClient`.
- `src/server/fetch` provides the portable Fetch-standard proxy handler.
- `src/server/nest` adapts the Fetch handler to NestJS request/response handlers.
- `src/server/next` wraps the Fetch handler for Next.js catch-all routes.
- `src/transactions` owns signed transaction submission, including sponsored send.
- `src/types` contains the public TypeScript contracts split by concern.
- `src/wallets` owns wallet handles, wallet operation clients, request shaping, and response normalization.

The intended flow is server `SwigClient` -> `wallets.create` or `wallets.use`
-> wallet action -> prepared transaction -> client signing helper. After
signing, the app either sends through its own Solana path or calls a server
sponsor endpoint.
