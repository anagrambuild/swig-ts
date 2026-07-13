from __future__ import annotations

import httpx

from .common import DEFAULT_BACKEND_URL, Network, RetryOptions
from .core import HttpClient
from .paymaster import PaymasterClient
from .ramp import RampClient
from .transactions import TransactionsClient
from .wallets import WalletsClient


class SwigClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BACKEND_URL,
        network: Network | None = None,
        retry_options: RetryOptions | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.default_network = network
        http = HttpClient(
            api_key=api_key,
            base_url=base_url,
            retry=retry_options or RetryOptions(),
            transport=transport,
        )
        self.paymaster = PaymasterClient(http, network)
        self.ramp = RampClient(http, network)
        self.transactions = TransactionsClient(http, network)
        self.wallets = WalletsClient(http, network)


SwigServerClient = SwigClient
