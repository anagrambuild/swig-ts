from __future__ import annotations

import hashlib
import inspect
import struct
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeAlias

from .signing import PasskeySigningFn, PasskeySigningResult

R1_AUTHENTICATION_TYPE_WEBAUTHN_RAW_CLIENT_DATA_JSON = 2
SECP256R1_SCALAR_SIZE = 32
P256_ORDER = int(
    "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
    16,
)
P256_HALF_ORDER = P256_ORDER >> 1


@dataclass(frozen=True, slots=True)
class WebAuthnAssertion:
    authenticator_data: bytes
    client_data_json: bytes
    signature: bytes


WebAuthnAssertionFn: TypeAlias = Callable[
    [bytes], WebAuthnAssertion | Awaitable[WebAuthnAssertion]
]


def create_secp256r1_passkey_signing_fn(
    get_assertion: WebAuthnAssertionFn,
) -> PasskeySigningFn:
    async def sign(message: bytes) -> PasskeySigningResult:
        assertion = get_assertion(message)
        if inspect.isawaitable(assertion):
            assertion = await assertion
        client_data_hash = hashlib.sha256(assertion.client_data_json).digest()
        return PasskeySigningResult(
            signature=secp256r1_der_to_raw_signature(assertion.signature),
            prefix=_raw_webauthn_prefix(
                assertion.client_data_json,
                assertion.authenticator_data,
            ),
            message=assertion.authenticator_data + client_data_hash,
        )

    return sign


def secp256r1_der_to_raw_signature(der_signature: bytes) -> bytes:
    r, s = _parse_der_signature(der_signature)
    if s > P256_HALF_ORDER:
        s = P256_ORDER - s
    return r.to_bytes(SECP256R1_SCALAR_SIZE, "big") + s.to_bytes(
        SECP256R1_SCALAR_SIZE, "big"
    )


def _raw_webauthn_prefix(client_json: bytes, auth_data: bytes) -> bytes:
    if len(auth_data) > 0xFFFF:
        raise ValueError("WebAuthn authenticatorData is too large")
    if len(client_json) > 0xFFFF:
        raise ValueError("WebAuthn clientDataJSON is too large")
    return b"".join(
        (
            struct.pack(
                "<HH",
                R1_AUTHENTICATION_TYPE_WEBAUTHN_RAW_CLIENT_DATA_JSON,
                len(auth_data),
            ),
            auth_data,
            struct.pack("<H", len(client_json)),
            client_json,
        )
    )


def _parse_der_signature(value: bytes) -> tuple[int, int]:
    offset = 0
    if not value or value[offset] != 0x30:
        raise ValueError("Invalid secp256r1 DER signature")
    sequence_length, offset = _read_der_length(value, offset + 1)
    if offset + sequence_length != len(value):
        raise ValueError("Invalid secp256r1 DER signature length")
    r_bytes, offset = _read_der_integer(value, offset)
    s_bytes, offset = _read_der_integer(value, offset)
    if offset != len(value):
        raise ValueError("Invalid secp256r1 DER signature trailing data")
    return int.from_bytes(r_bytes, "big"), int.from_bytes(s_bytes, "big")


def _read_der_integer(value: bytes, offset: int) -> tuple[bytes, int]:
    if offset >= len(value) or value[offset] != 0x02:
        raise ValueError("Invalid secp256r1 DER signature integer")
    length, start = _read_der_length(value, offset + 1)
    end = start + length
    if length == 0 or end > len(value):
        raise ValueError("Invalid secp256r1 DER signature integer length")
    integer = value[start:end]
    if integer[0] == 0 and len(integer) > 1:
        integer = integer[1:]
    if len(integer) > SECP256R1_SCALAR_SIZE:
        raise ValueError("Secp256r1 signature integer is too large")
    return integer, end


def _read_der_length(value: bytes, offset: int) -> tuple[int, int]:
    if offset >= len(value):
        raise ValueError("Invalid secp256r1 DER signature length")
    first = value[offset]
    if first < 0x80:
        return first, offset + 1
    length_bytes = first & 0x7F
    if length_bytes == 0 or length_bytes > 2:
        raise ValueError("Unsupported secp256r1 DER signature length")
    end = offset + 1 + length_bytes
    if end > len(value):
        raise ValueError("Invalid secp256r1 DER signature length")
    return int.from_bytes(value[offset + 1 : end], "big"), end
