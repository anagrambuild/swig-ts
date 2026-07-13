from __future__ import annotations

import base64
import inspect
import struct
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol, TypeAlias, TypeVar, cast

from solders.instruction import CompiledInstruction
from solders.message import Message, MessageV0
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.transaction import VersionedTransaction

from .transactions import (
    ClientSignatureRequest,
    PreparedTransaction,
    SignedPreparedTransaction,
)

SECP256R1_PROGRAM_ID = Pubkey.from_string("Secp256r1SigVerify1111111111111111111111111")
SWIG_PROGRAM_ID = Pubkey.from_string("swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB")
SIGN_V2_DISCRIMINATOR = 11
SECP256R1_AUTHORITY_PAYLOAD_SIZE = 17
SECP256R1_PUBLIC_KEY_SIZE = 33
SECP256R1_SIGNATURE_SIZE = 64
SECP256R1_HEADER_SIZE = 16
SECP256K1_AUTHORITY_PAYLOAD_SIZE = 77
SECP256K1_SIGNATURE_SIZE = 65
SECP256K1_SIGNATURE_OFFSET = 12
U16_MAX = 65535


@dataclass(frozen=True, slots=True)
class PasskeySigningResult:
    signature: bytes
    prefix: bytes | None = None
    message: bytes | None = None


@dataclass(frozen=True, slots=True)
class Secp256k1SigningResult:
    signature: bytes
    prefix: bytes | None = None
    message: bytes | None = None


T = TypeVar("T")
MaybeAwaitable: TypeAlias = T | Awaitable[T]
PasskeySigningFn: TypeAlias = Callable[[bytes], MaybeAwaitable[PasskeySigningResult]]
Secp256k1SigningFn: TypeAlias = Callable[
    [bytes], MaybeAwaitable[Secp256k1SigningResult]
]
PreparedTransactionSigningFn: TypeAlias = Callable[
    [str, PreparedTransaction], MaybeAwaitable[str]
]
Secp256r1SigningFns: TypeAlias = PasskeySigningFn | Mapping[str, PasskeySigningFn]
Secp256k1SigningFns: TypeAlias = Secp256k1SigningFn | Mapping[str, Secp256k1SigningFn]


class PreparedTransactionSigner(Protocol):
    def sign_prepared_transaction(
        self, prepared: PreparedTransaction
    ) -> MaybeAwaitable[SignedPreparedTransaction]: ...


async def sign_prepared_transaction(
    prepared: PreparedTransaction,
    *,
    sign_transaction: PreparedTransactionSigningFn,
) -> SignedPreparedTransaction:
    transaction = await _resolve(sign_transaction(prepared.transaction, prepared))
    return SignedPreparedTransaction(
        transaction=transaction,
        transaction_encoding=prepared.transaction_encoding,
        network=prepared.network,
    )


async def sign_prepared_transaction_with_signer(
    prepared: PreparedTransaction,
    signer: PreparedTransactionSigner,
) -> SignedPreparedTransaction:
    return await _resolve(signer.sign_prepared_transaction(prepared))


async def sign_prepared_swig_transaction(
    prepared: PreparedTransaction,
    *,
    secp256r1: Secp256r1SigningFns | None = None,
    secp256k1: Secp256k1SigningFns | None = None,
) -> SignedPreparedTransaction:
    if prepared.transaction_encoding not in (None, "base64"):
        raise ValueError("Only base64 prepared transactions can be signed")

    transaction = _MutableTransaction.from_bytes(base64.b64decode(prepared.transaction))
    for request in prepared.signature_requests:
        if request.scheme == "secp256r1":
            await _apply_secp256r1(transaction, request, secp256r1)
        elif request.scheme == "secp256k1":
            await _apply_secp256k1(transaction, request, secp256k1)

    return SignedPreparedTransaction(
        transaction=base64.b64encode(transaction.serialize()).decode("ascii"),
        transaction_encoding=prepared.transaction_encoding or "base64",
        network=prepared.network,
    )


async def sign_prepared_swig_transactions(
    prepared_transactions: Sequence[PreparedTransaction],
    *,
    secp256r1: Secp256r1SigningFns | None = None,
    secp256k1: Secp256k1SigningFns | None = None,
) -> tuple[SignedPreparedTransaction, ...]:
    signed: list[SignedPreparedTransaction] = []
    for prepared in prepared_transactions:
        signed.append(
            await sign_prepared_swig_transaction(
                prepared,
                secp256r1=secp256r1,
                secp256k1=secp256k1,
            )
        )
    return tuple(signed)


async def _apply_secp256r1(
    transaction: _MutableTransaction,
    request: ClientSignatureRequest,
    signing_fns: Secp256r1SigningFns | None,
) -> None:
    if signing_fns is None:
        raise ValueError("No secp256r1 signing function registered")
    public_key = _hex_to_bytes(request.signer)
    if len(public_key) != SECP256R1_PUBLIC_KEY_SIZE:
        raise ValueError("Secp256r1 signature request signer must be 33 bytes")
    message_hash = _hex_to_bytes(request.message_hash)
    signing_fn = _resolve_passkey_signing_fn(request, signing_fns)
    result = await _resolve(signing_fn(message_hash))
    if len(result.signature) != SECP256R1_SIGNATURE_SIZE:
        raise ValueError("Secp256r1 signature must be 64 bytes")

    instruction_index = _find_secp256r1_instruction(
        transaction, public_key, message_hash
    )
    transaction.set_instruction_data(
        instruction_index,
        _encode_secp256r1_instruction(
            public_key,
            result.signature,
            result.message or message_hash,
        ),
    )
    if result.prefix is not None:
        sign_v2_index = _find_following_sign_v2(transaction, instruction_index)
        transaction.set_instruction_data(
            sign_v2_index,
            _patch_authority_prefix(
                transaction.instruction_data(sign_v2_index),
                result.prefix,
                SECP256R1_AUTHORITY_PAYLOAD_SIZE,
                "secp256r1",
            ),
        )


async def _apply_secp256k1(
    transaction: _MutableTransaction,
    request: ClientSignatureRequest,
    signing_fns: Secp256k1SigningFns | None,
) -> None:
    if signing_fns is None:
        raise ValueError("No secp256k1 signing function registered")
    signing_fn = _resolve_secp256k1_signing_fn(request, signing_fns)
    message = _normalize_hex(request.message_hash).encode("ascii")
    result = await _resolve(signing_fn(message))
    if len(result.signature) != SECP256K1_SIGNATURE_SIZE:
        raise ValueError("Secp256k1 signature must be 65 bytes")
    index = _find_secp256k1_sign_v2(transaction, request)
    transaction.set_instruction_data(
        index,
        _patch_secp256k1_payload(transaction.instruction_data(index), request, result),
    )


def _resolve_passkey_signing_fn(
    request: ClientSignatureRequest,
    signing_fns: Secp256r1SigningFns,
) -> PasskeySigningFn:
    if callable(signing_fns):
        return signing_fns
    normalized = _normalize_hex(request.signer)
    signing_fn = (
        signing_fns.get(normalized)
        or signing_fns.get(f"0x{normalized}")
        or signing_fns.get(request.signer)
    )
    if signing_fn is None:
        raise ValueError(
            f"No secp256r1 signing function registered for signer {request.signer}"
        )
    return signing_fn


def _resolve_secp256k1_signing_fn(
    request: ClientSignatureRequest,
    signing_fns: Secp256k1SigningFns,
) -> Secp256k1SigningFn:
    if callable(signing_fns):
        return signing_fns
    normalized = _normalize_hex(request.signer)
    signing_fn = (
        signing_fns.get(normalized)
        or signing_fns.get(f"0x{normalized}")
        or signing_fns.get(request.signer)
    )
    if signing_fn is None:
        raise ValueError(
            f"No secp256k1 signing function registered for signer {request.signer}"
        )
    return signing_fn


class _MutableTransaction:
    def __init__(
        self,
        message: Message | MessageV0,
        signatures: Sequence[Signature],
    ) -> None:
        self.message = message
        self.signatures = list(signatures)
        self.instructions = list(message.instructions)

    @classmethod
    def from_bytes(cls, value: bytes) -> _MutableTransaction:
        transaction = VersionedTransaction.from_bytes(value)
        return cls(transaction.message, transaction.signatures)

    def program_id(self, index: int) -> Pubkey:
        instruction = self.instructions[index]
        account_keys = self.message.account_keys
        if instruction.program_id_index >= len(account_keys):
            raise ValueError(
                "Versioned transaction program id is not statically available"
            )
        return account_keys[instruction.program_id_index]

    def instruction_data(self, index: int) -> bytes:
        return bytes(self.instructions[index].data)

    def set_instruction_data(self, index: int, data: bytes) -> None:
        instruction = self.instructions[index]
        self.instructions[index] = CompiledInstruction(
            instruction.program_id_index,
            data,
            bytes(instruction.accounts),
        )

    def serialize(self) -> bytes:
        if isinstance(self.message, MessageV0):
            message: Message | MessageV0 = MessageV0(
                self.message.header,
                self.message.account_keys,
                self.message.recent_blockhash,
                self.instructions,
                self.message.address_table_lookups,
            )
        else:
            header = self.message.header
            message = Message.new_with_compiled_instructions(
                header.num_required_signatures,
                header.num_readonly_signed_accounts,
                header.num_readonly_unsigned_accounts,
                self.message.account_keys,
                self.message.recent_blockhash,
                self.instructions,
            )
        return bytes(VersionedTransaction.populate(message, self.signatures))


def _find_secp256r1_instruction(
    transaction: _MutableTransaction,
    public_key: bytes,
    message_hash: bytes,
) -> int:
    for index in range(len(transaction.instructions)):
        if transaction.program_id(index) != SECP256R1_PROGRAM_ID:
            continue
        parsed = _parse_secp256r1_instruction(transaction.instruction_data(index))
        if parsed is not None and parsed == (public_key, message_hash):
            return index
    raise ValueError("Matching secp256r1 signature instruction not found")


def _find_following_sign_v2(
    transaction: _MutableTransaction,
    secp_instruction_index: int,
) -> int:
    for index in range(secp_instruction_index + 1, len(transaction.instructions)):
        if (
            transaction.program_id(index) == SWIG_PROGRAM_ID
            and _read_u16(transaction.instruction_data(index), 0)
            == SIGN_V2_DISCRIMINATOR
        ):
            return index
    raise ValueError("Swig SignV2 instruction following secp256r1 precompile not found")


def _find_secp256k1_sign_v2(
    transaction: _MutableTransaction,
    request: ClientSignatureRequest,
) -> int:
    fallback: list[int] = []
    for index in range(len(transaction.instructions)):
        if transaction.program_id(index) != SWIG_PROGRAM_ID:
            continue
        data = transaction.instruction_data(index)
        if _read_u16(data, 0) != SIGN_V2_DISCRIMINATOR:
            continue
        offset = _authority_payload_offset(data)
        if len(data) < offset + SECP256K1_AUTHORITY_PAYLOAD_SIZE:
            continue
        fallback.append(index)
        if (
            _read_u64(data, offset) == request.slot
            and _read_u32(data, offset + 8) == request.counter
        ):
            return index
    if len(fallback) == 1:
        return fallback[0]
    raise ValueError("Matching secp256k1 Swig SignV2 instruction not found")


def _encode_secp256r1_instruction(
    public_key: bytes,
    signature: bytes,
    message: bytes,
) -> bytes:
    message_offset = (
        SECP256R1_HEADER_SIZE + SECP256R1_PUBLIC_KEY_SIZE + SECP256R1_SIGNATURE_SIZE
    )
    data = bytearray(message_offset + len(message))
    data[0] = 1
    struct.pack_into(
        "<7H",
        data,
        2,
        SECP256R1_HEADER_SIZE + SECP256R1_PUBLIC_KEY_SIZE,
        U16_MAX,
        SECP256R1_HEADER_SIZE,
        U16_MAX,
        message_offset,
        len(message),
        U16_MAX,
    )
    data[SECP256R1_HEADER_SIZE : SECP256R1_HEADER_SIZE + 33] = public_key
    signature_start = SECP256R1_HEADER_SIZE + SECP256R1_PUBLIC_KEY_SIZE
    data[signature_start : signature_start + 64] = signature
    data[message_offset:] = message
    return bytes(data)


def _parse_secp256r1_instruction(data: bytes) -> tuple[bytes, bytes] | None:
    if len(data) < SECP256R1_HEADER_SIZE or data[0] != 1:
        return None
    public_key_offset = _read_u16(data, 6)
    message_offset = _read_u16(data, 10)
    message_size = _read_u16(data, 12)
    if (
        len(data) < public_key_offset + SECP256R1_PUBLIC_KEY_SIZE
        or len(data) < message_offset + message_size
    ):
        return None
    return (
        data[public_key_offset : public_key_offset + SECP256R1_PUBLIC_KEY_SIZE],
        data[message_offset : message_offset + message_size],
    )


def _patch_authority_prefix(
    instruction_data: bytes,
    prefix: bytes,
    fixed_payload_size: int,
    scheme: str,
) -> bytes:
    offset = _authority_payload_offset(instruction_data)
    if len(instruction_data) < offset + fixed_payload_size:
        raise ValueError(
            f"Swig SignV2 instruction is missing {scheme} authority payload"
        )
    return instruction_data[: offset + fixed_payload_size] + prefix


def _patch_secp256k1_payload(
    instruction_data: bytes,
    request: ClientSignatureRequest,
    result: Secp256k1SigningResult,
) -> bytes:
    offset = _authority_payload_offset(instruction_data)
    if len(instruction_data) < offset + SECP256K1_AUTHORITY_PAYLOAD_SIZE:
        raise ValueError(
            "Swig SignV2 instruction is missing secp256k1 authority payload"
        )
    if request.slot < 0 or request.slot > 0xFFFFFFFFFFFFFFFF:
        raise ValueError("Secp256k1 signature request slot must fit in u64")
    if request.counter < 0 or request.counter > 0xFFFFFFFF:
        raise ValueError("Secp256k1 signature request counter must fit in u32")
    end = offset + SECP256K1_AUTHORITY_PAYLOAD_SIZE
    patched = bytearray(instruction_data[:end])
    struct.pack_into("<QI", patched, offset, request.slot, request.counter)
    start = offset + SECP256K1_SIGNATURE_OFFSET
    patched[start : start + SECP256K1_SIGNATURE_SIZE] = result.signature
    if result.prefix is not None:
        patched.extend(result.prefix)
    return bytes(patched)


def _authority_payload_offset(data: bytes) -> int:
    return 8 + _read_u16(data, 2)


def _normalize_hex(value: str) -> str:
    normalized = value[2:] if value.startswith("0x") else value
    if not normalized or any(
        char not in "0123456789abcdefABCDEF" for char in normalized
    ):
        raise ValueError("Invalid hex string")
    return normalized.lower()


def _hex_to_bytes(value: str) -> bytes:
    normalized = _normalize_hex(value)
    if len(normalized) % 2:
        raise ValueError("Hex strings must contain an even number of characters")
    return bytes.fromhex(normalized)


def _read_u16(data: bytes, offset: int) -> int:
    if len(data) < offset + 2:
        raise ValueError("Instruction data is too short")
    return int(struct.unpack_from("<H", data, offset)[0])


def _read_u32(data: bytes, offset: int) -> int:
    if len(data) < offset + 4:
        raise ValueError("Instruction data is too short")
    return int(struct.unpack_from("<I", data, offset)[0])


def _read_u64(data: bytes, offset: int) -> int:
    if len(data) < offset + 8:
        raise ValueError("Instruction data is too short")
    return int(struct.unpack_from("<Q", data, offset)[0])


async def _resolve(value: MaybeAwaitable[T]) -> T:
    if inspect.isawaitable(value):
        return await cast(Awaitable[T], value)
    return value
