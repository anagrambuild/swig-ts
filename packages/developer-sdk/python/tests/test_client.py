from __future__ import annotations

import json

import httpx
import pytest

from swig_developer_sdk import (
    RetryOptions,
    SolanaAccountMeta,
    SolanaInstructionInput,
    SwigClient,
    SwigDeveloperSdkError,
    TransferSolOperation,
)


async def test_wallet_transfer_matches_typescript_wire_contract() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "transaction": "prepared-base64",
                    "transactionEncoding": "TRANSACTION_ENCODING_BASE64",
                    "network": "NETWORK_DEVNET",
                    "signatureRequests": [
                        {
                            "scheme": "AUTHORITY_SIGNATURE_SCHEME_SECP256R1",
                            "signer": "02" + "11" * 32,
                            "messageHash": "22" * 32,
                            "slot": "7",
                            "counter": 9,
                        }
                    ],
                }
            },
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    wallet = swig.wallets.use(
        "swig-address",
        requester_authority={"ed25519": {"publicKey": "requester"}},
    )
    assert callable(wallet.transfer)
    assert callable(wallet.swap)
    prepared = await wallet.transfer.sol(
        fee_payer="payer",
        destination="destination",
        amount=123,
    )

    assert prepared.transaction == "prepared-base64"
    assert prepared.network == "devnet"
    assert prepared.signature_requests[0].slot == 7
    assert requests[0].headers["Authorization"] == "Bearer secret"
    assert json.loads(requests[0].content) == {
        "network": "NETWORK_DEVNET",
        "feePayer": "payer",
        "swigAddress": "swig-address",
        "requesterAuthority": {"ed25519": {"publicKey": "requester"}},
        "destination": "destination",
        "lamports": "123",
    }


async def test_wallet_prepare_uses_batch_preparation_endpoint() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={"data": {"transactions": [], "network": "NETWORK_DEVNET"}},
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    wallet = swig.wallets.use(
        "swig-address",
        requester_authority={"ed25519": {"publicKey": "requester"}},
    )

    await wallet.prepare(
        fee_payer="payer",
        operations=(TransferSolOperation(destination="destination", amount=123),),
    )

    assert requests[0].url.path == "/transaction/prepare/batch"
    assert json.loads(requests[0].content) == {
        "network": "NETWORK_DEVNET",
        "feePayer": "payer",
        "swigAddress": "swig-address",
        "requesterAuthority": {"ed25519": {"publicKey": "requester"}},
        "operations": [
            {"transferSol": {"destination": "destination", "lamports": "123"}}
        ],
    }


async def test_wallet_build_transaction_matches_custom_preparation_contract() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "transaction": "prepared-custom-base64",
                    "transactionEncoding": "TRANSACTION_ENCODING_BASE64",
                    "network": "NETWORK_DEVNET",
                }
            },
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    wallet = swig.wallets.use(
        "swig-address",
        requester_authority={"ed25519": {"publicKey": "requester"}},
    )

    prepared = await wallet.build_transaction(
        fee_payer="payer",
        instructions=(
            SolanaInstructionInput(
                program_id="program",
                accounts=(
                    SolanaAccountMeta(
                        pubkey="account", is_signer=True, is_writable=True
                    ),
                ),
                data=b"\x01\x02\x03",
            ),
        ),
        address_lookup_table_accounts=("lookup-table",),
    )

    assert prepared.transaction == "prepared-custom-base64"
    assert requests[0].url.path == "/transaction/prepare/custom"
    assert json.loads(requests[0].content) == {
        "network": "NETWORK_DEVNET",
        "feePayer": "payer",
        "swigAddress": "swig-address",
        "requesterAuthority": {"ed25519": {"publicKey": "requester"}},
        "instructions": [
            {
                "programId": "program",
                "accounts": [
                    {
                        "pubkey": "account",
                        "isSigner": True,
                        "isWritable": True,
                    }
                ],
                "data": "AQID",
            }
        ],
        "addressLookupTableAccounts": ["lookup-table"],
    }


async def test_http_client_does_not_retry_client_errors() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(
            400,
            json={"error": {"code": "INVALID", "message": "bad request"}},
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(SwigDeveloperSdkError) as raised:
        await swig.paymaster.get_balance()
    assert raised.value.code == "INVALID"
    assert raised.value.status_code == 400
    assert attempts == 1


async def test_http_client_retries_transport_exceptions() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise RuntimeError("transport failed")

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        retry_options=RetryOptions(max_retries=1, retry_delay=0),
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(SwigDeveloperSdkError) as raised:
        await swig.paymaster.get_balance()
    assert raised.value.code == "NETWORK_ERROR"
    assert attempts == 2


async def test_required_response_fields_are_rejected() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"signatureRequests": []}})

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    wallet = swig.wallets.use(
        "swig-address",
        requester_authority={"ed25519": {"publicKey": "requester"}},
    )
    with pytest.raises(
        ValueError, match="Prepared transaction response is missing transaction"
    ):
        await wallet.transfer.sol(
            fee_payer="payer",
            destination="destination",
            amount=123,
        )
