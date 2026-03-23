# @swig-wallet/developer

TypeScript SDK for the Swig Portal API with rich SDK types and query methods.

## Installation

```bash
npm install @swig-wallet/developer
# or
bun install @swig-wallet/developer
```

## Features

- **Single unified client**: `SwigClient` for all Portal operations
- **Rich SDK types**: Converts API responses to SDK types with query methods
- **AuthorityInfo**: Wrapper with type checking methods
- **Actions queries**: `canSpendSol()`, `isRoot()`, `canUseProgram()`, and more
- **Throws errors**: Uses `SwigError` for error handling
- **Retry logic**: Automatic retries with exponential backoff

## Usage

```typescript
import { SwigClient, SwigError } from '@swig-wallet/developer';

const client = new SwigClient({
  apiKey: 'sk_xxx...',
  baseUrl: 'https://dashboard.onswig.com',
});

try {
  // Get policy with rich SDK types
  const policy = await client.getPolicy('policy-id');

  console.log(policy.name);

  // Authority is an AuthorityInfo instance
  if (policy.authority) {
    console.log('Authority type:', policy.authority.type);

    if (policy.authority.isSession()) {
      console.log(
        'Session duration:',
        policy.authority.maxDurationSlots,
        'slots',
      );
    }
  }

  // Query permissions using SDK methods
  if (policy.actions.canSpendSol(100_000n)) {
    console.log('Can spend 100k lamports');
  }

  const solLimit = policy.actions.solSpendLimit();
  console.log('SOL limit:', solLimit);

  if (
    policy.actions.canUseProgram('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  ) {
    console.log('Can interact with Token program');
  }

  // Create wallet
  const wallet = await client.createWallet({
    policyId: 'policy-id',
    network: 'mainnet',
    paymasterPubkey: 'PaymasterPubkey...',
  });

  console.log('Wallet address:', wallet.swigAddress);
} catch (error) {
  if (error instanceof SwigError) {
    console.error('API Error:', error.code, error.message);
  }
}
```

## Error Handling

This SDK throws errors instead of returning `{ data, error }`:

```typescript
import { SwigClient, SwigError } from '@swig-wallet/developer';

try {
  const policy = await client.getPolicy('policy-id');
  // Use policy...
} catch (error) {
  if (error instanceof SwigError) {
    console.error('Code:', error.code); // e.g., 'POLICY_NOT_FOUND'
    console.error('Status:', error.statusCode); // e.g., 404
    console.error('Message:', error.message);
  }
}
```

## API Reference

### SwigClient

| Method                  | Description                        |
| ----------------------- | ---------------------------------- |
| `getPolicy(id)`         | Get a policy with SDK types        |
| `createWallet(request)` | Create a Swig wallet from a policy |

### Policy

The Policy model has:

- `id`, `name` - policy metadata
- `authority: AuthorityInfo | null` - authority configuration
- `actions: Actions` - permissions with query methods

### Actions (via policy.actions)

| Method                         | Description                          |
| ------------------------------ | ------------------------------------ |
| `isRoot()`                     | Check if policy has root permissions |
| `canManageAuthority()`         | Check if can manage authority        |
| `canSpendSol(amount?)`         | Check SOL spend permission           |
| `solSpendLimit()`              | Get SOL spend limit                  |
| `canSpendToken(mint, amount?)` | Check token spend permission         |
| `canUseProgram(programId)`     | Check program access                 |

### AuthorityInfo (via policy.authority)

| Method          | Description                |
| --------------- | -------------------------- |
| `isSession()`   | Check if session authority |
| `isEd25519()`   | Check if Ed25519 type      |
| `isSecp256k1()` | Check if Secp256k1 type    |
| `isSecp256r1()` | Check if Secp256r1 type    |

## License

Apache-2.0
