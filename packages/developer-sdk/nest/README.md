# @swig-wallet/developer-sdk/nest

NestJS adapter for the Swig developer SDK transaction-preparation proxy.

Use this when your client app imports `SwigBrowserClient` and your API server is
a NestJS app. The Nest adapter keeps your Swig developer API key on the server
while giving the client the same simple wallet operation calls.

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

Point your client at the Nest route:

```typescript
import { SwigBrowserClient } from '@swig-wallet/developer-sdk/browser';

const swig = new SwigBrowserClient({
  proxyUrl: 'https://api.example.com/swig',
  network: 'devnet',
});

const prepared = await swig.wallets
  .use(swigAddress, { requesterPubkey })
  .transfer.sol({ destination, amount: '1000000' });

const tokenTransfer = await swig.wallets
  .use(swigAddress, { requesterPubkey })
  .transfer.token({ mint, destinationOwner, amount: '10000' });

const swap = await swig.wallets
  .use(swigAddress, { requesterPubkey })
  .swap.jupiter({ inputMint, outputMint, amount: '10000', slippageBps: 100 });
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
