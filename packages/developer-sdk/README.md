# @swig-wallet/developer-sdk

API-key SDK for preparing Swig wallet operations on a server and signing the
prepared transaction from a client.

## Flow

The SDK is prepare-first:

1. Your server creates a `SwigClient` with an API key.
2. Your server prepares a wallet operation and receives one or more unsigned
   transactions.
3. Your client signs any transactions that require client authority.
4. Your app submits the ordered transactions directly or through a backend
   sponsor endpoint.

## Framework Proxy Routes

If your app only needs an API-key proxy and does not need to inspect or modify
prepared transactions, use the framework route helpers:

- [Next.js](./next/README.md)
- [NestJS](./nest/README.md)

## Server-Side TypeScript SDK

Use the TypeScript server SDK when you want control over the route shape, auth
context, request validation, response format, or any transaction massage before
returning a prepared payload to the client.

Create an API key from the [Swig dashboard](https://dashboard.onswig.com).

```typescript
import { SwigClient } from '@swig-wallet/developer-sdk/server/typescript';

const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  network: 'mainnet',
});
```

By default the SDK talks to `https://backend.prod.infra.onswig.com`. Override it
with `baseUrl`:

```typescript
const swig = new SwigClient({
  apiKey: process.env.SWIG_API_KEY!,
  baseUrl: 'http://localhost:8080',
  network: 'devnet',
});
```

### Create Wallet

```typescript
const created = await swig.wallets.create({
  feePayer,
  initialUser: {
    ed25519: {
      publicKey: userPublicKey,
    },
  },
});

return {
  wallet: created.wallet,
  transactions: created.transactions,
  transactionsToSign: created.clientAuthorityTransactions,
};
```

If `policyId` is omitted, the backend can create a no-recovery policy from an
inline `initialUser`. For a passkey initial user, provide the secp256r1 public
key:

```typescript
const created = await swig.wallets.create({
  feePayer,
  initialUser: {
    secp256r1: {
      publicKey: passkeyPublicKey,
    },
  },
});

return {
  wallet: created.wallet,
  transactions: created.transactions,
  clientAuthorityTransactions: created.clientAuthorityTransactions,
  operatorSignedTransactions: created.operatorSignedTransactions,
  feePayerOnlyTransactions: created.feePayerOnlyTransactions,
};
```

Wallet creation returns `transactions` in the order they should be submitted.
For recovery-enabled create flows, the create transaction is fee-payer only, the
add-authority transaction is signed by the initial user, and the
configure-recovery transaction is signed by the backend recovery operator before
it is returned. Submit each transaction in order after applying any required
client authority signature. A prepared transaction needs a client authority
signature when `signatureRequests.length > 0`.

### Prepare Grouped Operations

Use `wallet.prepare` when multiple operations should be built into one backend
shaped transaction. The backend decides the final instruction layout and derives
token accounts for token transfers.

```typescript
const prepared = await wallet.prepare({
  feePayer,
  operations: [
    {
      type: 'transferSol',
      destination,
      amount: 1_000_000n,
    },
    {
      type: 'transferToken',
      mint,
      destinationOwner,
      amount: 10_000n,
    },
  ],
});

return {
  wallet: prepared.wallet,
  transactions: prepared.transactions,
  clientAuthorityTransactions: prepared.clientAuthorityTransactions,
  feePayerOnlyTransactions: prepared.feePayerOnlyTransactions,
};
```

### Prepare SOL Transfer

```typescript
const wallet = swig.wallets.use({
  swigConfigAddress,
  walletAddress,
  requesterAuthority: {
    ed25519: {
      publicKey: userPublicKey,
    },
  },
});

const preparedTransfer = await wallet.transfer.sol({
  feePayer,
  destination,
  amount: 1_000_000n,
});

return preparedTransfer;
```

### Prepare Token Transfer

Token transfers derive backend-only fields such as token program, source ATA,
destination ATA, and destination ATA creation:

```typescript
const preparedTokenTransfer = await wallet.transfer.token({
  feePayer,
  mint,
  destinationOwner,
  amount: 10_000n,
});

return preparedTokenTransfer;
```

### Prepare Swap

```typescript
const preparedSwap = await wallet.swap.jupiter({
  feePayer,
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount: 10_000n,
  slippageBps: 100,
  destinationAccount,
  wrapAndUnwrapSol: true,
});

// destinationAccount is the recipient owner. The backend derives the output
// token ATA for SPL outputs or the native destination for unwrapped SOL.
return preparedSwap;
```

## Client Signing

Client code should only sign prepared transactions. It should not hold the API
key or call the Swig backend directly.

### Solana Transaction Signing

Use this for prepared transactions whose requester authority is Ed25519.

```typescript
import {
  signPreparedTransaction,
  type PreparedTransaction,
} from '@swig-wallet/developer-sdk/client';
import { VersionedTransaction } from '@solana/web3.js';

declare const prepared: PreparedTransaction;

const signed = await signPreparedTransaction(prepared, {
  signTransaction: async (transaction) => {
    const versioned = VersionedTransaction.deserialize(
      Buffer.from(transaction, 'base64'),
    );
    versioned.sign([userKeypair]);
    return Buffer.from(versioned.serialize()).toString('base64');
  },
});
```

### Passkey Transaction Signing

Use this for any prepared transaction whose `signatureRequests` contains a
`secp256r1` request. The same pattern applies to create, transfer, token
transfer, and swap. See `examples/passkey/server.ts` and
`examples/passkey/client.ts` for the split server/client flow.

```typescript
import {
  createSecp256r1PasskeySigningFn,
  signPreparedSwigTransaction,
  signPreparedSwigTransactions,
  type PreparedTransaction,
} from '@swig-wallet/developer-sdk/client';

const passkeySigningFn = createSecp256r1PasskeySigningFn({
  allowCredentials: [{ id: credentialId, type: 'public-key' }],
  userVerification: 'preferred',
});

// The client SDK only signs. Your app owns fetching or passing in the prepared
// payload returned by the server-side SDK.
//
// const prepared = await fetch('/your-app-prepare-route', ...).then((response) =>
//   response.json(),
// );
declare const prepared: PreparedTransaction;

const signed = await signPreparedSwigTransaction(prepared, {
  secp256r1: passkeySigningFn,
});

declare const created: { clientAuthorityTransactions: PreparedTransaction[] };
const signedCreateTransactions = await signPreparedSwigTransactions(
  created.clientAuthorityTransactions,
  { secp256r1: passkeySigningFn },
);
```

After signing, pass `signed` to your app-owned send or sponsor flow. On your
server, `swig.transactions.sponsor(signed)` handles the deployed paymaster route
and base58 payload encoding expected by the backend.

For wallet creation, sign only `created.clientAuthorityTransactions` on the
client. Do not authority-sign `created.operatorSignedTransactions`; those
already include the backend recovery operator signature and only need the final
fee-payer or sponsor signature before submission.

## Recovery Flow

Recovery-enabled wallets should be created from a recovery-enabled policy. Pass
the guardian once at wallet creation; the SDK returns a `recoverySetup` plan that
can be fed directly into the setup helper.

```typescript
const created = await swig.wallets.create({
  feePayer,
  policyId,
  initialUser: {
    secp256r1: {
      publicKey: passkeyPublicKey,
    },
  },
  recovery: {
    guardianPubkey: guardianPublicKey,
    delaySeconds: 86_400,
  },
});
```

Submit the creation transaction, then prepare the recovery setup from the plan
returned by create. The add-authority transaction is signed by the current
passkey authority; the configure-recovery transaction is already signed by
Swig's recovery operator and only needs the fee payer or sponsor path.

```typescript
import { signPreparedSwigTransaction } from '@swig-wallet/developer-sdk/client';

await submitPrepared(created.creationTransaction!);

const wallet = swig.wallets.use(created.wallet);

const setup = await wallet.recovery.prepareSetup({
  feePayer,
  ...created.recoverySetup!,
});

const signedAddAuthority = await signPreparedSwigTransaction(
  setup.addAuthorityTransaction!,
  { secp256r1: passkeySigningFn },
);

await submitPrepared(signedAddAuthority);
await submitPrepared(setup.configureRecoveryTransaction!);
```

After setup, the guardian can start recovery and execute after the configured
delay. The current wallet authority can cancel a pending recovery.

```typescript
import { signPreparedTransaction } from '@swig-wallet/developer-sdk/client';

declare const signWithGuardian: Parameters<
  typeof signPreparedTransaction
>[1]['signTransaction'];

const start = await wallet.recovery.start({
  feePayer,
  guardianPubkey: guardianPublicKey,
  newAuthority: newAuthorityPublicKey,
});
const signedStart = await signPreparedTransaction(start, {
  signTransaction: signWithGuardian,
});

const cancel = await wallet.recovery.cancel({
  feePayer,
});

const execute = await wallet.recovery.execute({
  feePayer,
  newAuthority: newAuthorityPublicKey,
});
const signedExecute = await signPreparedTransaction(execute, {
  signTransaction: signWithGuardian,
});
```

The guardian signs both start and execute. The current wallet authority signs
cancel. Execute is prepared after the recovery delay has elapsed and applies the
recovered authority change.

## Public Entrypoints

- `@swig-wallet/developer-sdk/server/typescript`: API-key server SDK for manual
  transaction preparation.
- `@swig-wallet/developer-sdk/client`: client-only signing helpers.
- `@swig-wallet/developer-sdk/server`: server SDK aggregate exports.
