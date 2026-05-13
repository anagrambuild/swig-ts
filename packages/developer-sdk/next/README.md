# @swig-wallet/developer-sdk/next

Next.js adapter for the Swig developer SDK transaction-preparation proxy.

Use this when your browser app imports `SwigBrowserClient` and you want the SDK
to prepare transactions through a local Next.js route without exposing your Swig
developer API key to the browser.

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
```

## Configuration

By default, the route helper reads standard environment variables:

```bash
SWIG_DEVELOPER_API_KEY=...
SWIG_TRANSACTION_API_URL=...
SWIG_FEE_PAYER=...
```

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

## Browser Usage

Once the route is installed, browser code can use the default hidden proxy:

```typescript
import { SwigBrowserClient } from '@swig-wallet/developer-sdk/browser';

const swig = new SwigBrowserClient({
  network: 'devnet',
});

const prepared = await swig.wallets
  .use({ swigConfigAddress, requesterPubkey })
  .transfer.sol({ destination, amount: '1000000' });
```

If you mount the route somewhere other than `/api/swig`, pass `proxyUrl`:

```typescript
const swig = new SwigBrowserClient({
  proxyUrl: '/api/wallet',
  network: 'devnet',
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
