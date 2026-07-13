from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

import base58

from .common import (
    JsonObject,
    Network,
    WalletAddressInfo,
    normalize_network,
    wallet_address_info_from_wire,
)
from .core import HttpClient

TransactionEncoding = Literal["base64"]
PreparedTransactionKind = Literal[
    "create-swig-wallet", "add-authority", "configure-recovery"
]
SignatureScheme = Literal["secp256r1", "secp256k1"]


@dataclass(frozen=True, slots=True)
class ClientSignatureRequest:
    scheme: SignatureScheme
    signer: str
    message_hash: str
    slot: int
    counter: int


@dataclass(frozen=True, slots=True)
class PreparedTransaction:
    transaction: str
    signature_requests: tuple[ClientSignatureRequest, ...]
    transaction_encoding: TransactionEncoding | None = None
    wallet: WalletAddressInfo | None = None
    expires_at: str | None = None
    network: Network | None = None
    recent_blockhash: str | None = None
    kind: PreparedTransactionKind | None = None


@dataclass(frozen=True, slots=True)
class SignedPreparedTransaction:
    transaction: str
    transaction_encoding: TransactionEncoding | None = None
    network: Network | None = None


@dataclass(frozen=True, slots=True)
class SubmittedTransaction:
    signature: str
    status: Literal["submitted", "confirmed"] | None = None


@dataclass(frozen=True, slots=True)
class SponsorSignedTransactionArgs:
    transaction: str
    transaction_encoding: TransactionEncoding | None = None
    network: Network | None = None
    metadata: JsonObject | None = None
    idempotency_key: str | None = None


@dataclass(frozen=True, slots=True)
class PreparedTransactionsResult:
    transactions: tuple[PreparedTransaction, ...]
    client_authority_transactions: tuple[PreparedTransaction, ...]
    fee_payer_only_transactions: tuple[PreparedTransaction, ...]
    wallet: WalletAddressInfo | None = None
    network: Network | None = None


class TransactionsClient:
    def __init__(
        self,
        http: HttpClient,
        default_network: Network | None = None,
    ) -> None:
        self._http = http
        self._default_network = default_network

    async def sponsor(
        self,
        args: SponsorSignedTransactionArgs,
    ) -> SubmittedTransaction:
        transaction_bytes = base64.b64decode(args.transaction)
        response = await self._http.post(
            "/paymaster/sponsor",
            {
                "base58_encoded_transaction": base58.b58encode(
                    transaction_bytes
                ).decode("ascii"),
                "network": args.network or self._default_network,
                "metadata": args.metadata,
                "idempotencyKey": args.idempotency_key,
            },
        )
        return normalize_submitted_transaction(response)


def normalize_prepared_transaction(response: object) -> PreparedTransaction:
    body = _mapping(response, "Prepared transaction response")
    transaction = _pick(
        body, "transaction", "unsignedTransaction", "unsigned_transaction"
    )
    if not isinstance(transaction, str) or not transaction:
        raise ValueError("Prepared transaction response is missing transaction")

    wallet_value = body.get("wallet")
    return PreparedTransaction(
        transaction=transaction,
        transaction_encoding=_normalize_transaction_encoding(
            _pick(body, "transactionEncoding", "transaction_encoding")
        ),
        wallet=(
            wallet_address_info_from_wire(wallet_value)
            if wallet_value is not None
            else None
        ),
        expires_at=_optional_string(_pick(body, "expiresAt", "expires_at")),
        network=normalize_network(body.get("network")),
        recent_blockhash=_optional_string(
            _pick(body, "recentBlockhash", "recent_blockhash")
        ),
        kind=_normalize_kind(body.get("kind")),
        signature_requests=_normalize_signature_requests(
            _pick(body, "signatureRequests", "signature_requests")
        ),
    )


def normalize_prepared_transactions_result(
    response: object,
) -> PreparedTransactionsResult:
    body = _mapping(response, "Prepare transactions response")
    network = normalize_network(body.get("network"))
    raw_transactions = body.get("transactions", [])
    if not isinstance(raw_transactions, Sequence) or isinstance(
        raw_transactions, (str, bytes)
    ):
        raise ValueError("Prepare transactions response has invalid transactions")
    transactions = tuple(
        normalize_prepared_transaction(
            {
                **_mapping(item, "Prepared transaction"),
                "network": _mapping(item, "Prepared transaction").get(
                    "network", body.get("network")
                ),
            }
        )
        for item in raw_transactions
    )
    wallet_value = body.get("wallet")
    wallet = (
        wallet_address_info_from_wire(wallet_value)
        if wallet_value is not None
        else None
    )
    if wallet is not None and wallet.network is None and network is not None:
        wallet = WalletAddressInfo(
            wallet.swig_config_address,
            wallet.wallet_address,
            network,
        )
    return PreparedTransactionsResult(
        wallet=wallet,
        transactions=transactions,
        client_authority_transactions=tuple(
            item for item in transactions if item.signature_requests
        ),
        fee_payer_only_transactions=tuple(
            item for item in transactions if not item.signature_requests
        ),
        network=network,
    )


def normalize_submitted_transaction(response: object) -> SubmittedTransaction:
    body = _mapping(response, "Sponsor response")
    signature = body.get("signature")
    if not isinstance(signature, str) or not signature:
        raise ValueError("Sponsor response is missing signature")
    status = body.get("status")
    if status not in (None, "submitted", "confirmed"):
        raise ValueError("Sponsor response has invalid status")
    return SubmittedTransaction(signature=signature, status=status)


def _normalize_signature_requests(value: object) -> tuple[ClientSignatureRequest, ...]:
    if value is None:
        return ()
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise ValueError("Prepared transaction has invalid signature request")
    requests: list[ClientSignatureRequest] = []
    for item in value:
        request = _mapping(item, "Prepared transaction signature request")
        scheme = _normalize_signature_scheme(request.get("scheme"))
        signer = request.get("signer")
        message_hash = _pick(request, "messageHash", "message_hash")
        slot = request.get("slot")
        counter = request.get("counter")
        if isinstance(slot, str):
            try:
                slot = int(slot, 10)
            except ValueError as error:
                raise ValueError(
                    "Prepared transaction has invalid signature request"
                ) from error
        if (
            scheme is None
            or not isinstance(signer, str)
            or not isinstance(message_hash, str)
            or not isinstance(slot, int)
            or not isinstance(counter, int)
        ):
            raise ValueError("Prepared transaction has invalid signature request")
        requests.append(
            ClientSignatureRequest(
                scheme=scheme,
                signer=signer,
                message_hash=message_hash,
                slot=slot,
                counter=counter,
            )
        )
    return tuple(requests)


def _normalize_signature_scheme(value: object) -> SignatureScheme | None:
    if value in ("secp256r1", "AUTHORITY_SIGNATURE_SCHEME_SECP256R1", 1):
        return "secp256r1"
    if value in ("secp256k1", "AUTHORITY_SIGNATURE_SCHEME_SECP256K1", 2):
        return "secp256k1"
    return None


def _normalize_transaction_encoding(value: object) -> TransactionEncoding | None:
    if value in ("base64", "TRANSACTION_ENCODING_BASE64", 1):
        return "base64"
    return None


def _normalize_kind(value: object) -> PreparedTransactionKind | None:
    if value in (
        "create-swig-wallet",
        "PREPARED_TRANSACTION_KIND_CREATE_SWIG_WALLET",
        1,
    ):
        return "create-swig-wallet"
    if value in ("add-authority", "PREPARED_TRANSACTION_KIND_ADD_AUTHORITY", 2):
        return "add-authority"
    if value in (
        "configure-recovery",
        "PREPARED_TRANSACTION_KIND_CONFIGURE_RECOVERY",
        3,
    ):
        return "configure-recovery"
    return None


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"{label} must be an object")


def _pick(value: Mapping[str, object], *keys: str) -> object:
    for key in keys:
        if key in value:
            return value[key]
    return None


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None
