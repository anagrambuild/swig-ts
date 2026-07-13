from __future__ import annotations

import inspect
from collections.abc import Awaitable, Mapping, Sequence
from typing import Protocol, cast

from .signing import Secp256k1SigningFn, Secp256k1SigningResult


class Eip1193Provider(Protocol):
    def request(self, args: Mapping[str, object]) -> object: ...


def create_secp256k1_evm_signing_fn(
    *,
    provider: Eip1193Provider,
    address: str,
) -> Secp256k1SigningFn:
    async def sign(message: bytes) -> Secp256k1SigningResult:
        result = provider.request(
            {
                "method": "personal_sign",
                "params": [_bytes_to_hex(message), address],
            }
        )
        if inspect.isawaitable(result):
            result = await cast(Awaitable[object], result)
        if not isinstance(result, str):
            raise ValueError("EVM provider returned a non-string signature")
        return Secp256k1SigningResult(
            signature=_parse_evm_signature(result),
            prefix=f"\x19Ethereum Signed Message:\n{len(message)}".encode("ascii"),
        )

    return sign


def _parse_evm_signature(signature: str) -> bytes:
    normalized = signature[2:] if signature.startswith("0x") else signature
    if not normalized or any(
        character not in "0123456789abcdefABCDEF" for character in normalized
    ):
        raise ValueError("Invalid hex string")
    if len(normalized) % 2:
        raise ValueError("Hex strings must contain an even number of characters")
    value = bytearray.fromhex(normalized)
    if len(value) != 65:
        raise ValueError("EVM signature must be 65 bytes")
    value[64] = _normalize_recovery_byte(value[64])
    return bytes(value)


def _normalize_recovery_byte(value: int) -> int:
    if value in (0, 1):
        return value + 27
    if value in (27, 28):
        return value
    if value >= 35:
        return ((value - 35) % 2) + 27
    raise ValueError("EVM signature has an invalid recovery byte")


def _bytes_to_hex(value: Sequence[int]) -> str:
    return "0x" + bytes(value).hex()
