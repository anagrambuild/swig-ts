# @swig-wallet/api

Low-level API client for the Swig ecosystem (Portal and Paymaster services). Returns `{ data, error }` responses.

## Installation

```bash
npm install @swig-wallet/api
# or
bun install @swig-wallet/api
```

## Features

- **`{ data, error }` responses**: All methods return `{ data, error }` - never throws
- **Unified client**: Single `SwigApiClient` with sub-clients for policies, wallet, and paymaster
- **TypeScript-first**: Full type definitions for all API responses
- **Zero dependencies**: Only uses native `fetch`

## Usage

```typescript
import { SwigApiClient } from '@swig-wallet/api';

const client = new SwigApiClient({
  apiKey: 'sk_xxx...',
  portalUrl: 'https://dashboard.onswig.com',
  paymasterUrl: 'https://api.onswig.com',
});

// Get a policy
const { data: policy, error } = await client.policies.get('policy-id');
if (error) {
  console.error(error.code, error.message);
  return;
}
console.log(policy.name, policy.actions);

// Create a wallet
const { data: wallet, error: createError } = await client.wallet.create({
  policyId: 'policy-id',
  network: 'mainnet',
  paymasterPubkey: 'PaymasterPubkey...',
});
if (createError) {
  console.error(createError.message);
  return;
}
console.log('Wallet created:', wallet.swigAddress);

// Sponsor a transaction (sign + send)
const { data, error: sponsorError } = await client.paymaster.sponsor(
  serializedTransaction,
  'mainnet',
);
if (sponsorError) {
  console.error(sponsorError.message);
  return;
}
console.log('Transaction sent:', data.signature);

// Sign without sending
const { data: signed } = await client.paymaster.sign(
  serializedTransaction,
  'mainnet',
);
console.log('Signed transaction:', signed?.signed_transaction);

// Health check (no auth required)
const { data: health } = await client.paymaster.health();
console.log('Service status:', health?.status);
```

## Error Handling

All methods return an `ApiResponse<T>` object:

```typescript
type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};
```

The `ApiError` class provides structured error information:

```typescript
class ApiError extends Error {
  code: string; // Machine-readable code (e.g., 'INVALID_API_KEY')
  status: number; // HTTP status code
  details?: unknown; // Additional error details
}
```

Example error handling:

```typescript
const { data, error } = await client.policies.get('policy-id');

if (error) {
  switch (error.code) {
    case 'INVALID_API_KEY':
      console.log('Please check your API key');
      break;
    case 'POLICY_NOT_FOUND':
      console.log('Policy does not exist');
      break;
    case 'NETWORK_ERROR':
      console.log('Connection failed, please retry');
      break;
    default:
      console.log('Error:', error.message);
  }
  return;
}

// data is guaranteed to be non-null here
console.log(data.name);
```

## API Reference

### SwigApiClient

| Sub-client  | Method                 | Description                        |
| ----------- | ---------------------- | ---------------------------------- |
| `policies`  | `get(id)`              | Get a policy by ID                 |
| `wallet`    | `create(request)`      | Create a Swig wallet from a policy |
| `paymaster` | `sponsor(tx, network)` | Sign and send a transaction        |
| `paymaster` | `sign(tx, network)`    | Sign a transaction without sending |
| `paymaster` | `health()`             | Check service health (no auth)     |

## License

AGPL-3.0
