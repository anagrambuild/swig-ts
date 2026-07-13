from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, TypeAlias
from urllib.parse import urlencode

from .common import Network
from .core import HttpClient

PaymasterKind: TypeAlias = Literal["api", "idp", "unspecified"]
PaymasterBalanceKind: TypeAlias = Literal["api", "idp"]


@dataclass(frozen=True, slots=True)
class PaymasterBalance:
    configured: bool
    kind: PaymasterKind
    id: str
    address: str
    label: str
    balance_lamports: str
    balance_sol: float


class PaymasterClient:
    def __init__(
        self,
        http: HttpClient,
        default_network: Network | None = None,
    ) -> None:
        self._http = http
        self._default_network = default_network

    async def get_balance(
        self,
        *,
        network: Network | None = None,
        kind: PaymasterBalanceKind | None = None,
    ) -> PaymasterBalance:
        query: dict[str, str] = {}
        resolved_network = network or self._default_network
        if resolved_network is not None:
            query["network"] = resolved_network
        if kind is not None:
            query["kind"] = (
                "PAYMASTER_KIND_API" if kind == "api" else "PAYMASTER_KIND_IDP"
            )
        suffix = f"?{urlencode(query)}" if query else ""
        return normalize_paymaster_balance(
            await self._http.get(f"/paymaster/balance{suffix}")
        )

    async def get_idp_balance(
        self,
        *,
        network: Network | None = None,
    ) -> PaymasterBalance:
        return await self.get_balance(network=network, kind="idp")


def normalize_paymaster_balance(value: object) -> PaymasterBalance:
    if not isinstance(value, Mapping):
        raise ValueError("Paymaster balance response must be an object")
    configured = value.get("configured", False)
    if not isinstance(configured, bool):
        raise ValueError("Paymaster balance response has invalid configured")
    return PaymasterBalance(
        configured=configured,
        kind=_normalize_kind(value.get("kind")),
        id=_optional_string(value.get("id")) or "",
        address=_optional_string(value.get("address")) or "",
        label=_optional_string(value.get("label")) or "",
        balance_lamports=str(
            value.get("balanceLamports", value.get("balance_lamports", "0"))
        ),
        balance_sol=_number(
            value.get("balanceSol", value.get("balance_sol", 0)),
            "balanceSol",
        ),
    )


def _normalize_kind(value: object) -> PaymasterKind:
    if value in ("api", "PAYMASTER_KIND_API", 1):
        return "api"
    if value in ("idp", "PAYMASTER_KIND_IDP", 2):
        return "idp"
    if value in (None, "unspecified", "PAYMASTER_KIND_UNSPECIFIED", 0):
        return "unspecified"
    raise ValueError("Paymaster balance response has invalid kind")


def _number(value: object, field: str) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            pass
    raise ValueError(f"Paymaster balance response is missing {field}")


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
