from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Literal, TypeAlias
from urllib.parse import quote, urlencode

from .common import (
    Amount,
    Network,
    WalletAddressInfo,
    WalletAuthority,
    normalize_amount,
    require_network,
    to_proto_network,
    wallet_address_info_from_wire,
    wallet_authority_to_wire,
)
from .core import HttpClient
from .transactions import (
    PreparedTransaction,
    PreparedTransactionsResult,
    normalize_prepared_transaction,
    normalize_prepared_transactions_result,
)


@dataclass(frozen=True, slots=True)
class WalletReference:
    swig_config_address: str
    wallet_address: str | None = None
    network: Network | None = None
    requester_authority: WalletAuthority | None = None


@dataclass(frozen=True, slots=True)
class IdpWalletSession:
    config_address: str
    wallet_address: str
    auth_flow: Literal["session", "role"] | None = None
    updated_at: int | None = None
    requester_authority: WalletAuthority | None = None
    authority_public_key: str | None = None
    role_id: int | None = None


@dataclass(frozen=True, slots=True)
class RecoveryOptions:
    guardian_pubkey: str | None = None
    delay_seconds: int | None = None
    target_role_id: int | None = None


@dataclass(frozen=True, slots=True)
class RecoverySetupPlan:
    requester_authority: WalletAuthority
    guardian_pubkey: str
    delay_seconds: int
    target_role_id: int | None = None


@dataclass(frozen=True, slots=True)
class CreateWalletResult:
    wallet: WalletAddressInfo
    transactions: tuple[PreparedTransaction, ...]
    client_authority_transactions: tuple[PreparedTransaction, ...]
    operator_signed_transactions: tuple[PreparedTransaction, ...]
    fee_payer_only_transactions: tuple[PreparedTransaction, ...]
    creation_transaction: PreparedTransaction | None = None
    add_authority_transaction: PreparedTransaction | None = None
    configure_recovery_transaction: PreparedTransaction | None = None
    recovery_setup: RecoverySetupPlan | None = None
    network: Network | None = None


@dataclass(frozen=True, slots=True)
class PreparedRecoverySetupResult:
    transactions: tuple[PreparedTransaction, ...]
    client_authority_transactions: tuple[PreparedTransaction, ...]
    operator_signed_transactions: tuple[PreparedTransaction, ...]
    fee_payer_only_transactions: tuple[PreparedTransaction, ...]
    wallet: WalletAddressInfo | None = None
    add_authority_transaction: PreparedTransaction | None = None
    configure_recovery_transaction: PreparedTransaction | None = None
    network: Network | None = None


@dataclass(frozen=True, slots=True)
class SolanaAccountMeta:
    pubkey: str
    is_signer: bool = False
    is_writable: bool = False


@dataclass(frozen=True, slots=True)
class SolanaInstructionInput:
    program_id: str
    accounts: tuple[SolanaAccountMeta, ...]
    data: str | bytes


@dataclass(frozen=True, slots=True)
class TransferSolOperation:
    destination: str
    amount: Amount
    type: Literal["transferSol"] = "transferSol"


@dataclass(frozen=True, slots=True)
class TransferTokenOperation:
    mint: str
    destination_owner: str
    amount: Amount
    type: Literal["transferToken"] = "transferToken"


PrepareOperation: TypeAlias = TransferSolOperation | TransferTokenOperation


@dataclass(frozen=True, slots=True)
class SwigUsdBalance:
    swig_config_address: str
    wallet_address: str
    usd_value: float


@dataclass(frozen=True, slots=True)
class SwigTokenBalance:
    mint_address: str
    token_program: int
    token_symbol: str
    token_name: str
    decimals: int
    amount_raw: str
    ui_amount: float
    usd_price: float
    usd_value: float


@dataclass(frozen=True, slots=True)
class ListSwigTokenBalancesResult:
    swig_config_address: str
    wallet_address: str
    balances: tuple[SwigTokenBalance, ...]
    total_usd_value: float


@dataclass(frozen=True, slots=True)
class SwigTokenTransaction:
    transaction_signature: str
    slot: int
    owner_address: str
    wallet_address: str
    is_subaccount: bool
    token_account_address: str
    mint_address: str
    token_program: int
    direction: Literal["inflow", "outflow"]
    amount_raw: str
    decimals: int
    ui_amount: float
    usd_price: float
    usd_value: float
    token_symbol: str
    token_name: str
    block_time: str | None = None


@dataclass(frozen=True, slots=True)
class ListSwigTokenTransactionsResult:
    swig_config_address: str
    wallet_address: str
    transactions: tuple[SwigTokenTransaction, ...]


@dataclass(frozen=True, slots=True)
class Policy:
    id: str
    name: str
    description: str | None
    authority: Mapping[str, object] | None = None
    actions: tuple[Mapping[str, object], ...] = ()
    guardian_enabled: bool = False
    initial_key_source: str | None = None
    guardian_authority: Mapping[str, object] | None = None
    guardian_key_source: str | None = None
    guardian_delay_seconds: int | str | None = None


class WalletsClient:
    def __init__(
        self,
        http: HttpClient,
        default_network: Network | None = None,
    ) -> None:
        self._http = http
        self._default_network = default_network

    async def create(
        self,
        *,
        fee_payer: str,
        policy_id: str | None = None,
        initial_user: WalletAuthority | None = None,
        recovery: RecoveryOptions | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> CreateWalletResult:
        policy = await self.get_policy(policy_id) if policy_id else None
        response = await self._http.post(
            "/transaction/wallet/create",
            {
                "network": to_proto_network(
                    require_network(network, self._default_network)
                ),
                "feePayer": fee_payer,
                "policyId": policy_id,
                "initialUser": (
                    wallet_authority_to_wire(initial_user)
                    if initial_user is not None
                    else None
                ),
            },
        )
        created = normalize_create_wallet_response(response)
        resolved_network = created.network or network or self._default_network
        recovery_setup = (
            _recovery_setup_plan(policy, initial_user, recovery)
            if policy is not None
            else None
        )
        return replace(
            created,
            wallet=replace(created.wallet, network=resolved_network),
            network=resolved_network,
            recovery_setup=recovery_setup,
        )

    async def get_policy(self, policy_id: str) -> Policy:
        return _normalize_policy(
            await self._http.get(f"/wallet/policies/{quote(policy_id, safe='')}")
        )

    def use(
        self,
        wallet: str | WalletReference,
        *,
        network: Network | None = None,
        requester_authority: WalletAuthority | None = None,
    ) -> WalletHandle:
        if isinstance(wallet, str):
            reference = WalletReference(
                swig_config_address=wallet,
                network=network or self._default_network,
                requester_authority=requester_authority,
            )
        else:
            reference = WalletReference(
                swig_config_address=wallet.swig_config_address,
                wallet_address=wallet.wallet_address,
                network=network or wallet.network or self._default_network,
                requester_authority=(requester_authority or wallet.requester_authority),
            )
        return WalletHandle(self, reference)

    def from_idp_session(
        self,
        session: IdpWalletSession,
        *,
        network: Network | None = None,
        requester_authority: WalletAuthority | None = None,
    ) -> WalletHandle:
        return WalletHandle(
            self,
            WalletReference(
                swig_config_address=session.config_address,
                wallet_address=session.wallet_address,
                network=network or self._default_network,
                requester_authority=(
                    requester_authority or session.requester_authority
                ),
            ),
        )

    async def prepare(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        operations: Sequence[PrepareOperation],
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransactionsResult:
        authority = _requester_authority(wallet, requester_authority)
        response = await self._http.post(
            "/transaction/prepare",
            {
                **_base_write_request(
                    wallet, fee_payer, network, self._default_network
                ),
                "requesterAuthority": wallet_authority_to_wire(authority),
                "operations": [_operation_to_wire(item) for item in operations],
            },
        )
        return normalize_prepared_transactions_result(response)

    async def transfer_sol(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        destination: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        authority = _requester_authority(wallet, requester_authority)
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/transfer/sol",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "requesterAuthority": wallet_authority_to_wire(authority),
                    "destination": destination,
                    "lamports": normalize_amount(amount),
                },
            )
        )

    async def transfer_token(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        mint: str,
        destination_owner: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        authority = _requester_authority(wallet, requester_authority)
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/transfer/spl-token",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "requesterAuthority": wallet_authority_to_wire(authority),
                    "mint": mint,
                    "destinationOwner": destination_owner,
                    "amount": normalize_amount(amount),
                },
            )
        )

    async def jupiter_swap(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        input_mint: str,
        output_mint: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        slippage_bps: int | None = None,
        destination_account: str | None = None,
        wrap_and_unwrap_sol: bool | None = None,
        tip_amount_lamports: Amount | None = None,
        compute_unit_price_percentile: str | None = None,
        max_accounts: int | None = None,
        mode: str | None = None,
        blockhash_slots_to_expiry: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        authority = _requester_authority(wallet, requester_authority)
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/swap/jupiter",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "requesterAuthority": wallet_authority_to_wire(authority),
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": normalize_amount(amount),
                    "slippageBps": slippage_bps,
                    "destinationAccount": destination_account,
                    "wrapAndUnwrapSol": wrap_and_unwrap_sol,
                    "tipAmountLamports": (
                        normalize_amount(tip_amount_lamports)
                        if tip_amount_lamports is not None
                        else None
                    ),
                    "computeUnitPricePercentile": compute_unit_price_percentile,
                    "maxAccounts": max_accounts,
                    "mode": mode,
                    "blockhashSlotsToExpiry": blockhash_slots_to_expiry,
                },
            )
        )

    async def add_recovery_authority(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        authority = _requester_authority(wallet, requester_authority)
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/wallet/recovery-authority/add",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "requesterAuthority": wallet_authority_to_wire(authority),
                },
            )
        )

    async def configure_recovery(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        guardian_pubkey: str,
        delay_seconds: int | None = None,
        target_role_id: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/recovery/configure",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "guardianPubkey": guardian_pubkey,
                    "delaySeconds": delay_seconds,
                    "targetRoleId": target_role_id,
                },
            )
        )

    async def prepare_recovery_setup(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        guardian_pubkey: str,
        requester_authority: WalletAuthority | None = None,
        delay_seconds: int | None = None,
        target_role_id: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedRecoverySetupResult:
        add_authority = await self.add_recovery_authority(
            wallet,
            fee_payer=fee_payer,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )
        configure = await self.configure_recovery(
            wallet,
            fee_payer=fee_payer,
            guardian_pubkey=guardian_pubkey,
            delay_seconds=delay_seconds,
            target_role_id=target_role_id,
            network=network,
            idempotency_key=idempotency_key,
        )
        transactions = (add_authority, configure)
        resolved_network = network or wallet.network or self._default_network
        wallet_info = add_authority.wallet or configure.wallet
        return PreparedRecoverySetupResult(
            wallet=(
                replace(wallet_info, network=resolved_network)
                if wallet_info is not None
                else None
            ),
            transactions=transactions,
            client_authority_transactions=tuple(
                item for item in transactions if item.signature_requests
            ),
            operator_signed_transactions=tuple(
                item for item in transactions if item.kind == "configure-recovery"
            ),
            fee_payer_only_transactions=tuple(
                item
                for item in transactions
                if not item.signature_requests and item.kind != "configure-recovery"
            ),
            add_authority_transaction=add_authority,
            configure_recovery_transaction=configure,
            network=resolved_network,
        )

    async def start_recovery(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        guardian_pubkey: str,
        new_authority: str,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/recovery/start",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "guardianPubkey": guardian_pubkey,
                    "newAuthority": new_authority,
                },
            )
        )

    async def cancel_recovery(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        authority = _requester_authority(wallet, requester_authority)
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/recovery/cancel",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "requesterAuthority": wallet_authority_to_wire(authority),
                },
            )
        )

    async def execute_recovery(
        self,
        wallet: WalletHandle,
        *,
        fee_payer: str,
        new_authority: str,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return normalize_prepared_transaction(
            await self._http.post(
                "/transaction/recovery/execute",
                {
                    **_base_write_request(
                        wallet, fee_payer, network, self._default_network
                    ),
                    "newAuthority": new_authority,
                },
            )
        )

    async def execute(
        self,
        wallet: WalletHandle,
        *,
        instructions: Sequence[SolanaInstructionInput],
        address_lookup_table_accounts: Sequence[str] | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return normalize_prepared_transaction(
            await self._http.post(
                f"/v1/wallets/{quote(wallet.swig_config_address, safe='')}/execute",
                {
                    "wallet": wallet.swig_config_address,
                    "network": network or wallet.network or self._default_network,
                    "instructions": [
                        _instruction_to_wire(item) for item in instructions
                    ],
                    "addressLookupTableAccounts": address_lookup_table_accounts,
                    "idempotencyKey": idempotency_key,
                },
            )
        )

    async def get_usd_balance(
        self,
        wallet: WalletHandle,
        *,
        network: Network | None = None,
    ) -> SwigUsdBalance:
        return _normalize_usd_balance(
            await self._http.get(
                _wallet_read_path(
                    wallet,
                    "balance/usd",
                    network or wallet.network or self._default_network,
                )
            )
        )

    async def list_token_balances(
        self,
        wallet: WalletHandle,
        *,
        network: Network | None = None,
    ) -> ListSwigTokenBalancesResult:
        return _normalize_token_balances(
            await self._http.get(
                _wallet_read_path(
                    wallet,
                    "token-balances",
                    network or wallet.network or self._default_network,
                )
            )
        )

    async def list_token_transactions(
        self,
        wallet: WalletHandle,
        *,
        network: Network | None = None,
        limit: int | None = None,
    ) -> ListSwigTokenTransactionsResult:
        return _normalize_token_transactions(
            await self._http.get(
                _wallet_read_path(
                    wallet,
                    "token-transactions",
                    network or wallet.network or self._default_network,
                    limit,
                )
            )
        )


class WalletHandle:
    def __init__(self, wallets: WalletsClient, reference: WalletReference) -> None:
        self._wallets = wallets
        self.swig_config_address = reference.swig_config_address
        self.wallet_address = reference.wallet_address
        self.network = reference.network
        self.requester_authority = reference.requester_authority
        self.transfer = WalletTransferClient(wallets, self)
        self.swap = WalletSwapClient(wallets, self)
        self.recovery = WalletRecoveryClient(wallets, self)

    async def prepare(
        self,
        *,
        fee_payer: str,
        operations: Sequence[PrepareOperation],
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransactionsResult:
        return await self._wallets.prepare(
            self,
            fee_payer=fee_payer,
            operations=operations,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def execute(
        self,
        *,
        instructions: Sequence[SolanaInstructionInput],
        address_lookup_table_accounts: Sequence[str] | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.execute(
            self,
            instructions=instructions,
            address_lookup_table_accounts=address_lookup_table_accounts,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def get_usd_balance(
        self, *, network: Network | None = None
    ) -> SwigUsdBalance:
        return await self._wallets.get_usd_balance(self, network=network)

    async def list_token_balances(
        self, *, network: Network | None = None
    ) -> ListSwigTokenBalancesResult:
        return await self._wallets.list_token_balances(self, network=network)

    async def list_token_transactions(
        self,
        *,
        network: Network | None = None,
        limit: int | None = None,
    ) -> ListSwigTokenTransactionsResult:
        return await self._wallets.list_token_transactions(
            self, network=network, limit=limit
        )


class WalletTransferClient:
    def __init__(self, wallets: WalletsClient, wallet: WalletHandle) -> None:
        self._wallets = wallets
        self._wallet = wallet

    async def __call__(
        self,
        *,
        fee_payer: str,
        amount: Amount,
        destination: str | None = None,
        mint: str | None = None,
        destination_owner: str | None = None,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        if mint:
            if destination_owner is None:
                raise ValueError("destination_owner is required for a token transfer")
            return await self.token(
                fee_payer=fee_payer,
                mint=mint,
                destination_owner=destination_owner,
                amount=amount,
                requester_authority=requester_authority,
                network=network,
                idempotency_key=idempotency_key,
            )
        if destination is None:
            raise ValueError("destination is required for a SOL transfer")
        return await self.sol(
            fee_payer=fee_payer,
            destination=destination,
            amount=amount,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def sol(
        self,
        *,
        fee_payer: str,
        destination: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.transfer_sol(
            self._wallet,
            fee_payer=fee_payer,
            destination=destination,
            amount=amount,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def token(
        self,
        *,
        fee_payer: str,
        mint: str,
        destination_owner: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.transfer_token(
            self._wallet,
            fee_payer=fee_payer,
            mint=mint,
            destination_owner=destination_owner,
            amount=amount,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def spl_token(
        self,
        *,
        fee_payer: str,
        mint: str,
        destination_owner: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self.token(
            fee_payer=fee_payer,
            mint=mint,
            destination_owner=destination_owner,
            amount=amount,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )


class WalletSwapClient:
    def __init__(self, wallets: WalletsClient, wallet: WalletHandle) -> None:
        self._wallets = wallets
        self._wallet = wallet

    async def __call__(
        self,
        *,
        fee_payer: str,
        input_mint: str,
        output_mint: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        slippage_bps: int | None = None,
        destination_account: str | None = None,
        wrap_and_unwrap_sol: bool | None = None,
        tip_amount_lamports: Amount | None = None,
        compute_unit_price_percentile: str | None = None,
        max_accounts: int | None = None,
        mode: str | None = None,
        blockhash_slots_to_expiry: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self.jupiter(
            fee_payer=fee_payer,
            input_mint=input_mint,
            output_mint=output_mint,
            amount=amount,
            requester_authority=requester_authority,
            slippage_bps=slippage_bps,
            destination_account=destination_account,
            wrap_and_unwrap_sol=wrap_and_unwrap_sol,
            tip_amount_lamports=tip_amount_lamports,
            compute_unit_price_percentile=compute_unit_price_percentile,
            max_accounts=max_accounts,
            mode=mode,
            blockhash_slots_to_expiry=blockhash_slots_to_expiry,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def jupiter(
        self,
        *,
        fee_payer: str,
        input_mint: str,
        output_mint: str,
        amount: Amount,
        requester_authority: WalletAuthority | None = None,
        slippage_bps: int | None = None,
        destination_account: str | None = None,
        wrap_and_unwrap_sol: bool | None = None,
        tip_amount_lamports: Amount | None = None,
        compute_unit_price_percentile: str | None = None,
        max_accounts: int | None = None,
        mode: str | None = None,
        blockhash_slots_to_expiry: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.jupiter_swap(
            self._wallet,
            fee_payer=fee_payer,
            input_mint=input_mint,
            output_mint=output_mint,
            amount=amount,
            requester_authority=requester_authority,
            slippage_bps=slippage_bps,
            destination_account=destination_account,
            wrap_and_unwrap_sol=wrap_and_unwrap_sol,
            tip_amount_lamports=tip_amount_lamports,
            compute_unit_price_percentile=compute_unit_price_percentile,
            max_accounts=max_accounts,
            mode=mode,
            blockhash_slots_to_expiry=blockhash_slots_to_expiry,
            network=network,
            idempotency_key=idempotency_key,
        )


class WalletRecoveryClient:
    def __init__(self, wallets: WalletsClient, wallet: WalletHandle) -> None:
        self._wallets = wallets
        self._wallet = wallet

    async def prepare_setup(
        self,
        *,
        fee_payer: str,
        guardian_pubkey: str,
        requester_authority: WalletAuthority | None = None,
        delay_seconds: int | None = None,
        target_role_id: int | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedRecoverySetupResult:
        return await self._wallets.prepare_recovery_setup(
            self._wallet,
            fee_payer=fee_payer,
            guardian_pubkey=guardian_pubkey,
            requester_authority=requester_authority,
            delay_seconds=delay_seconds,
            target_role_id=target_role_id,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def start(
        self,
        *,
        fee_payer: str,
        guardian_pubkey: str,
        new_authority: str,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.start_recovery(
            self._wallet,
            fee_payer=fee_payer,
            guardian_pubkey=guardian_pubkey,
            new_authority=new_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def cancel(
        self,
        *,
        fee_payer: str,
        requester_authority: WalletAuthority | None = None,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.cancel_recovery(
            self._wallet,
            fee_payer=fee_payer,
            requester_authority=requester_authority,
            network=network,
            idempotency_key=idempotency_key,
        )

    async def execute(
        self,
        *,
        fee_payer: str,
        new_authority: str,
        network: Network | None = None,
        idempotency_key: str | None = None,
    ) -> PreparedTransaction:
        return await self._wallets.execute_recovery(
            self._wallet,
            fee_payer=fee_payer,
            new_authority=new_authority,
            network=network,
            idempotency_key=idempotency_key,
        )


def normalize_create_wallet_response(response: object) -> CreateWalletResult:
    body = _mapping(response, "Create wallet response")
    raw_transactions = body.get("transactions")
    if isinstance(raw_transactions, Sequence) and not isinstance(
        raw_transactions, (str, bytes)
    ):
        transactions = tuple(
            normalize_prepared_transaction(item) for item in raw_transactions
        )
    else:
        transactions = (normalize_prepared_transaction(body),)
    creation = next(
        (item for item in transactions if item.kind == "create-swig-wallet"),
        transactions[0] if transactions else None,
    )
    add_authority = next(
        (item for item in transactions if item.kind == "add-authority"), None
    )
    configure = next(
        (item for item in transactions if item.kind == "configure-recovery"), None
    )
    wallet_value = body.get("wallet")
    wallet = (
        wallet_address_info_from_wire(wallet_value)
        if wallet_value is not None
        else creation.wallet
        if creation is not None
        else None
    )
    if wallet is None:
        raise ValueError("Create wallet response is missing wallet")
    return CreateWalletResult(
        wallet=wallet,
        transactions=transactions,
        client_authority_transactions=tuple(
            item for item in transactions if item.signature_requests
        ),
        operator_signed_transactions=tuple(
            item for item in transactions if item.kind == "configure-recovery"
        ),
        fee_payer_only_transactions=tuple(
            item
            for item in transactions
            if item.kind not in ("add-authority", "configure-recovery")
        ),
        creation_transaction=creation,
        add_authority_transaction=add_authority,
        configure_recovery_transaction=configure,
        network=creation.network if creation else None,
    )


def _base_write_request(
    wallet: WalletHandle,
    fee_payer: str,
    network: Network | None,
    default_network: Network | None,
) -> dict[str, object]:
    return {
        "network": to_proto_network(
            require_network(network, wallet.network, default_network)
        ),
        "feePayer": fee_payer,
        "swigAddress": wallet.swig_config_address,
    }


def _requester_authority(
    wallet: WalletHandle,
    authority: WalletAuthority | None,
) -> WalletAuthority:
    resolved = authority or wallet.requester_authority
    if resolved is None:
        raise ValueError("requester_authority is required")
    return resolved


def _operation_to_wire(operation: PrepareOperation) -> dict[str, object]:
    if isinstance(operation, TransferSolOperation):
        return {
            "transferSol": {
                "destination": operation.destination,
                "lamports": normalize_amount(operation.amount),
            }
        }
    return {
        "transferToken": {
            "mint": operation.mint,
            "destinationOwner": operation.destination_owner,
            "amount": normalize_amount(operation.amount),
        }
    }


def _instruction_to_wire(value: SolanaInstructionInput) -> dict[str, object]:
    data = (
        value.data
        if isinstance(value.data, str)
        else base64.b64encode(value.data).decode("ascii")
    )
    return {
        "programId": value.program_id,
        "accounts": [
            {
                "pubkey": account.pubkey,
                "isSigner": account.is_signer,
                "isWritable": account.is_writable,
            }
            for account in value.accounts
        ],
        "data": data,
    }


def _wallet_read_path(
    wallet: WalletHandle,
    route: str,
    network: Network | None,
    limit: int | None = None,
) -> str:
    query: dict[str, str] = {}
    if network is not None:
        query["network"] = to_proto_network(network)
    if limit is not None:
        query["limit"] = str(limit)
    suffix = f"?{urlencode(query)}" if query else ""
    return f"/wallet/swig/{quote(wallet.swig_config_address, safe='')}/{route}{suffix}"


def _normalize_usd_balance(value: object) -> SwigUsdBalance:
    body = _mapping(value, "USD balance response")
    return SwigUsdBalance(
        swig_config_address=_required_string(
            _pick(body, "swigConfigAddress", "swig_config_address"),
            "swigConfigAddress",
        ),
        wallet_address=_required_string(
            _pick(body, "walletAddress", "wallet_address"), "walletAddress"
        ),
        usd_value=_required_number(_pick(body, "usdValue", "usd_value"), "usdValue"),
    )


def _normalize_token_balances(value: object) -> ListSwigTokenBalancesResult:
    body = _mapping(value, "Token balances response")
    balances = body.get("balances", [])
    if not isinstance(balances, Sequence) or isinstance(balances, (str, bytes)):
        raise ValueError("Token balances response has invalid balances")
    return ListSwigTokenBalancesResult(
        swig_config_address=_required_string(
            _pick(body, "swigConfigAddress", "swig_config_address"),
            "swigConfigAddress",
        ),
        wallet_address=_required_string(
            _pick(body, "walletAddress", "wallet_address"), "walletAddress"
        ),
        balances=tuple(_normalize_token_balance(item) for item in balances),
        total_usd_value=_required_number(
            _pick(body, "totalUsdValue", "total_usd_value"), "totalUsdValue"
        ),
    )


def _normalize_token_balance(value: object) -> SwigTokenBalance:
    body = _mapping(value, "Token balance")
    return SwigTokenBalance(
        mint_address=_required_string(
            _pick(body, "mintAddress", "mint_address"), "mintAddress"
        ),
        token_program=_required_int(
            _pick(body, "tokenProgram", "token_program"), "tokenProgram"
        ),
        token_symbol=_required_string(
            _pick(body, "tokenSymbol", "token_symbol") or "", "tokenSymbol"
        ),
        token_name=_required_string(
            _pick(body, "tokenName", "token_name") or "", "tokenName"
        ),
        decimals=_required_int(body.get("decimals"), "decimals"),
        amount_raw=_required_string(
            _pick(body, "amountRaw", "amount_raw"), "amountRaw"
        ),
        ui_amount=_required_number(_pick(body, "uiAmount", "ui_amount"), "uiAmount"),
        usd_price=_required_number(_pick(body, "usdPrice", "usd_price"), "usdPrice"),
        usd_value=_required_number(_pick(body, "usdValue", "usd_value"), "usdValue"),
    )


def _normalize_token_transactions(
    value: object,
) -> ListSwigTokenTransactionsResult:
    body = _mapping(value, "Token transactions response")
    transactions = body.get("transactions", [])
    if not isinstance(transactions, Sequence) or isinstance(transactions, (str, bytes)):
        raise ValueError("Token transactions response has invalid transactions")
    return ListSwigTokenTransactionsResult(
        swig_config_address=_required_string(
            _pick(body, "swigConfigAddress", "swig_config_address"),
            "swigConfigAddress",
        ),
        wallet_address=_required_string(
            _pick(body, "walletAddress", "wallet_address"), "walletAddress"
        ),
        transactions=tuple(_normalize_token_transaction(item) for item in transactions),
    )


def _normalize_token_transaction(value: object) -> SwigTokenTransaction:
    body = _mapping(value, "Token transaction")
    direction = body.get("direction")
    if direction in ("inflow", "SWIG_TOKEN_TRANSACTION_DIRECTION_INFLOW", 1):
        normalized_direction: Literal["inflow", "outflow"] = "inflow"
    elif direction in (
        "outflow",
        "SWIG_TOKEN_TRANSACTION_DIRECTION_OUTFLOW",
        2,
    ):
        normalized_direction = "outflow"
    else:
        raise ValueError("Token transaction response has invalid direction")
    is_subaccount = _pick(body, "isSubaccount", "is_subaccount")
    if not isinstance(is_subaccount, bool):
        raise ValueError("Response is missing isSubaccount")
    return SwigTokenTransaction(
        transaction_signature=_required_string(
            _pick(body, "transactionSignature", "transaction_signature"),
            "transactionSignature",
        ),
        slot=_required_int(body.get("slot"), "slot"),
        block_time=_optional_string(_pick(body, "blockTime", "block_time")),
        owner_address=_required_string(
            _pick(body, "ownerAddress", "owner_address"), "ownerAddress"
        ),
        wallet_address=_required_string(
            _pick(body, "walletAddress", "wallet_address"), "walletAddress"
        ),
        is_subaccount=is_subaccount,
        token_account_address=_required_string(
            _pick(body, "tokenAccountAddress", "token_account_address"),
            "tokenAccountAddress",
        ),
        mint_address=_required_string(
            _pick(body, "mintAddress", "mint_address"), "mintAddress"
        ),
        token_program=_required_int(
            _pick(body, "tokenProgram", "token_program"), "tokenProgram"
        ),
        direction=normalized_direction,
        amount_raw=_required_string(
            _pick(body, "amountRaw", "amount_raw"), "amountRaw"
        ),
        decimals=_required_int(body.get("decimals"), "decimals"),
        ui_amount=_required_number(_pick(body, "uiAmount", "ui_amount"), "uiAmount"),
        usd_price=_required_number(_pick(body, "usdPrice", "usd_price"), "usdPrice"),
        usd_value=_required_number(_pick(body, "usdValue", "usd_value"), "usdValue"),
        token_symbol=_required_string(
            _pick(body, "tokenSymbol", "token_symbol") or "", "tokenSymbol"
        ),
        token_name=_required_string(
            _pick(body, "tokenName", "token_name") or "", "tokenName"
        ),
    )


def _normalize_policy(value: object) -> Policy:
    body = _mapping(value, "Policy response")
    description = body.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError("Policy response has invalid description")
    actions_value = body.get("actions", [])
    if not isinstance(actions_value, Sequence) or isinstance(
        actions_value, (str, bytes)
    ):
        raise ValueError("Policy response has invalid actions")
    actions = tuple(_mapping(item, "Policy action") for item in actions_value)
    authority = body.get("authority")
    guardian_authority = body.get("guardianAuthority")
    guardian_delay_value = body.get("guardianDelaySeconds")
    guardian_delay = (
        guardian_delay_value if isinstance(guardian_delay_value, (int, str)) else None
    )
    return Policy(
        id=_required_string(body.get("id"), "id"),
        name=_required_string(body.get("name"), "name"),
        description=description,
        authority=(
            _mapping(authority, "Policy authority") if authority is not None else None
        ),
        actions=actions,
        guardian_enabled=body.get("guardianEnabled") is True,
        initial_key_source=_optional_string(body.get("initialKeySource")),
        guardian_authority=(
            _mapping(guardian_authority, "Policy guardian authority")
            if guardian_authority is not None
            else None
        ),
        guardian_key_source=_optional_string(body.get("guardianKeySource")),
        guardian_delay_seconds=guardian_delay,
    )


def _recovery_setup_plan(
    policy: Policy,
    initial_user: WalletAuthority | None,
    recovery: RecoveryOptions | None,
) -> RecoverySetupPlan | None:
    authority = initial_user or _authority_from_policy(policy.authority)
    guardian = (
        recovery.guardian_pubkey if recovery else None
    ) or _public_key_from_policy(policy.guardian_authority)
    if not policy.guardian_enabled or authority is None or guardian is None:
        return None
    return RecoverySetupPlan(
        requester_authority=authority,
        guardian_pubkey=guardian,
        delay_seconds=(
            recovery.delay_seconds
            if recovery and recovery.delay_seconds is not None
            else _policy_delay(policy.guardian_delay_seconds)
        ),
        target_role_id=(recovery.target_role_id if recovery else None),
    )


def _authority_from_policy(
    value: Mapping[str, object] | None,
) -> WalletAuthority | None:
    if value is None:
        return None
    for scheme in ("ed25519", "secp256k1", "secp256r1"):
        nested = value.get(scheme)
        if isinstance(nested, Mapping):
            public_key = nested.get("publicKey")
            if isinstance(public_key, str):
                return {scheme: {"publicKey": public_key}}
    authority_type = value.get("type")
    public_key = value.get("publicKey")
    if not isinstance(public_key, str):
        return None
    schemes = {
        "Ed25519": "ed25519",
        "Secp256k1": "secp256k1",
        "Secp256r1": "secp256r1",
    }
    policy_scheme = (
        schemes.get(authority_type) if isinstance(authority_type, str) else None
    )
    return {policy_scheme: {"publicKey": public_key}} if policy_scheme else None


def _public_key_from_policy(value: Mapping[str, object] | None) -> str | None:
    if value is None:
        return None
    direct = value.get("publicKey")
    if isinstance(direct, str):
        return direct
    for scheme in ("ed25519", "secp256k1", "secp256r1"):
        nested = value.get(scheme)
        if isinstance(nested, Mapping):
            public_key = nested.get("publicKey")
            if isinstance(public_key, str):
                return public_key
    return None


def _policy_delay(value: int | str | None) -> int:
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return 86_400


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"{label} must be an object")


def _pick(value: Mapping[str, object], *keys: str) -> object:
    for key in keys:
        if key in value:
            return value[key]
    return None


def _required_string(value: object, field: str) -> str:
    if isinstance(value, str):
        return value
    raise ValueError(f"Response is missing {field}")


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _required_number(value: object, field: str) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            pass
    raise ValueError(f"Response is missing {field}")


def _required_int(value: object, field: str) -> int:
    number = _required_number(value, field)
    if not number.is_integer():
        raise ValueError(f"Response is missing {field}")
    return int(number)
