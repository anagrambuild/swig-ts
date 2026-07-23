from __future__ import annotations

import base64
import json

import base58
import httpx
import pytest

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


async def test_ramp_options_subdivisions_and_legacy_fallback() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("countryCode") == "US":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "country_codes": ["GB", "US"],
                        "countries": [
                            {
                                "country_code": "GB",
                                "country_name": "United Kingdom",
                                "subdivisions": [],
                            },
                            {
                                "country_code": "US",
                                "country_name": "United States",
                                "subdivisions": [
                                    {
                                        "subdivision_code": "US-CA",
                                        "subdivision_name": "California",
                                    },
                                    {
                                        "subdivisionCode": "US-NY",
                                        "subdivisionName": "New York",
                                    },
                                ],
                            },
                        ],
                        "fiat_currency_codes": ["USD"],
                        "payment_method_types": [
                            "RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD",
                        ],
                        "crypto_currency_codes": ["USDC_SOLANA"],
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "data": {
                    "country_codes": ["BR"],
                    "countries": [],
                    "fiat_currency_codes": ["BRL"],
                    "payment_method_types": ["RAMP_PAYMENT_METHOD_TYPE_PIX"],
                    "crypto_currency_codes": ["USDC_SOLANA"],
                }
            },
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )

    options = await swig.ramp.get_options(country_code="US", fiat_currency_code="USD")
    assert options.country_codes == ("GB", "US")
    assert options.countries[0].country_code == "GB"
    assert options.countries[0].country_name == "United Kingdom"
    assert options.countries[0].subdivisions == ()
    assert options.countries[1].country_code == "US"
    assert options.countries[1].subdivisions[0].subdivision_code == "US-CA"
    assert options.countries[1].subdivisions[0].subdivision_name == "California"
    assert options.countries[1].subdivisions[1].subdivision_code == "US-NY"
    assert options.countries[1].subdivisions[1].subdivision_name == "New York"
    assert options.payment_method_types == ("credit-debit-card",)

    legacy_options = await swig.ramp.get_options(country_code="BR")
    assert legacy_options.country_codes == ("BR",)
    assert legacy_options.countries[0].country_code == "BR"
    assert legacy_options.countries[0].country_name == "BR"
    assert legacy_options.countries[0].subdivisions == ()


async def test_ramp_options_reject_malformed_country_options() -> None:
    def client_with_countries(countries: object) -> SwigClient:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "data": {
                        "country_codes": ["US"],
                        "countries": countries,
                        "fiat_currency_codes": ["USD"],
                        "payment_method_types": [
                            "RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD",
                        ],
                        "crypto_currency_codes": ["USDC_SOLANA"],
                    }
                },
            )

        return SwigClient(
            api_key="secret",
            base_url="https://example.test",
            network="devnet",
            transport=httpx.MockTransport(handler),
        )

    cases: list[tuple[object, str]] = [
        (
            [{"country_name": "United States", "subdivisions": []}],
            "countryCode",
        ),
        (
            [{"country_code": "US", "subdivisions": []}],
            "countryName",
        ),
        (
            [{"country_code": "US", "country_name": "United States"}],
            "subdivisions",
        ),
        (
            [
                {
                    "country_code": "US",
                    "country_name": "United States",
                    "subdivisions": [{"subdivision_name": "California"}],
                }
            ],
            "subdivisionCode",
        ),
        (
            [
                {
                    "country_code": "US",
                    "country_name": "United States",
                    "subdivisions": [{"subdivision_code": "US-CA"}],
                }
            ],
            "subdivisionName",
        ),
        (
            None,
            "countries",
        ),
    ]

    for countries, error in cases:
        with pytest.raises(ValueError, match=error):
            await client_with_countries(countries).ramp.get_options()


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
                            "service_provider_code": "TRANSAK",
                        },
                        {
                            "quoteId": "quote-camel",
                            "direction": "RAMP_DIRECTION_ONRAMP",
                            "serviceProvider": "RAMP_SERVICE_PROVIDER_OTHER",
                            "paymentMethodType": "RAMP_PAYMENT_METHOD_TYPE_PIX",
                            "sourceAmount": "200",
                            "sourceCurrencyCode": "BRL",
                            "destinationAmount": "30",
                            "destinationCurrencyCode": "USDC",
                            "exchangeRate": "0.15",
                            "totalFee": "2",
                            "networkFee": "0.1",
                            "transactionFee": "1.8",
                            "partnerFee": "0.1",
                            "serviceProviderCode": "TRANSFI",
                        },
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
    assert result.quotes[0].service_provider_code == "TRANSAK"
    assert result.quotes[1].payment_method_type == "pix"
    assert result.quotes[1].service_provider_code == "TRANSFI"
    body = json.loads(requests[0].content)
    assert body["direction"] == "RAMP_DIRECTION_ONRAMP"
    assert body["customer"]["customerType"] == "RAMP_CUSTOMER_TYPE_INDIVIDUAL"
    assert body["wallet"]["network"] == "NETWORK_DEVNET"
    assert body["serviceProviders"] == ["RAMP_SERVICE_PROVIDER_OTHER"]


@pytest.mark.parametrize("provider_code", [None, "", 123, True])
async def test_ramp_quote_requires_provider_code(provider_code: object) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        quote = {
            "quote_id": "quote",
            "direction": "RAMP_DIRECTION_ONRAMP",
            "service_provider": "RAMP_SERVICE_PROVIDER_OTHER",
            "payment_method_type": "RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD",
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
        if provider_code is not None:
            quote["service_provider_code"] = provider_code

        return httpx.Response(
            200,
            json={"data": {"quotes": [quote]}},
        )

    swig = SwigClient(
        api_key="secret",
        base_url="https://example.test",
        network="devnet",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ValueError, match="serviceProviderCode"):
        await swig.ramp.quote(
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
            )
        )


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
