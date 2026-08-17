from __future__ import annotations

import base64
from collections.abc import Mapping
from dataclasses import dataclass

import httpx
from x402.http import (
    PAYMENT_REQUIRED_HEADER,
    PAYMENT_SIGNATURE_HEADER,
    decode_payment_required_header,
    encode_payment_signature_header,
)
from x402.schemas import PaymentPayload, PaymentRequired

from .common import (
    Network,
    WalletAuthority,
    require_network,
    to_proto_network,
    wallet_authority_to_wire,
)
from .core import HttpClient
from .transactions import (
    PreparedTransaction,
    SignedPreparedTransaction,
    normalize_prepared_transaction,
)

MAX_SOLANA_TRANSACTION_BYTES = 1_232
MAX_PAYMENT_SIGNATURE_HEADER_BYTES = 8_000
UINT32_MAX = 0xFFFF_FFFF

X402_SOLANA_NETWORKS: Mapping[Network, str] = {
    "devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
}


@dataclass(frozen=True, slots=True)
class X402PreparationResult:
    prepared_transaction: PreparedTransaction
    payment_required: PaymentRequired
    accepted_index: int


@dataclass(frozen=True, slots=True)
class X402PaymentSubmission:
    payment_payload: PaymentPayload
    payment_signature_headers: Mapping[str, str]


class WalletX402Client:
    def __init__(
        self,
        http: HttpClient,
        *,
        swig_config_address: str,
        wallet_network: Network | None,
        default_network: Network | None,
        requester_authority: WalletAuthority | None,
    ) -> None:
        self._http = http
        self._swig_config_address = swig_config_address
        self._wallet_network = wallet_network
        self._default_network = default_network
        self._requester_authority = requester_authority

    async def prepare_from_response(
        self,
        response: httpx.Response,
        *,
        accepted_index: int | None = None,
    ) -> X402PreparationResult:
        payment_required = parse_payment_required_response(response)
        return await self._prepare_payment_required(
            payment_required,
            accepted_index=accepted_index,
        )

    async def _prepare_payment_required(
        self,
        payment_required: PaymentRequired,
        *,
        accepted_index: int | None = None,
    ) -> X402PreparationResult:
        payment_required = validate_payment_required(payment_required)
        network = require_network(self._wallet_network, self._default_network)
        if self._requester_authority is None:
            raise ValueError("requester_authority is required")

        accepted_index = validate_accepted_index(accepted_index, payment_required)
        response = await self._http.post(
            "/transaction/payment/x402/prepare",
            {
                "paymentRequired": payment_required.model_dump(
                    by_alias=True,
                    exclude_unset=True,
                ),
                "acceptedIndex": accepted_index,
                "network": to_proto_network(network),
                "swigAddress": self._swig_config_address,
                "requesterAuthority": wallet_authority_to_wire(
                    self._requester_authority
                ),
            },
        )
        return normalize_x402_preparation_response(
            response,
            payment_required=payment_required,
            requested_accepted_index=accepted_index,
            network=network,
            swig_config_address=self._swig_config_address,
        )


def parse_payment_required_response(response: httpx.Response) -> PaymentRequired:
    if response.status_code != 402:
        raise ValueError("x402 response must have status 402")
    header = response.headers.get(PAYMENT_REQUIRED_HEADER)
    if not header:
        raise ValueError("x402 response is missing PAYMENT-REQUIRED")
    try:
        decoded = decode_payment_required_header(header)
    except Exception:
        raise ValueError("PAYMENT-REQUIRED is not valid x402 data") from None
    if not isinstance(decoded, PaymentRequired):
        raise ValueError("PAYMENT-REQUIRED must use x402 version 2")
    return validate_payment_required(decoded)


def validate_payment_required(value: object) -> PaymentRequired:
    try:
        payment_required = PaymentRequired.model_validate(value)
    except Exception:
        raise ValueError("PAYMENT-REQUIRED does not match x402 version 2") from None
    if payment_required.x402_version != 2:
        raise ValueError("PAYMENT-REQUIRED must use x402 version 2")
    if payment_required.resource is None:
        raise ValueError("PAYMENT-REQUIRED is missing resource")
    return payment_required


def validate_accepted_index(
    accepted_index: int | None,
    payment_required: PaymentRequired,
) -> int | None:
    if accepted_index is None:
        return None
    if (
        not isinstance(accepted_index, int)
        or isinstance(accepted_index, bool)
        or accepted_index < 0
        or accepted_index > UINT32_MAX
    ):
        raise ValueError("accepted_index must be a non-negative uint32")
    if accepted_index >= len(payment_required.accepts):
        raise ValueError("accepted_index is out of range")
    return accepted_index


def normalize_x402_preparation_response(
    response: object,
    *,
    payment_required: PaymentRequired,
    requested_accepted_index: int | None,
    network: Network,
    swig_config_address: str,
) -> X402PreparationResult:
    body = _mapping(response, "x402 preparation response")
    prepared_wire = _pick(body, "preparedTransaction", "prepared_transaction")
    if prepared_wire is None:
        raise ValueError("x402 preparation response is missing preparedTransaction")

    accepted_index = _response_accepted_index(
        _pick(body, "acceptedIndex", "accepted_index")
    )
    if accepted_index >= len(payment_required.accepts):
        raise ValueError("x402 preparation response acceptedIndex is out of range")
    if (
        requested_accepted_index is not None
        and accepted_index != requested_accepted_index
    ):
        raise ValueError("x402 preparation response selected a different requirement")

    accepted = payment_required.accepts[accepted_index]
    if accepted.scheme != "exact" or accepted.network != X402_SOLANA_NETWORKS[network]:
        raise ValueError(
            "x402 preparation response selected an unsupported requirement"
        )

    prepared = normalize_prepared_transaction(prepared_wire)
    if prepared.kind != "x402-payment":
        raise ValueError("x402 preparation response has an invalid transaction kind")
    if prepared.network != network:
        raise ValueError("x402 preparation response has a different network")
    if prepared.transaction_encoding != "base64":
        raise ValueError("x402 preparation response must use base64")
    if (
        prepared.wallet is None
        or prepared.wallet.swig_config_address != swig_config_address
    ):
        raise ValueError("x402 preparation response has a different Swig wallet")

    return X402PreparationResult(
        prepared_transaction=prepared,
        payment_required=payment_required,
        accepted_index=accepted_index,
    )


def create_x402_payment(
    prepared: X402PreparationResult,
    signed: SignedPreparedTransaction,
) -> X402PaymentSubmission:
    payment_required = validate_payment_required(prepared.payment_required)
    accepted_index = validate_accepted_index(
        prepared.accepted_index,
        payment_required,
    )
    if accepted_index is None:
        raise ValueError("accepted_index is required")

    transaction = prepared.prepared_transaction
    if transaction.kind != "x402-payment":
        raise ValueError("prepared transaction is not an x402 payment")
    network = transaction.network
    if network is None:
        raise ValueError("prepared x402 transaction is missing network")
    accepted = payment_required.accepts[accepted_index]
    if accepted.scheme != "exact" or accepted.network != X402_SOLANA_NETWORKS[network]:
        raise ValueError("prepared x402 requirement does not match its network")
    if signed.transaction_encoding != "base64":
        raise ValueError("signed x402 transaction must use base64")
    if signed.network is not None and signed.network != network:
        raise ValueError("signed x402 transaction has a different network")

    transaction_bytes = _decode_canonical_base64(signed.transaction)
    if len(transaction_bytes) > MAX_SOLANA_TRANSACTION_BYTES:
        raise ValueError("signed x402 transaction exceeds the Solana wire limit")

    payload: dict[str, object] = {
        "x402Version": payment_required.x402_version,
        "resource": payment_required.resource,
        "accepted": accepted,
        "payload": {"transaction": signed.transaction},
    }
    if "extensions" in payment_required.model_fields_set:
        payload["extensions"] = payment_required.extensions
    try:
        payment_payload = PaymentPayload.model_validate(payload)
    except Exception:
        raise ValueError("x402 payment payload is invalid") from None

    payment_signature = encode_payment_signature_header(payment_payload)
    if len(payment_signature.encode("utf-8")) > MAX_PAYMENT_SIGNATURE_HEADER_BYTES:
        raise ValueError("PAYMENT-SIGNATURE exceeds the supported header size")

    return X402PaymentSubmission(
        payment_payload=payment_payload,
        payment_signature_headers={PAYMENT_SIGNATURE_HEADER: payment_signature},
    )


def _response_accepted_index(value: object) -> int:
    if (
        not isinstance(value, int)
        or isinstance(value, bool)
        or value < 0
        or value > UINT32_MAX
    ):
        raise ValueError("x402 preparation response has an invalid acceptedIndex")
    return value


def _decode_canonical_base64(value: str) -> bytes:
    if not isinstance(value, str) or not value:
        raise ValueError("signed x402 transaction is not canonical base64")
    try:
        decoded = base64.b64decode(value, validate=True)
    except ValueError:
        raise ValueError("signed x402 transaction is not canonical base64") from None
    if base64.b64encode(decoded).decode("ascii") != value:
        raise ValueError("signed x402 transaction is not canonical base64")
    if not decoded:
        raise ValueError("signed x402 transaction is empty")
    return decoded


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"{label} must be an object")


def _pick(body: Mapping[str, object], *keys: str) -> object | None:
    for key in keys:
        if key in body:
            return body[key]
    return None
