from __future__ import annotations

import hashlib

import pytest

from swig_developer_sdk import (
    OneBusinessGrantAccessCallbackError,
    WebAuthnAssertion,
    build_one_business_grant_access_url,
    complete_one_business_grant_access,
    create_secp256k1_evm_signing_fn,
    create_secp256r1_passkey_signing_fn,
    redirect_to_one_business_grant_access,
)


async def test_evm_signing_helper_uses_personal_sign() -> None:
    class Provider:
        def __init__(self) -> None:
            self.args: object = None

        async def request(self, args: object) -> object:
            self.args = args
            return "0x" + "11" * 64 + "00"

    provider = Provider()
    sign = create_secp256k1_evm_signing_fn(
        provider=provider,
        address="0xabc",
    )
    result = await sign(b"abcd")
    assert provider.args == {
        "method": "personal_sign",
        "params": ["0x61626364", "0xabc"],
    }
    assert result.signature[-1] == 27
    assert result.prefix == b"\x19Ethereum Signed Message:\n4"


async def test_passkey_helper_builds_webauthn_result() -> None:
    client_data = b'{"type":"webauthn.get"}'
    auth_data = b"authenticator"
    der_signature = bytes.fromhex("3006020101020102")
    challenges: list[bytes] = []

    async def assertion(challenge: bytes) -> WebAuthnAssertion:
        challenges.append(challenge)
        return WebAuthnAssertion(auth_data, client_data, der_signature)

    sign = create_secp256r1_passkey_signing_fn(assertion)
    result = await sign(b"challenge")
    assert challenges == [b"challenge"]
    assert result.signature == bytes(31) + b"\x01" + bytes(31) + b"\x02"
    assert result.message == auth_data + hashlib.sha256(client_data).digest()
    assert result.prefix is not None
    assert result.prefix.endswith(client_data)


def test_one_business_grant_url_and_callback() -> None:
    url = build_one_business_grant_access_url(
        swig_pubkey="swig",
        authority_public_key="authority",
        app_name="Trader",
        redirect_uri="http://localhost/callback",
        state="nonce",
        actions=[{"type": "transferSol", "amount": 10}],
    )
    assert "swig_pubkey=swig" in url
    assert "authority_public_key=authority" in url
    result = complete_one_business_grant_access(
        "http://localhost/callback?status=granted&swig_pubkey=swig"
        "&wallet_address=wallet&role_id=2&authority_public_key=authority"
        "&state=nonce"
    )
    assert result.wallet_address == "wallet"
    assert result.role_id == 2
    assert result.state == "nonce"


def test_one_business_redirect_supports_assign_and_replace() -> None:
    class Location:
        def __init__(self) -> None:
            self.assigned: str | None = None
            self.replaced: str | None = None

        def assign(self, url: str) -> None:
            self.assigned = url

        def replace(self, url: str) -> None:
            self.replaced = url

    location = Location()
    redirect_to_one_business_grant_access(
        location=location,
        swig_pubkey="swig",
        authority_public_key="authority",
    )
    assert location.assigned is not None

    redirect_to_one_business_grant_access(
        location=location,
        swig_pubkey="swig",
        authority_public_key="authority",
        mode="replace",
    )
    assert location.replaced == location.assigned


def test_one_business_callback_surfaces_errors() -> None:
    with pytest.raises(OneBusinessGrantAccessCallbackError) as raised:
        complete_one_business_grant_access(
            "http://localhost/callback?error=denied&error_description=nope"
        )
    assert raised.value.code == "denied"
