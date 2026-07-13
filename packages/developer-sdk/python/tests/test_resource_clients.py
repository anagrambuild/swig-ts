from __future__ import annotations

import base64
import json

import base58
import httpx

from swig_developer_sdk import (
    QuoteRampArgs,
    RampWalletContext,
    SponsorSignedTransactionArgs,
    SwigClient,
    ramp_customer,
)


async def test_sponsor_converts_base64_transaction_to_base58() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={"data": {"signature": "chain-signature", "status": "submitted"}},
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    transaction = b"\x00\x01\x02\xff"
    submitted = await swig.transactions.sponsor(
        SponsorSignedTransactionArgs(
            transaction=base64.b64encode(transaction).decode("ascii"),
            idempotency_key="sponsor-request-123",
        )
    )
    assert submitted.signature == "chain-signature"
    assert json.loads(requests[0].content) == {
        "base58_encoded_transaction": base58.b58encode(transaction).decode("ascii"),
        "network": "devnet",
        "idempotencyKey": "sponsor-request-123",
    }


async def test_ramp_quote_matches_enum_and_normalization_contract() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "quotes": [
                        {
                            "quote_id": "quote",
                            "direction": "RAMP_DIRECTION_ONRAMP",
                            "service_provider": "RAMP_SERVICE_PROVIDER_OTHER",
                            "payment_method_type": "RAMP_PAYMENT_METHOD_TYPE_ACH",
                            "source_amount": "100",
                            "source_currency_code": "USD",
                            "destination_amount": "99",
                            "destination_currency_code": "USDC",
                            "exchange_rate": "1",
                            "total_fee": "1",
                            "network_fee": "0.1",
                            "transaction_fee": "0.8",
                            "partner_fee": "0.1",
                        }
                    ]
                }
            },
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    result = await swig.ramp.quote(
        QuoteRampArgs(
            customer=ramp_customer.partner_customer(
                partner_application_id="partner",
                external_customer_id="customer",
            ),
            wallet=RampWalletContext("wallet-id", "wallet-address", "devnet"),
            direction="onramp",
            source_amount="100",
            source_currency_code="USD",
            destination_currency_code="USDC",
            country_code="US",
            payment_method_type="ach",
            service_providers=("other",),
        )
    )
    assert result.quotes[0].payment_method_type == "ach"
    body = json.loads(requests[0].content)
    assert body["direction"] == "RAMP_DIRECTION_ONRAMP"
    assert body["customer"]["customerType"] == "RAMP_CUSTOMER_TYPE_INDIVIDUAL"
    assert body["wallet"]["network"] == "NETWORK_DEVNET"
    assert body["serviceProviders"] == ["RAMP_SERVICE_PROVIDER_OTHER"]


async def test_paymaster_idp_balance_uses_typed_query() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "configured": True,
                    "kind": "PAYMASTER_KIND_IDP",
                    "balance_lamports": "10",
                    "balance_sol": 0.00000001,
                }
            },
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )
    balance = await swig.paymaster.get_idp_balance()
    assert balance.kind == "idp"
    assert balance.balance_lamports == "10"
    assert requests[0].url.params["kind"] == "PAYMASTER_KIND_IDP"
