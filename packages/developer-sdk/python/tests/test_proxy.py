from __future__ import annotations

import json

import httpx

from swig_developer_sdk import (
    SwigProxyConfig,
    create_swig_proxy_handler,
)


async def test_proxy_prepares_transfer_with_server_resolvers() -> None:
    requests: list[httpx.Request] = []

    def backend(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "transaction": "prepared",
                    "transactionEncoding": "TRANSACTION_ENCODING_BASE64",
                    "network": "NETWORK_DEVNET",
                    "signatureRequests": [],
                }
            },
        )

    handler = create_swig_proxy_handler(
        SwigProxyConfig(
            api_key="secret",
            transaction_api_url="https://backend.test",
            network="devnet",
            fee_payer="server-payer",
            resolve_requester_pubkey=lambda _context: "server-user",
            transport=httpx.MockTransport(backend),
        )
    )
    response = await handler.handle(
        method="POST",
        path="/api/swig/transfer/sol",
        body={
            "wallet": {"swigConfigAddress": "swig"},
            "destination": "destination",
            "amount": "42",
        },
    )

    assert response.status == 200
    assert response.body == {
        "prepared": {
            "transaction": "prepared",
            "signatureRequests": [],
            "transactionEncoding": "base64",
            "network": "devnet",
        }
    }
    assert json.loads(requests[0].content) == {
        "network": "NETWORK_DEVNET",
        "feePayer": "server-payer",
        "swigAddress": "swig",
        "requesterAuthority": {"ed25519": {"publicKey": "server-user"}},
        "destination": "destination",
        "lamports": "42",
    }


async def test_proxy_requires_server_api_key() -> None:
    handler = create_swig_proxy_handler(
        SwigProxyConfig(network="devnet", fee_payer="payer")
    )
    response = await handler.handle(
        method="POST",
        path="/api/swig/wallet/create",
        body={
            "initialUser": {"ed25519": {"publicKey": "user"}},
        },
    )
    assert response.status == 500
    assert response.body == {"error": "SWIG_DEVELOPER_API_KEY is required"}


async def test_proxy_rejects_non_positive_amount_before_backend() -> None:
    handler = create_swig_proxy_handler(
        SwigProxyConfig(
            api_key="secret",
            network="devnet",
            fee_payer="payer",
            resolve_requester_pubkey=lambda _context: "user",
        )
    )
    response = await handler.handle(
        method="POST",
        path="/api/swig/transfer/sol",
        body={
            "wallet": {"swigConfigAddress": "swig"},
            "destination": "destination",
            "amount": "0",
        },
    )
    assert response.status == 400
    assert response.body == {"error": "amount must be a positive integer string"}
