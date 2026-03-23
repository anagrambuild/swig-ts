# @swig-wallet/paymaster-classic

Paymaster client for @solana/web3.js 1.x.

## Installation

```bash
npm install @swig-wallet/paymaster-classic
# or
bun install @swig-wallet/paymaster-classic
```

## Usage

```typescript
import { createPaymasterClient } from '@swig-wallet/paymaster-classic';

const paymaster = createPaymasterClient({
  apiKey: 'your-api-key',
  paymasterPubkey: 'YourPaymasterPublicKey...',
  baseUrl: 'https://paymaster-api.example.com',
  network: 'mainnet',
});

// Create legacy transaction
const tx = await paymaster.createLegacyTransaction([instruction], [signer]);

// Sign and send
const signature = await paymaster.signAndSend(tx);
```

## API

### `createPaymasterClient(config)`

Factory function to create a new paymaster client instance.

### `PaymasterClient`

**Methods:**

- `createLegacyTransaction(instructions, signers?): Promise<Transaction>`
- `createTransaction(instructions, signers?, lookupTableAddresses?): Promise<VersionedTransaction>`
- `sign(transaction): Promise<Transaction | VersionedTransaction>`
- `signAndSend(transaction): Promise<TransactionSignature>`
- `signSerializedTransaction(serializedTx): Promise<SerializedTransaction>`
- `signAndSendSerializedTransaction(serializedTx): Promise<string>`

See the [main README](../../README.md) for full documentation.

## License

Apache-2.0
