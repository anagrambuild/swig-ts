from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, TypeAlias
from urllib.parse import quote, urlencode

from .common import Network, require_network, to_proto_network
from .core import HttpClient

_MISSING = object()

RampDirection: TypeAlias = Literal["onramp", "offramp", "transfer", "unspecified"]
ActiveRampDirection: TypeAlias = Literal["onramp", "offramp", "transfer"]
RampCustomerType: TypeAlias = Literal["individual", "business", "unspecified"]
RampTransactionType: TypeAlias = Literal[
    "crypto-purchase",
    "crypto-sell",
    "crypto-purchase-swap",
    "crypto-sell-swap",
    "transfer",
    "unspecified",
]
RampTransactionStatus: TypeAlias = Literal[
    "created",
    "pending",
    "settling",
    "settled",
    "failed",
    "declined",
    "cancelled",
    "refunded",
    "unspecified",
]
ActiveRampTransactionStatus: TypeAlias = Literal[
    "created",
    "pending",
    "settling",
    "settled",
    "failed",
    "declined",
    "cancelled",
    "refunded",
]
RampServiceProvider: TypeAlias = Literal["other", "unspecified"]
RampPaymentMethodType: TypeAlias = Literal[
    "other",
    "credit-debit-card",
    "ach",
    "bank-transfer",
    "apple-pay",
    "google-pay",
    "pix",
    "unspecified",
]


@dataclass(frozen=True, slots=True)
class RampCustomerContext:
    customer_type: RampCustomerType
    partner_application_id: str | None = None
    swig_user_id: str | None = None
    external_customer_id: str | None = None
    external_business_id: str | None = None


@dataclass(frozen=True, slots=True)
class RampWalletContext:
    wallet_id: str
    wallet_address: str
    network: Network


@dataclass(frozen=True, slots=True)
class RampSubdivisionOption:
    subdivision_code: str
    subdivision_name: str


@dataclass(frozen=True, slots=True)
class RampCountryOption:
    country_code: str
    country_name: str
    subdivisions: tuple[RampSubdivisionOption, ...]


@dataclass(frozen=True, slots=True)
class GetRampOptionsResult:
    country_codes: tuple[str, ...]
    countries: tuple[RampCountryOption, ...]
    fiat_currency_codes: tuple[str, ...]
    payment_method_types: tuple[RampPaymentMethodType, ...]
    crypto_currency_codes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class QuoteRampArgs:
    customer: RampCustomerContext
    wallet: RampWalletContext
    direction: ActiveRampDirection
    source_amount: str
    source_currency_code: str
    destination_currency_code: str
    country_code: str
    subdivision: str | None = None
    payment_method_type: RampPaymentMethodType | None = None
    service_providers: tuple[RampServiceProvider, ...] = ()


@dataclass(frozen=True, slots=True)
class RampQuote:
    quote_id: str
    direction: RampDirection
    service_provider: RampServiceProvider
    payment_method_type: RampPaymentMethodType
    source_amount: str
    source_currency_code: str
    destination_amount: str
    destination_currency_code: str
    exchange_rate: str
    total_fee: str
    network_fee: str
    transaction_fee: str
    partner_fee: str
    service_provider_code: str
    ramp_score: str | None = None
    low_kyc: bool | None = None


@dataclass(frozen=True, slots=True)
class QuoteRampResult:
    quotes: tuple[RampQuote, ...]


@dataclass(frozen=True, slots=True)
class CreateRampSessionArgs:
    customer: RampCustomerContext
    wallet: RampWalletContext
    direction: ActiveRampDirection
    selected_quote_id: str
    source_amount: str
    source_currency_code: str
    destination_currency_code: str
    country_code: str
    service_provider: RampServiceProvider
    subdivision: str | None = None
    payment_method_type: RampPaymentMethodType | None = None
    redirect_url: str | None = None


@dataclass(frozen=True, slots=True)
class CreateRampSessionResult:
    local_session_id: str
    meld_session_id: str
    external_customer_id: str
    external_session_id: str
    launch_url: str
    fallback_launch_url: str | None = None


@dataclass(frozen=True, slots=True)
class RampTransaction:
    transaction_id: str
    wallet_id: str
    direction: RampDirection
    transaction_type: RampTransactionType
    status: RampTransactionStatus
    service_provider: RampServiceProvider
    source_amount: str
    source_currency_code: str
    destination_currency_code: str
    created_at: str
    updated_at: str
    meld_transaction_id: str | None = None
    meld_session_id: str | None = None
    payment_method_type: RampPaymentMethodType | None = None
    destination_amount: str | None = None


@dataclass(frozen=True, slots=True)
class GetRampTransactionResult:
    transaction: RampTransaction | None = None


@dataclass(frozen=True, slots=True)
class ListRampTransactionsResult:
    transactions: tuple[RampTransaction, ...]


class _RampCustomerFactory:
    def direct_swig_user(
        self,
        *,
        swig_user_id: str,
        partner_application_id: str | None = None,
    ) -> RampCustomerContext:
        return RampCustomerContext(
            swig_user_id=_non_empty(swig_user_id, "swig_user_id"),
            partner_application_id=(
                partner_application_id
                if partner_application_id and partner_application_id.strip()
                else None
            ),
            customer_type="individual",
        )

    def partner_customer(
        self,
        *,
        partner_application_id: str,
        external_customer_id: str,
    ) -> RampCustomerContext:
        return RampCustomerContext(
            partner_application_id=_non_empty(
                partner_application_id, "partner_application_id"
            ),
            external_customer_id=_non_empty(
                external_customer_id, "external_customer_id"
            ),
            customer_type="individual",
        )

    def partner_business(
        self,
        *,
        partner_application_id: str,
        external_business_id: str,
    ) -> RampCustomerContext:
        return RampCustomerContext(
            partner_application_id=_non_empty(
                partner_application_id, "partner_application_id"
            ),
            external_business_id=_non_empty(
                external_business_id, "external_business_id"
            ),
            customer_type="business",
        )


ramp_customer = _RampCustomerFactory()


class RampClient:
    def __init__(
        self,
        http: HttpClient,
        default_network: Network | None = None,
    ) -> None:
        self._http = http
        self._default_network = default_network

    async def get_options(
        self,
        *,
        partner_application_id: str | None = None,
        country_code: str | None = None,
        fiat_currency_code: str | None = None,
    ) -> GetRampOptionsResult:
        path = _path_with_query(
            "/wallet/api/ramp/options",
            {
                "partnerApplicationId": partner_application_id,
                "countryCode": country_code,
                "fiatCurrencyCode": fiat_currency_code,
            },
        )
        return normalize_ramp_options(await self._http.get(path))

    async def quote(self, args: QuoteRampArgs) -> QuoteRampResult:
        return normalize_quote_ramp_result(
            await self._http.post("/wallet/api/ramp/quote", _quote_request(args))
        )

    async def create_session(
        self,
        args: CreateRampSessionArgs,
    ) -> CreateRampSessionResult:
        request = _quote_request(
            QuoteRampArgs(
                customer=args.customer,
                wallet=args.wallet,
                direction=args.direction,
                source_amount=args.source_amount,
                source_currency_code=args.source_currency_code,
                destination_currency_code=args.destination_currency_code,
                country_code=args.country_code,
                subdivision=args.subdivision,
                payment_method_type=args.payment_method_type,
            )
        )
        request.update(
            {
                "selectedQuoteId": args.selected_quote_id,
                "serviceProvider": _service_provider_to_wire(args.service_provider),
                "redirectUrl": args.redirect_url,
            }
        )
        return normalize_create_ramp_session_result(
            await self._http.post("/wallet/api/ramp/sessions", request)
        )

    async def get_transaction(
        self,
        *,
        transaction_id: str,
    ) -> GetRampTransactionResult:
        response = await self._http.get(
            f"/wallet/api/ramp/transactions/{quote(transaction_id, safe='')}"
        )
        body = _mapping(response, "Ramp transaction response")
        transaction = body.get("transaction")
        return GetRampTransactionResult(
            transaction=(
                _normalize_ramp_transaction(transaction)
                if transaction is not None
                else None
            )
        )

    async def list_transactions(
        self,
        *,
        wallet_id: str,
        network: Network | None = None,
        direction: ActiveRampDirection | None = None,
        status: ActiveRampTransactionStatus | None = None,
        limit: int | None = None,
    ) -> ListRampTransactionsResult:
        resolved_network = require_network(network, self._default_network)
        path = _path_with_query(
            f"/wallet/api/ramp/wallets/{quote(wallet_id, safe='')}/transactions",
            {
                "network": to_proto_network(resolved_network),
                "direction": (_direction_to_wire(direction) if direction else None),
                "status": _status_to_wire(status) if status else None,
                "limit": limit,
            },
        )
        body = _mapping(await self._http.get(path), "Ramp transaction response")
        transactions = body.get("transactions", [])
        if not isinstance(transactions, Sequence) or isinstance(
            transactions, (str, bytes)
        ):
            raise ValueError("Ramp transaction response has invalid transactions")
        return ListRampTransactionsResult(
            tuple(_normalize_ramp_transaction(item) for item in transactions)
        )


def normalize_ramp_options(response: object) -> GetRampOptionsResult:
    body = _mapping(response, "Ramp options response")
    country_codes = _string_tuple(
        body.get("countryCodes", body.get("country_codes", []))
    )
    return GetRampOptionsResult(
        country_codes=country_codes,
        countries=_normalize_country_options(
            body["countries"] if "countries" in body else _MISSING,
            country_codes,
        ),
        fiat_currency_codes=_string_tuple(
            body.get("fiatCurrencyCodes", body.get("fiat_currency_codes", []))
        ),
        payment_method_types=tuple(
            _normalize_payment_method(value)
            for value in _sequence(
                body.get(
                    "paymentMethodTypes",
                    body.get("payment_method_types", []),
                ),
                "paymentMethodTypes",
            )
        ),
        crypto_currency_codes=_string_tuple(
            body.get("cryptoCurrencyCodes", body.get("crypto_currency_codes", []))
        ),
    )


def normalize_quote_ramp_result(response: object) -> QuoteRampResult:
    body = _mapping(response, "Ramp quote response")
    return QuoteRampResult(
        tuple(
            _normalize_ramp_quote(item)
            for item in _sequence(body.get("quotes", []), "quotes")
        )
    )


def _normalize_country_options(
    value: object,
    country_codes: tuple[str, ...],
) -> tuple[RampCountryOption, ...]:
    if value is _MISSING:
        return _country_options_from_codes(country_codes)

    countries = _sequence(value, "countries")
    if len(countries) == 0:
        return _country_options_from_codes(country_codes)

    return tuple(_normalize_country_option(item) for item in countries)


def _country_options_from_codes(
    country_codes: tuple[str, ...],
) -> tuple[RampCountryOption, ...]:
    return tuple(
        RampCountryOption(
            country_code=country_code,
            country_name=country_code,
            subdivisions=(),
        )
        for country_code in country_codes
    )


def _normalize_country_option(value: object) -> RampCountryOption:
    body = _mapping(value, "Ramp country option")
    country_code = _required_non_empty_string(
        _pick(body, "countryCode", "country_code"),
        "countryCode",
    )
    country_name = _required_non_empty_string(
        _pick(body, "countryName", "country_name"),
        "countryName",
    )
    return RampCountryOption(
        country_code=country_code,
        country_name=country_name,
        subdivisions=tuple(
            _normalize_subdivision_option(item)
            for item in _sequence(body.get("subdivisions"), "subdivisions")
        ),
    )


def _normalize_subdivision_option(value: object) -> RampSubdivisionOption:
    body = _mapping(value, "Ramp subdivision option")
    subdivision_code = _required_non_empty_string(
        _pick(body, "subdivisionCode", "subdivision_code"),
        "subdivisionCode",
    )
    subdivision_name = _required_non_empty_string(
        _pick(body, "subdivisionName", "subdivision_name"),
        "subdivisionName",
    )
    return RampSubdivisionOption(
        subdivision_code=subdivision_code,
        subdivision_name=subdivision_name,
    )


def normalize_create_ramp_session_result(
    response: object,
) -> CreateRampSessionResult:
    body = _mapping(response, "Ramp session response")
    return CreateRampSessionResult(
        local_session_id=_required_string(
            _pick(body, "localSessionId", "local_session_id"), "localSessionId"
        ),
        meld_session_id=_required_string(
            _pick(body, "meldSessionId", "meld_session_id"), "meldSessionId"
        ),
        external_customer_id=_required_string(
            _pick(body, "externalCustomerId", "external_customer_id"),
            "externalCustomerId",
        ),
        external_session_id=_required_string(
            _pick(body, "externalSessionId", "external_session_id"),
            "externalSessionId",
        ),
        launch_url=_required_string(
            _pick(body, "launchUrl", "launch_url"), "launchUrl"
        ),
        fallback_launch_url=_optional_string(
            _pick(body, "fallbackLaunchUrl", "fallback_launch_url")
        ),
    )


def _quote_request(args: QuoteRampArgs) -> dict[str, object]:
    return {
        "customer": {
            "partnerApplicationId": args.customer.partner_application_id,
            "swigUserId": args.customer.swig_user_id,
            "externalCustomerId": args.customer.external_customer_id,
            "externalBusinessId": args.customer.external_business_id,
            "customerType": _customer_type_to_wire(args.customer.customer_type),
        },
        "wallet": {
            "walletId": args.wallet.wallet_id,
            "walletAddress": args.wallet.wallet_address,
            "network": to_proto_network(args.wallet.network),
        },
        "direction": _direction_to_wire(args.direction),
        "sourceAmount": args.source_amount,
        "sourceCurrencyCode": args.source_currency_code,
        "destinationCurrencyCode": args.destination_currency_code,
        "countryCode": args.country_code,
        "subdivision": args.subdivision,
        "paymentMethodType": (
            _payment_method_to_wire(args.payment_method_type)
            if args.payment_method_type is not None
            else None
        ),
        "serviceProviders": [
            _service_provider_to_wire(value) for value in args.service_providers
        ],
    }


def _normalize_ramp_quote(value: object) -> RampQuote:
    body = _mapping(value, "Ramp quote")
    low_kyc = _pick(body, "lowKyc", "low_kyc")
    if low_kyc is not None and not isinstance(low_kyc, bool):
        raise ValueError("Ramp response has invalid lowKyc")
    return RampQuote(
        quote_id=_required_string(_pick(body, "quoteId", "quote_id"), "quoteId"),
        direction=_normalize_direction(body.get("direction")),
        service_provider=_normalize_service_provider(
            _pick(body, "serviceProvider", "service_provider")
        ),
        payment_method_type=_normalize_payment_method(
            _pick(body, "paymentMethodType", "payment_method_type")
        ),
        source_amount=_required_string(
            _pick(body, "sourceAmount", "source_amount"), "sourceAmount"
        ),
        source_currency_code=_required_string(
            _pick(body, "sourceCurrencyCode", "source_currency_code"),
            "sourceCurrencyCode",
        ),
        destination_amount=_required_string(
            _pick(body, "destinationAmount", "destination_amount"),
            "destinationAmount",
        ),
        destination_currency_code=_required_string(
            _pick(body, "destinationCurrencyCode", "destination_currency_code"),
            "destinationCurrencyCode",
        ),
        exchange_rate=_required_string(
            _pick(body, "exchangeRate", "exchange_rate"), "exchangeRate"
        ),
        total_fee=_required_string(_pick(body, "totalFee", "total_fee"), "totalFee"),
        network_fee=_required_string(
            _pick(body, "networkFee", "network_fee"), "networkFee"
        ),
        transaction_fee=_required_string(
            _pick(body, "transactionFee", "transaction_fee"),
            "transactionFee",
        ),
        partner_fee=_required_string(
            _pick(body, "partnerFee", "partner_fee"), "partnerFee"
        ),
        ramp_score=_optional_string(_pick(body, "rampScore", "ramp_score")),
        low_kyc=low_kyc,
        service_provider_code=_required_non_empty_string(
            _pick(body, "serviceProviderCode", "service_provider_code"),
            "serviceProviderCode",
        ),
    )


def _normalize_ramp_transaction(value: object) -> RampTransaction:
    body = _mapping(value, "Ramp transaction")
    payment_method = _pick(body, "paymentMethodType", "payment_method_type")
    return RampTransaction(
        transaction_id=_required_string(
            _pick(body, "transactionId", "transaction_id"), "transactionId"
        ),
        meld_transaction_id=_optional_string(
            _pick(body, "meldTransactionId", "meld_transaction_id")
        ),
        meld_session_id=_optional_string(
            _pick(body, "meldSessionId", "meld_session_id")
        ),
        wallet_id=_required_string(_pick(body, "walletId", "wallet_id"), "walletId"),
        direction=_normalize_direction(body.get("direction")),
        transaction_type=_normalize_transaction_type(
            _pick(body, "transactionType", "transaction_type")
        ),
        status=_normalize_status(body.get("status")),
        service_provider=_normalize_service_provider(
            _pick(body, "serviceProvider", "service_provider")
        ),
        payment_method_type=(
            _normalize_payment_method(payment_method)
            if payment_method is not None
            else None
        ),
        source_amount=_required_string(
            _pick(body, "sourceAmount", "source_amount"), "sourceAmount"
        ),
        source_currency_code=_required_string(
            _pick(body, "sourceCurrencyCode", "source_currency_code"),
            "sourceCurrencyCode",
        ),
        destination_amount=_optional_string(
            _pick(body, "destinationAmount", "destination_amount")
        ),
        destination_currency_code=_required_string(
            _pick(body, "destinationCurrencyCode", "destination_currency_code"),
            "destinationCurrencyCode",
        ),
        created_at=_required_string(
            _pick(body, "createdAt", "created_at"), "createdAt"
        ),
        updated_at=_required_string(
            _pick(body, "updatedAt", "updated_at"), "updatedAt"
        ),
    )


def _direction_to_wire(value: ActiveRampDirection) -> str:
    return {
        "onramp": "RAMP_DIRECTION_ONRAMP",
        "offramp": "RAMP_DIRECTION_OFFRAMP",
        "transfer": "RAMP_DIRECTION_TRANSFER",
    }[value]


def _customer_type_to_wire(value: RampCustomerType) -> str:
    return {
        "individual": "RAMP_CUSTOMER_TYPE_INDIVIDUAL",
        "business": "RAMP_CUSTOMER_TYPE_BUSINESS",
        "unspecified": "RAMP_CUSTOMER_TYPE_UNSPECIFIED",
    }[value]


def _service_provider_to_wire(value: RampServiceProvider) -> str:
    return {
        "other": "RAMP_SERVICE_PROVIDER_OTHER",
        "unspecified": "RAMP_SERVICE_PROVIDER_UNSPECIFIED",
    }[value]


def _payment_method_to_wire(value: RampPaymentMethodType) -> str:
    return {
        "other": "RAMP_PAYMENT_METHOD_TYPE_OTHER",
        "credit-debit-card": "RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD",
        "ach": "RAMP_PAYMENT_METHOD_TYPE_ACH",
        "bank-transfer": "RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER",
        "apple-pay": "RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY",
        "google-pay": "RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY",
        "pix": "RAMP_PAYMENT_METHOD_TYPE_PIX",
        "unspecified": "RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED",
    }[value]


def _status_to_wire(value: ActiveRampTransactionStatus) -> str:
    return f"RAMP_TRANSACTION_STATUS_{value.upper()}"


def _normalize_direction(value: object) -> RampDirection:
    values: dict[object, RampDirection] = {
        "onramp": "onramp",
        "RAMP_DIRECTION_ONRAMP": "onramp",
        1: "onramp",
        "offramp": "offramp",
        "RAMP_DIRECTION_OFFRAMP": "offramp",
        2: "offramp",
        "transfer": "transfer",
        "RAMP_DIRECTION_TRANSFER": "transfer",
        3: "transfer",
        "unspecified": "unspecified",
        "RAMP_DIRECTION_UNSPECIFIED": "unspecified",
        0: "unspecified",
        None: "unspecified",
    }
    try:
        return values[value]
    except (KeyError, TypeError) as error:
        raise ValueError("Ramp response has invalid direction") from error


def _normalize_service_provider(value: object) -> RampServiceProvider:
    if value in ("other", "RAMP_SERVICE_PROVIDER_OTHER", 1):
        return "other"
    if value in (None, "unspecified", "RAMP_SERVICE_PROVIDER_UNSPECIFIED", 0):
        return "unspecified"
    raise ValueError("Ramp response has invalid serviceProvider")


def _normalize_payment_method(value: object) -> RampPaymentMethodType:
    values: dict[object, RampPaymentMethodType] = {
        "other": "other",
        "RAMP_PAYMENT_METHOD_TYPE_OTHER": "other",
        1: "other",
        "credit-debit-card": "credit-debit-card",
        "RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD": "credit-debit-card",
        2: "credit-debit-card",
        "ach": "ach",
        "RAMP_PAYMENT_METHOD_TYPE_ACH": "ach",
        3: "ach",
        "bank-transfer": "bank-transfer",
        "RAMP_PAYMENT_METHOD_TYPE_BANK_TRANSFER": "bank-transfer",
        4: "bank-transfer",
        "apple-pay": "apple-pay",
        "RAMP_PAYMENT_METHOD_TYPE_APPLE_PAY": "apple-pay",
        5: "apple-pay",
        "google-pay": "google-pay",
        "RAMP_PAYMENT_METHOD_TYPE_GOOGLE_PAY": "google-pay",
        6: "google-pay",
        "pix": "pix",
        "RAMP_PAYMENT_METHOD_TYPE_PIX": "pix",
        7: "pix",
        "unspecified": "unspecified",
        "RAMP_PAYMENT_METHOD_TYPE_UNSPECIFIED": "unspecified",
        0: "unspecified",
        None: "unspecified",
    }
    try:
        return values[value]
    except (KeyError, TypeError) as error:
        raise ValueError("Ramp response has invalid paymentMethodType") from error


def _normalize_transaction_type(value: object) -> RampTransactionType:
    values: tuple[tuple[tuple[object, ...], RampTransactionType], ...] = (
        (
            ("crypto-purchase", "RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE", 1),
            "crypto-purchase",
        ),
        (("crypto-sell", "RAMP_TRANSACTION_TYPE_CRYPTO_SELL", 2), "crypto-sell"),
        (
            ("crypto-purchase-swap", "RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE_SWAP", 3),
            "crypto-purchase-swap",
        ),
        (
            ("crypto-sell-swap", "RAMP_TRANSACTION_TYPE_CRYPTO_SELL_SWAP", 4),
            "crypto-sell-swap",
        ),
        (("transfer", "RAMP_TRANSACTION_TYPE_TRANSFER", 5), "transfer"),
        ((None, "unspecified", "RAMP_TRANSACTION_TYPE_UNSPECIFIED", 0), "unspecified"),
    )
    for candidates, normalized in values:
        if value in candidates:
            return normalized
    raise ValueError("Ramp response has invalid transactionType")


def _normalize_status(value: object) -> RampTransactionStatus:
    normalized_values: tuple[RampTransactionStatus, ...] = (
        "created",
        "pending",
        "settling",
        "settled",
        "failed",
        "declined",
        "cancelled",
        "refunded",
    )
    for index, normalized in enumerate(normalized_values, start=1):
        if value in (
            normalized,
            f"RAMP_TRANSACTION_STATUS_{normalized.upper()}",
            index,
        ):
            return normalized
    if value in (None, "unspecified", "RAMP_TRANSACTION_STATUS_UNSPECIFIED", 0):
        return "unspecified"
    raise ValueError("Ramp response has invalid status")


def _path_with_query(path: str, query_values: Mapping[str, object]) -> str:
    query = {
        key: str(value) for key, value in query_values.items() if value is not None
    }
    return f"{path}?{urlencode(query)}" if query else path


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"{label} must be an object")


def _sequence(value: object, field: str) -> Sequence[object]:
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return value
    raise ValueError(f"Ramp response has invalid {field}")


def _string_tuple(value: object) -> tuple[str, ...]:
    sequence = _sequence(value, "string list")
    if not all(isinstance(item, str) for item in sequence):
        raise ValueError("Ramp response has invalid string list")
    return tuple(item for item in sequence if isinstance(item, str))


def _required_string(value: object, field: str) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (int, bool)):
        return str(value)
    raise ValueError(f"Ramp response is missing {field}")


def _required_non_empty_string(value: object, field: str) -> str:
    if isinstance(value, str) and value.strip():
        return value
    raise ValueError(f"Ramp response is missing {field}")


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _pick(value: Mapping[str, object], *keys: str) -> object:
    for key in keys:
        if key in value:
            return value[key]
    return None


def _non_empty(value: str, field: str) -> str:
    if not value.strip():
        raise ValueError(f"{field} is required")
    return value
