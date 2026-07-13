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

See the repository-level [parity matrix](../PARITY.md) for the complete mapped
surface.
