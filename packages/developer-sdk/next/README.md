# @swig-wallet/developer-sdk/next

Next.js adapter for the Swig developer SDK transaction-preparation proxy.

Use this when your browser app needs a local Next.js route to prepare
transactions without exposing your Swig developer API key to the browser. The
browser should call this route, sign the prepared transaction with
`@swig-wallet/developer-sdk/client`, then send directly or submit to a sponsor
endpoint.

## Route Setup

Create one catch-all route:

```typescript
// app/api/swig/[...swig]/route.ts
import { createSwigRouteHandlers } from '@swig-wallet/developer-sdk/next';

export const { POST } = createSwigRouteHandlers();
```

The helper handles:

```text
POST /api/swig/wallet/create
POST /api/swig/transfer/sol
POST /api/swig/transfer/spl-token
POST /api/swig/swap/jupiter
```

## Configuration

By default, the route helper reads standard environment variables:

```bash
SWIG_DEVELOPER_API_KEY=...
SWIG_TRANSACTION_API_URL=...
SWIG_FEE_PAYER=...
```

Create an API key from the [Swig dashboard](https://dashboard.onswig.com).

`SWIG_TRANSACTION_API_URL` and `SWIG_FEE_PAYER` are optional. If no transaction
API URL is provided, the SDK uses its production default. If no fee payer is
configured for a transfer, the helper falls back to the requester public key.

You can also pass values explicitly:

```typescript
export const { POST } = createSwigRouteHandlers({
  apiKey: process.env.SWIG_DEVELOPER_API_KEY,
  transactionApiUrl: process.env.SWIG_TRANSACTION_API_URL,
  feePayer: process.env.SWIG_FEE_PAYER,
});
```

## Client Usage

Once the route is installed, browser code can call it directly:

```typescript
import { signPreparedTransaction } from '@swig-wallet/developer-sdk/client';

const { prepared } = await fetch('/api/swig/transfer/sol', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    network: 'devnet',
    wallet: { swigConfigAddress, walletAddress, requesterPubkey },
    destination,
    amount: '1000000',
  }),
}).then((response) => response.json());

const signed = await signPreparedTransaction(prepared, {
  signTransaction: (transaction) => signPreparedSwigTransaction(transaction),
});
```

## Custom Requester Resolution

If your app does not include `requesterPubkey` in the wallet reference, resolve
it server-side:

```typescript
export const { POST } = createSwigRouteHandlers({
  resolveRequesterPubkey: async ({ wallet, body }) => {
    return wallet?.requesterPubkey ?? lookupRequesterForUser(body);
  },
});
```
