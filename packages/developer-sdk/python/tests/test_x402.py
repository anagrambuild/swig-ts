from __future__ import annotations

import base64
import json

import httpx
import pytest
from x402.http import (
    PAYMENT_REQUIRED_HEADER,
    PAYMENT_SIGNATURE_HEADER,
    decode_payment_signature_header,
    encode_payment_required_header,
)
from x402.schemas import PaymentPayload, PaymentRequired

from swig_developer_sdk import (
    SignedPreparedTransaction,
    SwigClient,
    create_x402_payment,
)

DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"


async def test_wallet_x402_prepares_from_response_without_an_index() -> None:
    requests: list[httpx.Request] = []
    payment_required = _payment_required()

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={"data": _prepared_response(accepted_index=1)},
        )

    wallet = _wallet(httpx.MockTransport(handler))
    prepared = await wallet.x402.prepare_from_response(
        _payment_required_response(payment_required)
    )

    assert prepared.accepted_index == 1
    assert prepared.payment_required == payment_required
    assert prepared.prepared_transaction.kind == "x402-payment"
    assert requests[0].url.path == "/transaction/payment/x402/prepare"
    assert json.loads(requests[0].content) == {
        "paymentRequired": payment_required.model_dump(
            by_alias=True, exclude_unset=True
        ),
        "network": "NETWORK_DEVNET",
        "swigAddress": "swig-config",
        "requesterAuthority": {"ed25519": {"publicKey": "developer"}},
    }


async def test_wallet_x402_forwards_an_explicit_index() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"data": _prepared_response(0)})

    wallet = _wallet(httpx.MockTransport(handler))
    prepared = await wallet.x402.prepare_from_response(
        _payment_required_response(_payment_required(svm_first=True)),
        accepted_index=0,
    )

    assert prepared.accepted_index == 0
    assert json.loads(requests[0].content)["acceptedIndex"] == 0


@pytest.mark.parametrize("accepted_index", [True, -1, 0x1_0000_0000])
async def test_wallet_x402_rejects_an_invalid_index(accepted_index: int) -> None:
    wallet = _wallet(httpx.MockTransport(lambda _request: httpx.Response(500)))
    with pytest.raises(ValueError, match="non-negative uint32"):
        await wallet.x402.prepare_from_response(
            _payment_required_response(_payment_required()),
            accepted_index=accepted_index,
        )


def test_create_x402_payment_uses_the_official_header_codec() -> None:
    payment_required = _payment_required(svm_first=True)
    prepared = _preparation_result(payment_required)
    signed = SignedPreparedTransaction(
        transaction=base64.b64encode(b"signed transaction").decode("ascii"),
        transaction_encoding="base64",
        network="devnet",
    )

    submission = create_x402_payment(prepared, signed)
    decoded = decode_payment_signature_header(
        submission.payment_signature_headers[PAYMENT_SIGNATURE_HEADER]
    )

    assert isinstance(decoded, PaymentPayload)
    assert decoded.accepted.asset == payment_required.accepts[0].asset
    assert decoded.payload == {"transaction": signed.transaction}


def _wallet(transport: httpx.AsyncBaseTransport):
    swig = SwigClient(
        api_key="secret",
        base_url="https://backend.test",
        network="devnet",
        transport=transport,
    )
    return swig.wallets.use(
        "swig-config",
        requester_authority={"ed25519": {"publicKey": "developer"}},
    )


def _payment_required(*, svm_first: bool = False) -> PaymentRequired:
    svm = {
        "scheme": "exact",
        "network": DEVNET,
        "asset": "So11111111111111111111111111111111111111112",
        "amount": "1000",
        "payTo": "resource-provider",
        "maxTimeoutSeconds": 300,
        "extra": {"feePayer": "facilitator"},
    }
    evm = {
        "scheme": "exact",
        "network": "eip155:8453",
        "asset": "0x0000000000000000000000000000000000000001",
        "amount": "1000",
        "payTo": "0x0000000000000000000000000000000000000002",
        "maxTimeoutSeconds": 300,
        "extra": {},
    }
    return PaymentRequired.model_validate(
        {
            "x402Version": 2,
            "resource": {
                "url": "https://resource.example/weather",
                "description": "Weather",
                "mimeType": "application/json",
            },
            "accepts": [svm, evm] if svm_first else [evm, svm],
        }
    )


def _payment_required_response(payment_required: PaymentRequired) -> httpx.Response:
    return httpx.Response(
        402,
        headers={
            PAYMENT_REQUIRED_HEADER: encode_payment_required_header(payment_required)
        },
    )


def _prepared_response(accepted_index: int) -> dict[str, object]:
    return {
        "acceptedIndex": accepted_index,
        "preparedTransaction": {
            "transaction": base64.b64encode(b"prepared transaction").decode("ascii"),
            "transactionEncoding": "TRANSACTION_ENCODING_BASE64",
            "network": "NETWORK_DEVNET",
            "kind": "PREPARED_TRANSACTION_KIND_X402_PAYMENT",
            "wallet": {
                "swigConfigAddress": "swig-config",
                "walletAddress": "swig-wallet",
            },
            "signatureRequests": [],
        },
    }


def _preparation_result(payment_required: PaymentRequired):
    from swig_developer_sdk import X402PreparationResult
    from swig_developer_sdk.transactions import normalize_prepared_transaction

    return X402PreparationResult(
        prepared_transaction=normalize_prepared_transaction(
            _prepared_response(0)["preparedTransaction"]
        ),
        payment_required=payment_required,
        accepted_index=0,
    )
