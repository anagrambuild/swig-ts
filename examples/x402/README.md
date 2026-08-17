# Swig x402 example

This example runs the complete x402 payment flow in one process:

1. Setup validates or provisions the required on-chain state.
2. A facilitator verifies and settles Swig payment transactions.
3. A resource server protects a weather endpoint with x402.
4. The developer uses `wallet.x402.prepareFromResponse()` to prepare the
   payment, signs it, and retries the protected request.

The example targets Solana devnet. Set `SOLANA_RPC_URL` to the devnet RPC
endpoint used to provision the example assets and run the local facilitator.

## Configuration

From the repository root:

```sh
bun install
cp examples/x402/.env.example examples/x402/.env.local
```

Set the following values in `.env.local`:

- `SWIG_API_KEY`
- `SOLANA_RPC_URL`

The facilitator, developer, and resource-provider keypairs are optional. Setup
uses `X402_FACILITATOR_KEYPAIR`, `X402_DEVELOPER_KEYPAIR`, or
`X402_RESOURCE_PROVIDER_KEYPAIR` when provided; otherwise it generates and
remembers the missing keypair. A configured keypair is a JSON array containing
the 64 secret-key bytes.

`X402_PAYMENT_AMOUNT` is the canonical positive integer placed in the x402
requirement. It is denominated in atomic token units. When setup creates a
mint, it derives the mint decimals from the amount; for example, an amount of
`1000` creates a three-decimal mint.

## Setup state

`run.ts` always invokes setup before starting the services. Setup:

- Ensures the facilitator has enough SOL.
- Validates or creates the Swig wallet.
- Validates a configured `X402_MINT`, or creates a mint when it is omitted.
- Derives and creates the Swig and resource-provider token accounts.
- Ensures the Swig token account can cover one payment.

Generated identity keypairs, mint, and Swig values are remembered in the
gitignored `.local/state.json` file. Token-account addresses are always derived
and are not persisted.

Environment values take priority over remembered state. A Swig supplied through
the environment must already exist. If a supplied mint needs a token top-up,
the facilitator must be its mint authority.

Setup can also be run independently when only provisioning or validation is
needed:

```sh
bun --filter swig-x402-example setup
```

## Run the complete flow

Build the in-workspace developer SDK, then run the example:

```sh
bun run build
bun --filter swig-x402-example run
```

The runner starts the facilitator and resource server on ports `4022` and
`4021` by default. Set `X402_FACILITATOR_PORT` or
`X402_RESOURCE_SERVER_PORT` to override them.

When no accepted index is supplied, Swig selects the first compatible exact
Solana payment option and preserves its original position in `accepts`. The
example signs the prepared transaction, retries the protected request, and
prints both the resource and `PAYMENT-RESPONSE` header before shutting down its
local services.
