from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, TypeAlias

Network: TypeAlias = Literal["mainnet", "devnet"]
Amount: TypeAlias = int | str
JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
JsonObject: TypeAlias = dict[str, JsonValue]
WalletAuthority: TypeAlias = Mapping[str, Mapping[str, object]]

DEFAULT_BACKEND_URL = "https://backend.prod.infra.onswig.com"


@dataclass(frozen=True, slots=True)
class RetryOptions:
    max_retries: int = 3
    retry_delay: float = 1.0
    backoff_multiplier: float = 2.0

    def __post_init__(self) -> None:
        if self.max_retries < 0:
            raise ValueError("max_retries must be non-negative")
        if self.retry_delay < 0:
            raise ValueError("retry_delay must be non-negative")
        if self.backoff_multiplier < 0:
            raise ValueError("backoff_multiplier must be non-negative")


@dataclass(frozen=True, slots=True)
class WalletAddressInfo:
    swig_config_address: str
    wallet_address: str
    network: Network | None = None


def wallet_address_info_from_wire(value: object) -> WalletAddressInfo:
    if not isinstance(value, Mapping):
        raise ValueError("Response is missing wallet")
    return WalletAddressInfo(
        swig_config_address=_required_string(
            value.get("swigConfigAddress", value.get("swig_config_address")),
            "swigConfigAddress",
        ),
        wallet_address=_required_string(
            value.get("walletAddress", value.get("wallet_address")),
            "walletAddress",
        ),
        network=normalize_network(value.get("network")),
    )


def wallet_authority_to_wire(authority: WalletAuthority) -> dict[str, object]:
    for scheme in ("ed25519", "secp256k1", "secp256r1"):
        value = authority.get(scheme)
        if value is None:
            continue
        public_key = value.get("publicKey", value.get("public_key"))
        if not isinstance(public_key, str) or not public_key.strip():
            raise ValueError(f"{scheme} authority requires publicKey")
        return {scheme: {"publicKey": public_key}}

    proof = authority.get("programExecProof", authority.get("program_exec_proof"))
    if proof is not None:
        role_id = proof.get("roleId", proof.get("role_id"))
        zk_proof = proof.get("zkProof", proof.get("zk_proof"))
        if not isinstance(role_id, int) or not isinstance(zk_proof, str):
            raise ValueError("programExecProof requires roleId and zkProof")
        return {"programExecProof": {"roleId": role_id, "zkProof": zk_proof}}

    raise ValueError("authority must include a supported authority")


def normalize_amount(amount: Amount) -> str:
    return str(amount)


def to_proto_network(network: Network) -> str:
    if network == "devnet":
        return "NETWORK_DEVNET"
    return "NETWORK_MAINNET"


def normalize_network(value: object) -> Network | None:
    if value in ("devnet", "NETWORK_DEVNET", 1):
        return "devnet"
    if value in ("mainnet", "NETWORK_MAINNET", 2):
        return "mainnet"
    return None


def require_network(*values: Network | None) -> Network:
    for value in values:
        if value is not None:
            return value
    raise ValueError("network is required")


def _required_string(value: object, field: str) -> str:
    if isinstance(value, str):
        return value
    raise ValueError(f"Response is missing {field}")
