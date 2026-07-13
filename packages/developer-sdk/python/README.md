# Swig Developer SDK for Python

Python parity for `@swig-wallet/developer-sdk`. The Swig API prepares wallet
transactions; this SDK invokes application-owned signers and inserts signatures
locally with `solders`.

```bash
pip install swig-developer-sdk
```

## Prepare a transaction

```python
from swig_developer_sdk import SwigClient

swig = SwigClient(api_key="swig_...", network="devnet")
wallet = swig.wallets.use(
    "SWIG_CONFIG_ADDRESS",
    requester_authority={"ed25519": {"publicKey": "USER_PUBLIC_KEY"}},
)

prepared = await wallet.transfer.sol(
    fee_payer="FEE_PAYER",
    destination="DESTINATION",
    amount=1_000_000,
)
```

`wallet.transfer(...)` and `wallet.swap(...)` are callable like their
TypeScript counterparts. Their explicit `sol`, `token`, `spl_token`, and
`jupiter` methods are available as well.

## Sign locally

The generic signer helper works with an application-owned Ed25519 signer. The
Swig signer helper patches secp256r1 or secp256k1 signatures into both legacy
and versioned Solana transactions without sending signing material to the API.

```python
from swig_developer_sdk import sign_prepared_swig_transaction

signed = await sign_prepared_swig_transaction(
    prepared,
    secp256r1=application_passkey_signer,
)
```

WebAuthn and EIP-1193 adapters are callback-based so applications can connect
their browser, hardware, wallet, or remote signer without changing the
transaction preparation API.

## Local end-to-end test

With the `swig-dev-portal` Tilt stack running, this command seeds a temporary
local API key and exercises wallet creation, real P-256 signing, direct and
grouped SOL transfers, an SPL-token transfer, and the Python proxy through the
Developer API. It also verifies the live paymaster balance endpoint and a
sponsored transfer where the user pays no network fee. Every transaction is
submitted to Surfpool and verified on-chain; the paymaster flow also retries
with the same idempotency key and verifies that no balance changes repeat.

```bash
bun run e2e:developer-sdk:python
```

The defaults are `http://localhost:8080` for the Developer API,
`http://localhost:8899` for Surfpool, and the Tilt Postgres instance on port
`55432`. Override them with `SWIG_TRANSACTION_API_URL`, `SOLANA_RPC_URL`, or
`SWIG_DATABASE_URL`.

Jupiter and recovery are not counted by this local test: Jupiter needs a
mainnet-backed Surfpool, while recovery setup needs a reachable operator
signer.

See the repository-level [parity matrix](../PARITY.md) for the complete mapped
surface.
