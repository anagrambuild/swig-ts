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

export const { GET, POST } = createSwigRouteHandlers();
```

The helper handles:

```text
POST /api/swig/wallet/create
POST /api/swig/prepare
POST /api/swig/transfer/sol
POST /api/swig/transfer/spl-token
POST /api/swig/swap/jupiter
GET  /api/swig/ramp/options
POST /api/swig/ramp/quote
POST /api/swig/ramp/sessions
GET  /api/swig/ramp/transactions/:transactionId
GET  /api/swig/ramp/wallets/:walletId/transactions
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

Once the route is installed, browser code can use the browser client. It calls
your local app route only; the Swig developer API key stays on the server.

```typescript
import { signPreparedTransaction } from '@swig-wallet/developer-sdk/client';
import { SwigBrowserClient } from '@swig-wallet/developer-sdk/browser';

const swig = new SwigBrowserClient({ network: 'devnet' });
const wallet = swig.wallets.fromIdpSession(session);

const prepared = await wallet.transfer.sol({
  destination,
  amount: 1_000_000n,
});

const signed = await signPreparedTransaction(prepared, {
  signTransaction: (transaction) => signPreparedSwigTransaction(transaction),
});
```

The same wallet handle also supports SPL transfers and Jupiter swap
preparation:

```typescript
await wallet.transfer.token({
  mint,
  destinationOwner,
  amount: '2500',
});

await wallet.swap.jupiter({
  inputMint,
  outputMint,
  amount: '1000000',
  slippageBps: 75,
});
```

## Custom Requester Resolution

If your app does not include `requesterAuthority` in the wallet reference,
resolve it server-side:

```typescript
export const { POST } = createSwigRouteHandlers({
  resolveRequesterAuthority: async ({ wallet }) => {
    return wallet?.requesterAuthority ?? lookupRequesterForRole(wallet?.roleId);
  },
});
```

## Ramp Customer Resolution

Ramp routes can also resolve customer identity server-side. This keeps browser
code from choosing the Meld customer identity while still letting each app map
its own authenticated user or downstream customer.

```typescript
export const { GET, POST } = createSwigRouteHandlers({
  resolveRampCustomer: async ({ request }) => {
    const user = await getUserFromSession(request);

    return {
      organizationId: user.organizationId,
      swigUserId: user.id,
      customerType: 'individual',
    };
  },
});
```

For embedded partner apps, return `partnerApplicationId` plus either
`externalCustomerId` or `externalBusinessId` instead of `swigUserId`.
