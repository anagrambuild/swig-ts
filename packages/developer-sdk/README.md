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

Point the mobile app at that deployed proxy:

```typescript
const swig = new SwigBrowserClient({
  proxyUrl: 'https://api.example.com/swig',
  network: 'devnet',
});
```

Then the browser code can prepare wallet creation and transactions without
knowing about that proxy:

```typescript
import { SwigBrowserClient } from '@swig-wallet/developer-sdk/browser';

const swig = new SwigBrowserClient({
  network: 'devnet',
});

const wallet = await swig.wallets.create({
  initialUser: {
    ed25519: {
      publicKey: memberPubkey,
    },
  },
});

for (const prepared of wallet.creationTransactions) {
  console.log(prepared.kind, prepared.intentId);
}

// Or use an existing wallet by Swig config address.
const existingWallet = swig.wallets.use(swigAddress, {
  requesterPubkey: memberPubkey,
});

const prepared = await existingWallet.transfer.sol({
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
const preparedTransfer = await wallet.transfer.sol({
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

And swaps use the same wallet handle. The backend prepares a Jupiter swap transaction, the client signs locally, then the signed transaction is sent or sponsored:

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

const signedSwapTransaction = await signPreparedSwigTransaction(
  preparedSwap.transaction,
  signingFn,
);

const swapSubmission = await swig.transactions.sponsor({
  intentId: preparedSwap.intentId,
  transaction: signedSwapTransaction,
  transactionEncoding: preparedSwap.transactionEncoding,
});

console.log(swapSubmission.signature);
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

With the backend local stack running on `localhost:8080` and Surfpool on `localhost:8899`, the package includes a smoke script that seeds a throwaway org/API key in local Postgres, creates a wallet through the no-policy inline-initial-user path, calls the transaction API through the SDK, signs the prepared create, transfer, and Jupiter swap transactions, submits them to the local RPC, then exercises the NestJS proxy handler against the same local API:

```bash
bun --filter '@swig-wallet/developer-sdk' build
bun --filter '@swig-wallet/developer-sdk' smoke:local
```

## Source layout

- `src/client.ts` wires the public `SwigClient` and default API configuration.
- `src/browser.ts` owns browser-safe wallet handles that prepare through an app proxy.
- `src/core` owns HTTP transport, retry defaults, and SDK errors.
- `src/next.ts` and `src/nest.ts` expose framework-focused proxy helpers.
- `src/passkeys` wraps Swig passkey signing helpers.
- `src/server/fetch.ts` provides the portable Fetch-standard proxy handler.
- `src/server/nest.ts` adapts the Fetch handler to NestJS request/response handlers.
- `src/server/next.ts` wraps the Fetch handler for Next.js catch-all routes.
- `src/transactions` owns signed transaction submission, including sponsored send.
- `src/types` contains the public TypeScript contracts split by concern.
- `src/wallets` owns wallet handles, wallet operation clients, request shaping, and response normalization.

The intended flow is `SwigClient` -> `wallets.create` or `wallets.use` -> `wallet.transfer`. Each wallet action posts an intent-style request to the backend and returns a prepared transaction. The frontend signs it, then either sends through its own Solana path or calls `swig.transactions.sponsor`.
