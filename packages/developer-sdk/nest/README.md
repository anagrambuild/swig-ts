# @swig-wallet/developer-sdk/nest

NestJS adapter for the Swig developer SDK transaction-preparation proxy.

Use this when your client app needs a NestJS route to prepare transactions. The
Nest adapter keeps your Swig developer API key on the server; the client calls
the route, signs the prepared transaction with
`@swig-wallet/developer-sdk/client`, then sends directly or submits to a sponsor
endpoint.

## Controller Setup

Create one controller mounted at your Swig proxy prefix:

```typescript
import { Controller, Post, Req, Res } from '@nestjs/common';
import { createSwigNestHandler } from '@swig-wallet/developer-sdk/nest';
import type { Request, Response } from 'express';

const swigHandler = createSwigNestHandler();

@Controller('swig')
export class SwigController {
  @Post('*')
  handle(@Req() request: Request, @Res() response: Response) {
    return swigHandler(request, response);
  }
}
```

The handler expects routes like:

```text
POST /swig/wallet/create
POST /swig/transfer/sol
POST /swig/transfer/spl-token
POST /swig/swap/jupiter
```

## Configuration

By default, the handler reads standard environment variables:

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
const swigHandler = createSwigNestHandler({
  apiKey: process.env.SWIG_DEVELOPER_API_KEY,
  transactionApiUrl: process.env.SWIG_TRANSACTION_API_URL,
  feePayer: process.env.SWIG_FEE_PAYER,
});
```

## Client Usage

Point your client at the Nest route and sign the prepared payload:

```typescript
import { signPreparedTransaction } from '@swig-wallet/developer-sdk/client';

const { prepared } = await fetch('https://api.example.com/swig/transfer/sol', {
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

If your app resolves the requester from auth context, do it server-side:

```typescript
const swigHandler = createSwigNestHandler({
  resolveRequesterPubkey: async ({ request, wallet }) => {
    return wallet?.requesterPubkey ?? lookupRequesterFromRequest(request);
  },
});
```
