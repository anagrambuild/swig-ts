from __future__ import annotations

import inspect
import os
import re
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, fields, is_dataclass
from typing import Literal, TypeAlias, TypeVar, cast
from urllib.parse import unquote

import httpx

from .client import SwigClient
from .common import DEFAULT_BACKEND_URL, Network, WalletAuthority, normalize_network
from .paymaster import PaymasterBalanceKind
from .ramp import (
    ActiveRampDirection,
    ActiveRampTransactionStatus,
    CreateRampSessionArgs,
    QuoteRampArgs,
    RampCustomerContext,
    RampPaymentMethodType,
    RampServiceProvider,
    RampWalletContext,
)
from .wallets import (
    RecoveryOptions,
    TransferSolOperation,
    TransferTokenOperation,
    WalletReference,
)

PostProxyRoute: TypeAlias = Literal[
    "wallet/create",
    "prepare",
    "transfer/sol",
    "transfer/spl-token",
    "swap/jupiter",
    "ramp/quote",
    "ramp/sessions",
]
ReadProxyRoute: TypeAlias = Literal[
    "wallet/balance/usd",
    "wallet/token-balances",
    "wallet/token-transactions",
    "paymaster/balance",
    "ramp/options",
    "ramp/transaction",
    "ramp/wallet-transactions",
]
ProxyRoute: TypeAlias = PostProxyRoute | ReadProxyRoute
T = TypeVar("T")
MaybeAwaitable: TypeAlias = T | Awaitable[T]


@dataclass(frozen=True, slots=True)
class ProxyWalletReference(WalletReference):
    role_id: int | None = None
    authority_public_key: str | None = None


@dataclass(frozen=True, slots=True)
class SwigRouteContext:
    method: Literal["GET", "POST"]
    path: str
    route: ProxyRoute
    body: Mapping[str, object]
    query: Mapping[str, str]
    wallet: ProxyWalletReference | None = None
    network: Network | None = None


@dataclass(frozen=True, slots=True)
class SwigProxyConfig:
    api_key: str | None = None
    transaction_api_url: str | None = None
    base_url: str | None = None
    network: Network | None = None
    fee_payer: str | Callable[[SwigRouteContext], MaybeAwaitable[str | None]] | None = (
        None
    )
    resolve_requester_authority: (
        Callable[[SwigRouteContext], MaybeAwaitable[WalletAuthority | None]] | None
    ) = None
    resolve_requester_pubkey: (
        Callable[[SwigRouteContext], MaybeAwaitable[str | None]] | None
    ) = None
    resolve_ramp_customer: (
        Callable[[SwigRouteContext], MaybeAwaitable[RampCustomerContext | None]] | None
    ) = None
    transport: httpx.AsyncBaseTransport | None = None


@dataclass(frozen=True, slots=True)
class ProxyResponse:
    status: int
    body: Mapping[str, object]


class SwigProxyRouteError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class SwigProxyHandler:
    def __init__(self, config: SwigProxyConfig | None = None) -> None:
        self._config = config or SwigProxyConfig()

    async def handle(
        self,
        *,
        method: Literal["GET", "POST"],
        path: str,
        body: Mapping[str, object] | None = None,
        query: Mapping[str, str] | None = None,
    ) -> ProxyResponse:
        try:
            if method == "POST":
                value = await self._handle_post(path, body or {}, query or {})
            elif method == "GET":
                value = await self._handle_get(path, query or {})
            else:
                raise SwigProxyRouteError("Unsupported method", 405)
            serialized = _to_wire(value)
            if not isinstance(serialized, Mapping):
                raise TypeError("Proxy response must be an object")
            return ProxyResponse(200, serialized)
        except SwigProxyRouteError as error:
            return ProxyResponse(error.status, {"error": str(error)})
        except Exception as error:
            return ProxyResponse(400, {"error": str(error)})

    async def _handle_post(
        self,
        path: str,
        body: Mapping[str, object],
        query: Mapping[str, str],
    ) -> Mapping[str, object]:
        route = _resolve_post_route(path)
        network = _read_network(body.get("network")) or self._config.network
        wallet = None if route.startswith("ramp/") else _read_wallet(body.get("wallet"))
        context = SwigRouteContext(
            method="POST",
            path=path,
            route=route,
            body=body,
            query=query,
            wallet=wallet,
            network=network,
        )
        swig = self._client(network)
        if route == "wallet/create":
            fee_payer = await self._fee_payer(context)
            policy_id = _optional_string(body.get("policyId"))
            initial_user = _read_authority(body.get("initialUser"))
            if policy_id is None and initial_user is None:
                raise SwigProxyRouteError("policyId or initialUser is required")
            created = await swig.wallets.create(
                fee_payer=fee_payer,
                policy_id=policy_id,
                initial_user=initial_user,
                recovery=_read_recovery_options(body.get("recovery")),
                network=network,
                idempotency_key=_optional_string(body.get("idempotencyKey")),
            )
            if not created.transactions:
                raise SwigProxyRouteError(
                    "Wallet creation response is missing transaction", 502
                )
            return {"prepared": created}
        if route == "ramp/quote":
            customer = await self._ramp_customer(context)
            return cast(
                Mapping[str, object],
                _to_wire(await swig.ramp.quote(_quote_args(body, customer))),
            )
        if route == "ramp/sessions":
            customer = await self._ramp_customer(context)
            return cast(
                Mapping[str, object],
                _to_wire(await swig.ramp.create_session(_session_args(body, customer))),
            )

        required_wallet = _require_wallet(wallet)
        requester_authority = await self._requester_authority(context)
        fee_payer = await self._fee_payer(context)
        handle = swig.wallets.use(
            required_wallet,
            network=network,
            requester_authority=requester_authority,
        )
        idempotency_key = _optional_string(body.get("idempotencyKey"))
        prepared: object
        if route == "prepare":
            prepared = await handle.prepare(
                fee_payer=fee_payer,
                requester_authority=requester_authority,
                network=network,
                idempotency_key=idempotency_key,
                operations=_read_operations(body.get("operations")),
            )
        elif route == "transfer/sol":
            prepared = await handle.transfer.sol(
                fee_payer=fee_payer,
                requester_authority=requester_authority,
                network=network,
                idempotency_key=idempotency_key,
                destination=_required_string(body, "destination"),
                amount=_read_amount(body),
            )
        elif route == "transfer/spl-token":
            prepared = await handle.transfer.token(
                fee_payer=fee_payer,
                requester_authority=requester_authority,
                network=network,
                idempotency_key=idempotency_key,
                mint=_required_string(body, "mint"),
                destination_owner=_required_string(body, "destinationOwner"),
                amount=_read_amount(body),
            )
        else:
            prepared = await handle.swap.jupiter(
                fee_payer=fee_payer,
                requester_authority=requester_authority,
                network=network,
                idempotency_key=idempotency_key,
                input_mint=_required_string(body, "inputMint"),
                output_mint=_required_string(body, "outputMint"),
                amount=_read_amount(body),
                slippage_bps=_optional_int(body.get("slippageBps")),
                destination_account=_optional_string(body.get("destinationAccount")),
                wrap_and_unwrap_sol=_optional_bool(body.get("wrapAndUnwrapSol")),
                tip_amount_lamports=_optional_string(body.get("tipAmountLamports")),
                compute_unit_price_percentile=_optional_string(
                    body.get("computeUnitPricePercentile")
                ),
                max_accounts=_optional_int(body.get("maxAccounts")),
                mode=_optional_string(body.get("mode")),
                blockhash_slots_to_expiry=_optional_int(
                    body.get("blockhashSlotsToExpiry")
                ),
            )
        return {"prepared": prepared}

    async def _handle_get(
        self,
        path: str,
        query: Mapping[str, str],
    ) -> Mapping[str, object]:
        route, identifier = _resolve_read_route(path)
        network = _read_network(query.get("network")) or self._config.network
        context = SwigRouteContext(
            method="GET",
            path=path,
            route=route,
            body={},
            query=query,
            network=network,
        )
        swig = self._client(network)
        if route == "paymaster/balance":
            kind_value = query.get("kind", "").strip().upper()
            kind: PaymasterBalanceKind | None
            if kind_value in ("",):
                kind = None
            elif kind_value in ("API", "PAYMASTER_KIND_API"):
                kind = "api"
            elif kind_value in ("IDP", "PAYMASTER_KIND_IDP"):
                kind = "idp"
            else:
                raise SwigProxyRouteError("kind must be api or idp")
            return cast(
                Mapping[str, object],
                _to_wire(await swig.paymaster.get_balance(network=network, kind=kind)),
            )
        if route == "ramp/options":
            customer = await self._resolved_ramp_customer(context)
            return cast(
                Mapping[str, object],
                _to_wire(
                    await swig.ramp.get_options(
                        partner_application_id=(
                            customer.partner_application_id
                            if customer is not None
                            else query.get("partnerApplicationId")
                        ),
                        country_code=query.get("countryCode"),
                        fiat_currency_code=query.get("fiatCurrencyCode"),
                    )
                ),
            )
        if route == "ramp/transaction":
            return cast(
                Mapping[str, object],
                _to_wire(await swig.ramp.get_transaction(transaction_id=identifier)),
            )
        if route == "ramp/wallet-transactions":
            direction = _active_direction(query.get("direction"))
            status = _active_status(query.get("status"))
            return cast(
                Mapping[str, object],
                _to_wire(
                    await swig.ramp.list_transactions(
                        wallet_id=identifier,
                        network=network,
                        direction=direction,
                        status=status,
                        limit=_optional_int(query.get("limit")),
                    )
                ),
            )

        handle = swig.wallets.use(identifier, network=network)
        result: object
        if route == "wallet/balance/usd":
            result = await handle.get_usd_balance(network=network)
        elif route == "wallet/token-balances":
            result = await handle.list_token_balances(network=network)
        else:
            result = await handle.list_token_transactions(
                network=network,
                limit=_optional_int(query.get("limit")),
            )
        return cast(Mapping[str, object], _to_wire(result))

    def _client(self, network: Network | None) -> SwigClient:
        api_key = self._config.api_key or _read_env(
            "SWIG_DEVELOPER_API_KEY", "SWIG_API_KEY"
        )
        if not api_key:
            raise SwigProxyRouteError("SWIG_DEVELOPER_API_KEY is required", 500)
        base_url = (
            self._config.transaction_api_url
            or self._config.base_url
            or _read_env(
                "SWIG_TRANSACTION_API_URL",
                "SWIG_BACKEND_URL",
                "NEXT_PUBLIC_SWIG_BACKEND_URL",
            )
        )
        return SwigClient(
            api_key=api_key,
            base_url=base_url or DEFAULT_BACKEND_URL,
            network=network,
            transport=self._config.transport,
        )

    async def _fee_payer(self, context: SwigRouteContext) -> str:
        configured = self._config.fee_payer
        if callable(configured):
            configured = await _resolve(configured(context))
        value = (
            configured
            or _optional_string(context.body.get("feePayer"))
            or _read_env(
                "SWIG_FEE_PAYER",
                "SWIG_TRANSFER_FEE_PAYER",
                "SWIG_TRANSACTION_FEE_PAYER",
            )
        )
        if not value:
            raise SwigProxyRouteError("feePayer is required")
        return value

    async def _requester_authority(self, context: SwigRouteContext) -> WalletAuthority:
        authority = (
            context.wallet.requester_authority if context.wallet else None
        ) or _read_authority(context.body.get("requesterAuthority"))
        if authority is None and self._config.resolve_requester_authority:
            authority = await _resolve(
                self._config.resolve_requester_authority(context)
            )
        if authority is None and self._config.resolve_requester_pubkey:
            public_key = await _resolve(self._config.resolve_requester_pubkey(context))
            if public_key:
                authority = {"ed25519": {"publicKey": public_key}}
        if authority is None:
            raise SwigProxyRouteError("requesterAuthority is required")
        return authority

    async def _resolved_ramp_customer(
        self, context: SwigRouteContext
    ) -> RampCustomerContext | None:
        if self._config.resolve_ramp_customer is None:
            return None
        return await _resolve(self._config.resolve_ramp_customer(context))

    async def _ramp_customer(self, context: SwigRouteContext) -> RampCustomerContext:
        resolved = await self._resolved_ramp_customer(context)
        if resolved is not None:
            return resolved
        return _read_ramp_customer(context.body.get("customer"))


def create_swig_proxy_handler(
    config: SwigProxyConfig | None = None,
) -> SwigProxyHandler:
    return SwigProxyHandler(config)


def _resolve_post_route(path: str) -> PostProxyRoute:
    routes: tuple[PostProxyRoute, ...] = (
        "wallet/create",
        "prepare",
        "transfer/sol",
        "transfer/spl-token",
        "swap/jupiter",
        "ramp/quote",
        "ramp/sessions",
    )
    normalized = path.rstrip("/")
    for route in routes:
        if normalized == f"/{route}" or normalized.endswith(f"/{route}"):
            return route
    raise SwigProxyRouteError("Unsupported Swig route", 404)


def _resolve_read_route(path: str) -> tuple[ReadProxyRoute, str]:
    normalized = path.rstrip("/")
    if normalized.endswith("/paymaster/balance"):
        return "paymaster/balance", ""
    if normalized.endswith("/ramp/options"):
        return "ramp/options", ""
    match = re.search(r"/ramp/transactions/([^/]+)$", normalized)
    if match:
        return "ramp/transaction", unquote(match.group(1))
    match = re.search(r"/ramp/wallets/([^/]+)/transactions$", normalized)
    if match:
        return "ramp/wallet-transactions", unquote(match.group(1))
    match = re.search(
        r"/wallet/([^/]+)/(balance/usd|token-balances|token-transactions)$",
        normalized,
    )
    if not match:
        raise SwigProxyRouteError("Unsupported Swig route", 404)
    route_map: dict[str, ReadProxyRoute] = {
        "balance/usd": "wallet/balance/usd",
        "token-balances": "wallet/token-balances",
        "token-transactions": "wallet/token-transactions",
    }
    return route_map[match.group(2)], unquote(match.group(1))


def _read_wallet(value: object) -> ProxyWalletReference | None:
    if value is None:
        return None
    body = _mapping(value, "wallet")
    return ProxyWalletReference(
        swig_config_address=_required_string(body, "swigConfigAddress"),
        wallet_address=_optional_string(body.get("walletAddress")),
        role_id=_optional_int(body.get("roleId")),
        authority_public_key=_optional_string(body.get("authorityPublicKey")),
        requester_authority=_read_authority(body.get("requesterAuthority")),
        network=_read_network(body.get("network")),
    )


def _read_authority(value: object) -> WalletAuthority | None:
    if value is None:
        return None
    body = _mapping(value, "authority")
    for scheme in ("ed25519", "secp256k1", "secp256r1"):
        nested = body.get(scheme)
        if isinstance(nested, Mapping):
            public_key = _optional_string(nested.get("publicKey"))
            if public_key:
                return {scheme: {"publicKey": public_key}}
    proof = body.get("programExecProof")
    if isinstance(proof, Mapping):
        role_id = _optional_int(proof.get("roleId"))
        zk_proof = _optional_string(proof.get("zkProof"))
        if role_id is not None and zk_proof:
            return {"programExecProof": {"roleId": role_id, "zkProof": zk_proof}}
    raise SwigProxyRouteError("authority must include a supported authority")


def _read_recovery_options(value: object) -> RecoveryOptions | None:
    if value is None:
        return None
    body = _mapping(value, "recovery")
    return RecoveryOptions(
        guardian_pubkey=_optional_string(body.get("guardianPubkey")),
        delay_seconds=_optional_int(body.get("delaySeconds")),
        target_role_id=_optional_int(body.get("targetRoleId")),
    )


def _read_operations(
    value: object,
) -> tuple[TransferSolOperation | TransferTokenOperation, ...]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or not value:
        raise SwigProxyRouteError("operations must be a non-empty array")
    operations: list[TransferSolOperation | TransferTokenOperation] = []
    for index, item in enumerate(value):
        body = _mapping(item, f"operations[{index}]")
        if body.get("type") == "transferSol":
            operations.append(
                TransferSolOperation(
                    _required_string(body, "destination"), _read_amount(body)
                )
            )
        elif body.get("type") == "transferToken":
            operations.append(
                TransferTokenOperation(
                    _required_string(body, "mint"),
                    _required_string(body, "destinationOwner"),
                    _read_amount(body),
                )
            )
        else:
            raise SwigProxyRouteError(
                f"operations[{index}].type must be transferSol or transferToken"
            )
    return tuple(operations)


def _quote_args(
    body: Mapping[str, object], customer: RampCustomerContext
) -> QuoteRampArgs:
    return QuoteRampArgs(
        customer=customer,
        wallet=_read_ramp_wallet(body.get("wallet")),
        direction=_required_active_direction(_required_string(body, "direction")),
        source_amount=_required_string(body, "sourceAmount"),
        source_currency_code=_required_string(body, "sourceCurrencyCode"),
        destination_currency_code=_required_string(body, "destinationCurrencyCode"),
        country_code=_required_string(body, "countryCode"),
        subdivision=_optional_string(body.get("subdivision")),
        payment_method_type=_payment_method(body.get("paymentMethodType")),
        service_providers=_service_providers(body.get("serviceProviders")),
    )


def _session_args(
    body: Mapping[str, object], customer: RampCustomerContext
) -> CreateRampSessionArgs:
    provider = _service_provider(body.get("serviceProvider"))
    return CreateRampSessionArgs(
        customer=customer,
        wallet=_read_ramp_wallet(body.get("wallet")),
        direction=_required_active_direction(_required_string(body, "direction")),
        selected_quote_id=_required_string(body, "selectedQuoteId"),
        source_amount=_required_string(body, "sourceAmount"),
        source_currency_code=_required_string(body, "sourceCurrencyCode"),
        destination_currency_code=_required_string(body, "destinationCurrencyCode"),
        country_code=_required_string(body, "countryCode"),
        subdivision=_optional_string(body.get("subdivision")),
        service_provider=provider,
        payment_method_type=_payment_method(body.get("paymentMethodType")),
        redirect_url=_optional_string(body.get("redirectUrl")),
    )


def _read_ramp_customer(value: object) -> RampCustomerContext:
    body = _mapping(value, "customer")
    customer_type = body.get("customerType")
    if customer_type not in ("individual", "business", "unspecified"):
        raise SwigProxyRouteError("customer.customerType is required")
    return RampCustomerContext(
        customer_type=customer_type,
        partner_application_id=_optional_string(body.get("partnerApplicationId")),
        swig_user_id=_optional_string(body.get("swigUserId")),
        external_customer_id=_optional_string(body.get("externalCustomerId")),
        external_business_id=_optional_string(body.get("externalBusinessId")),
    )


def _read_ramp_wallet(value: object) -> RampWalletContext:
    body = _mapping(value, "wallet")
    network = _read_network(body.get("network"))
    if network is None:
        raise SwigProxyRouteError("wallet.network is required")
    return RampWalletContext(
        wallet_id=_required_string(body, "walletId"),
        wallet_address=_required_string(body, "walletAddress"),
        network=network,
    )


def _read_amount(body: Mapping[str, object]) -> str:
    amount = _required_string(body, "amount")
    if not amount.isdigit() or int(amount) <= 0:
        raise SwigProxyRouteError("amount must be a positive integer string")
    return amount


def _active_direction(value: object) -> ActiveRampDirection | None:
    if value in ("onramp", "offramp", "transfer"):
        return value
    return None


def _required_active_direction(value: object) -> ActiveRampDirection:
    direction = _active_direction(value)
    if direction is None:
        raise SwigProxyRouteError("direction is required")
    return direction


def _active_status(value: object) -> ActiveRampTransactionStatus | None:
    statuses = (
        "created",
        "pending",
        "settling",
        "settled",
        "failed",
        "declined",
        "cancelled",
        "refunded",
    )
    return cast(ActiveRampTransactionStatus, value) if value in statuses else None


def _payment_method(value: object) -> RampPaymentMethodType | None:
    values = (
        "other",
        "credit-debit-card",
        "ach",
        "bank-transfer",
        "apple-pay",
        "google-pay",
        "pix",
        "unspecified",
    )
    if value is None:
        return None
    if value not in values:
        raise SwigProxyRouteError("Invalid ramp payment method type")
    return cast(RampPaymentMethodType, value)


def _service_provider(value: object) -> RampServiceProvider:
    if value not in ("other", "unspecified"):
        raise SwigProxyRouteError("Invalid ramp service provider")
    return value


def _service_providers(value: object) -> tuple[RampServiceProvider, ...]:
    if value is None:
        return ()
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise SwigProxyRouteError("serviceProviders must be an array")
    return tuple(_service_provider(item) for item in value)


def _require_wallet(value: ProxyWalletReference | None) -> ProxyWalletReference:
    if value is None:
        raise SwigProxyRouteError("wallet is required")
    return value


def _read_network(value: object) -> Network | None:
    if isinstance(value, str) and value in ("1", "2"):
        value = int(value)
    return normalize_network(value)


def _required_string(body: Mapping[str, object], key: str) -> str:
    value = _optional_string(body.get(key))
    if not value:
        raise SwigProxyRouteError(f"{key} is required")
    return value


def _optional_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_int(value: object) -> int | None:
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return None
    return None


def _optional_bool(value: object) -> bool | None:
    return value if isinstance(value, bool) else None


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    raise SwigProxyRouteError(f"{label} must be an object")


def _read_env(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def _to_wire(value: object) -> object:
    if is_dataclass(value) and not isinstance(value, type):
        result: dict[str, object] = {}
        for field in fields(value):
            item = getattr(value, field.name)
            if item is not None:
                result[_snake_to_camel(field.name)] = _to_wire(item)
        return result
    if isinstance(value, Mapping):
        return {
            str(key): _to_wire(item) for key, item in value.items() if item is not None
        }
    if isinstance(value, (list, tuple)):
        return [_to_wire(item) for item in value]
    return value


def _snake_to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


async def _resolve(value: MaybeAwaitable[T]) -> T:
    if inspect.isawaitable(value):
        return await cast(Awaitable[T], value)
    return value
