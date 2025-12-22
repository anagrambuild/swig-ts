# @swig-paymaster/kit

Paymaster client for @solana/kit (web3.js 2.0).

## Installation

```bash
npm install @swig-paymaster/kit
# or
bun install @swig-paymaster/kit
```

## Usage

```typescript
import { createPaymasterClient } from '@swig-paymaster/kit';
import { address } from '@solana/kit';

const paymaster = createPaymasterClient({
  apiKey: 'your-api-key',
  paymasterPubkey: address('YourPaymasterPublicKey...'),
  baseUrl: 'https://paymaster-api.example.com',
  network: 'mainnet',
});

// Create transaction
const tx = await paymaster.createTransaction([instruction], [signer]);

// Sign and send
const signature = await paymaster.signAndSend(tx);
```

## API

### `createPaymasterClient(config)`

Factory function to create a new paymaster client instance.

### `PaymasterClient`

**Methods:**

- `createTransaction(instructions, signers?): Promise<Transaction>`
- `sign(transaction): Promise<Transaction>`
- `fullySign(transaction): Promise<FullySignedTransaction>`
- `signAndSend(transaction): Promise<string>`
- `signTransactionMessage(txMessage): Promise<Transaction>`
- `signSerializedTransaction(serializedTx): Promise<SerializedTransaction>`
- `signAndSendSerializedTransaction(serializedTx): Promise<string>`

See the [main README](../../README.md) for full documentation.

## License

AGPL-3.0
