# @swig-wallet/developer-sdk

API-key SDK for Swig wallet operations.

## Flow

The SDK shape is intentionally prepare-first:

1. Call the backend through `SwigClient`.
2. Receive a prepared transaction and intent ID.
3. Sign locally with the passkey flow.
4. Either send the signed transaction from the frontend, or submit it to the backend sponsor endpoint.

The backend endpoint names are still expected to settle, but the client-side shape should stay this simple.

## Usage

```typescript
import {
  SwigClient,
  createSecp256r1PasskeySigningFn,
} from '@swig-wallet/developer-sdk';

const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  network: 'mainnet',
});

const signingFn = createSecp256r1PasskeySigningFn({
  allowCredentials: [{ id: credentialId, type: 'public-key' }],
  userVerification: 'preferred',
});

// 1. Ask the backend to prepare the wallet creation transaction.
const wallet = await swig.wallets.create({
  policyId: 'policy_123',
  label: 'customer wallet',
  externalId: 'user_123',
});

const preparedCreate = wallet.creationTransaction;

if (!preparedCreate) {
  throw new Error('Wallet creation response did not include a transaction');
}

// 2. Sign locally with passkey.
const signedCreateTransaction = await signPreparedSwigTransaction(
  preparedCreate.transaction,
  signingFn,
);

// 3a. Option A: submit through the backend sponsor endpoint.
const createSubmission = await swig.transactions.sponsor({
  intentId: preparedCreate.intentId,
  transaction: signedCreateTransaction,
  transactionEncoding: preparedCreate.transactionEncoding,
});

console.log(createSubmission.signature);

// 3b. Option B: the frontend can send the signed transaction itself instead.
// await connection.sendRawTransaction(decodedSignedCreateTransaction);
```

The same prepare -> passkey sign -> sponsor/send flow applies to wallet actions:

```typescript
const preparedSwap = await wallet.swap({
  inputMint,
  outputMint,
  amount: 1_000_000n,
  slippageBps: 100,
});

const signedSwapTransaction = await signPreparedSwigTransaction(
  preparedSwap.transaction,
  signingFn,
);

const swapSubmission = await swig.transactions.sponsor({
  intentId: preparedSwap.intentId,
  transaction: signedSwapTransaction,
  transactionEncoding: preparedSwap.transactionEncoding,
});

console.log(swapSubmission.signature);
```

`signPreparedSwigTransaction` is a placeholder for the transaction-level passkey signing helper that will sit on top of the existing Swig secp256r1 WebAuthn signing function. The key rule is that passkey signing happens after the backend prepares the transaction, because signing may change the final instructions.

By default the SDK talks to `https://backend.prod.infra.onswig.com`.
Override it with `baseUrl`:

```typescript
const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  baseUrl: 'http://localhost:3000',
});
```

## Source layout

- `src/client.ts` wires the public `SwigClient` and default API configuration.
- `src/core` owns HTTP transport, retry defaults, and SDK errors.
- `src/passkeys` wraps Swig passkey signing helpers.
- `src/transactions` owns signed transaction submission, including sponsored send.
- `src/types` contains the public TypeScript contracts split by concern.
- `src/wallets` owns wallet handles, wallet operation clients, request shaping, and response normalization.

The intended flow is `SwigClient` -> `wallets.create` or `wallets.use` -> `wallet.transfer`, `wallet.swap`, or `wallet.execute`. Each wallet action posts an intent-style request to the backend and returns a prepared transaction. The frontend signs it, then either sends through its own Solana path or calls `swig.transactions.sponsor`.
