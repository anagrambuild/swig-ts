# @swig-paymaster/core

Core paymaster client for Solana gasless transactions.

## Installation

```bash
npm install @swig-paymaster/core
# or
bun install @swig-paymaster/core
```

## Usage

```typescript
import { PaymasterClient } from '@swig-paymaster/core';

const client = new PaymasterClient({
  apiKey: 'your-api-key',
  paymasterPubkey: 'YourPaymasterPublicKey...',
  baseUrl: 'https://paymaster-api.example.com',
  network: 'mainnet',
});

// Sign a serialized transaction
const signedTx = await client.signSerializedTransaction(serializedTx);

// Sign and send
const signature = await client.signAndSendSerializedTransaction(serializedTx);
```

## API

### `PaymasterClient`

**Constructor:**

```typescript
new PaymasterClient(config: PaymasterConfig)
```

**Methods:**

- `isPaymasterFeePayer(serializedTx: SerializedTransaction): boolean`
- `signSerializedTransaction(serializedTx: SerializedTransaction): Promise<SerializedTransaction>`
- `signAndSendSerializedTransaction(serializedTx: SerializedTransaction): Promise<string>`

See the [main README](../../README.md) for full documentation.

## License

AGPL-3.0
