from __future__ import annotations

import base64
import struct

import pytest
from solders.hash import Hash
from solders.instruction import CompiledInstruction
from solders.message import Message, MessageHeader, MessageV0
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction

from swig_developer_sdk import (
    ClientSignatureRequest,
    PasskeySigningResult,
    PreparedTransaction,
    Secp256k1SigningResult,
    sign_prepared_swig_transaction,
    sign_prepared_swig_transactions,
)

SECP256R1_PROGRAM_ID = Pubkey.from_string("Secp256r1SigVerify1111111111111111111111111")
SWIG_PROGRAM_ID = Pubkey.from_string("swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB")
FEE_PAYER = Pubkey.from_string("2bDoQTvcRuAL8bA7igx6cjSZHH3wJqVg1vsYrUjeTWyP")


@pytest.mark.parametrize("versioned", [False, True])
async def test_sign_prepared_swig_transaction_patches_r1(
    versioned: bool,
) -> None:
    public_key = bytes([2, *range(1, 33)])
    message_hash = bytes(range(1, 33))
    signature = bytes(255 - index for index in range(64))
    signed_message = bytes((9, 8, 7, 6))
    prefix = bytes((1, 3, 5, 7))
    prepared = _prepared_r1(public_key, message_hash, versioned=versioned)

    async def sign(challenge: bytes) -> PasskeySigningResult:
        assert challenge == message_hash
        return PasskeySigningResult(
            signature=signature,
            message=signed_message,
            prefix=prefix,
        )

    result = await sign_prepared_swig_transaction(prepared, secp256r1=sign)
    transaction = VersionedTransaction.from_bytes(base64.b64decode(result.transaction))
    instructions = transaction.message.instructions
    secp_data = bytes(instructions[0].data)
    swig_data = bytes(instructions[1].data)

    signature_offset = _u16(secp_data, 2)
    public_key_offset = _u16(secp_data, 6)
    message_offset = _u16(secp_data, 10)
    message_size = _u16(secp_data, 12)
    assert secp_data[public_key_offset : public_key_offset + 33] == public_key
    assert secp_data[signature_offset : signature_offset + 64] == signature
    assert secp_data[message_offset : message_offset + message_size] == signed_message
    assert _authority_payload(swig_data) == _base_r1_payload() + prefix
    assert result.transaction_encoding == "base64"
    assert result.network == "devnet"


async def test_sign_prepared_swig_transaction_patches_k1() -> None:
    public_key = bytes([2, *range(20, 52)])
    message_hash = bytes(200 - index for index in range(32)).hex()
    signature = bytes([*range(64), 27])
    prefix = b"\x19Ethereum Signed Message:\n64"
    prepared = _prepared_k1(public_key, message_hash, slot=12, counter=34)

    async def sign(message: bytes) -> Secp256k1SigningResult:
        assert message == message_hash.encode("ascii")
        return Secp256k1SigningResult(signature=signature, prefix=prefix)

    result = await sign_prepared_swig_transaction(prepared, secp256k1=sign)
    transaction = VersionedTransaction.from_bytes(base64.b64decode(result.transaction))
    payload = _authority_payload(bytes(transaction.message.instructions[0].data))
    assert struct.unpack_from("<Q", payload, 0)[0] == 12
    assert struct.unpack_from("<I", payload, 8)[0] == 34
    assert payload[12:77] == signature
    assert payload[77:] == prefix


async def test_sign_prepared_swig_transactions_is_sequential() -> None:
    challenges: list[bytes] = []
    hashes = (bytes(range(1, 33)), bytes(range(40, 72)))
    prepared = tuple(
        _prepared_r1(bytes([2, *range(index, index + 32)]), message_hash)
        for index, message_hash in enumerate(hashes, start=1)
    )

    async def sign(challenge: bytes) -> PasskeySigningResult:
        challenges.append(challenge)
        return PasskeySigningResult(signature=bytes(range(64)))

    signed = await sign_prepared_swig_transactions(prepared, secp256r1=sign)
    assert len(signed) == 2
    assert challenges == list(hashes)


def _prepared_r1(
    public_key: bytes,
    message_hash: bytes,
    *,
    versioned: bool = False,
) -> PreparedTransaction:
    instructions = [
        CompiledInstruction(
            1,
            _r1_instruction_data(public_key, bytes(64), message_hash),
            b"",
        ),
        CompiledInstruction(2, _sign_v2_data(_base_r1_payload()), b""),
    ]
    return PreparedTransaction(
        transaction=_transaction_base64(instructions, versioned=versioned),
        transaction_encoding="base64",
        network="devnet",
        signature_requests=(
            ClientSignatureRequest(
                scheme="secp256r1",
                signer=public_key.hex(),
                message_hash=message_hash.hex(),
                slot=1,
                counter=1,
            ),
        ),
    )


def _prepared_k1(
    public_key: bytes,
    message_hash: str,
    *,
    slot: int,
    counter: int,
) -> PreparedTransaction:
    payload = bytearray(77)
    struct.pack_into("<QI", payload, 0, slot, counter)
    return PreparedTransaction(
        transaction=_transaction_base64(
            [CompiledInstruction(1, _sign_v2_data(bytes(payload)), b"")]
        ),
        transaction_encoding="base64",
        network="devnet",
        signature_requests=(
            ClientSignatureRequest(
                scheme="secp256k1",
                signer=public_key.hex(),
                message_hash=message_hash,
                slot=slot,
                counter=counter,
            ),
        ),
    )


def _transaction_base64(
    instructions: list[CompiledInstruction],
    *,
    versioned: bool = False,
) -> str:
    program_ids = (
        [SECP256R1_PROGRAM_ID, SWIG_PROGRAM_ID]
        if len(instructions) == 2
        else [SWIG_PROGRAM_ID]
    )
    account_keys = [FEE_PAYER, *program_ids]
    if versioned:
        message: Message | MessageV0 = MessageV0(
            MessageHeader(1, 0, len(program_ids)),
            account_keys,
            Hash.default(),
            instructions,
            [],
        )
    else:
        message = Message.new_with_compiled_instructions(
            1,
            0,
            len(program_ids),
            account_keys,
            Hash.default(),
            instructions,
        )
    transaction = VersionedTransaction.populate(message, [])
    return base64.b64encode(bytes(transaction)).decode("ascii")


def _r1_instruction_data(
    public_key: bytes,
    signature: bytes,
    message: bytes,
) -> bytes:
    message_offset = 16 + len(public_key) + len(signature)
    data = bytearray(message_offset + len(message))
    data[0] = 1
    struct.pack_into(
        "<7H",
        data,
        2,
        16 + len(public_key),
        65535,
        16,
        65535,
        message_offset,
        len(message),
        65535,
    )
    data[16 : 16 + len(public_key)] = public_key
    data[16 + len(public_key) : message_offset] = signature
    data[message_offset:] = message
    return bytes(data)


def _sign_v2_data(authority_payload: bytes) -> bytes:
    compact_payload = bytes((11, 22, 33))
    data = bytearray(8 + len(compact_payload) + len(authority_payload))
    struct.pack_into("<HHI", data, 0, 11, len(compact_payload), 0)
    data[8 : 8 + len(compact_payload)] = compact_payload
    data[8 + len(compact_payload) :] = authority_payload
    return bytes(data)


def _base_r1_payload() -> bytes:
    return bytes(range(1, 18))


def _authority_payload(data: bytes) -> bytes:
    return data[8 + _u16(data, 2) :]


def _u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]
