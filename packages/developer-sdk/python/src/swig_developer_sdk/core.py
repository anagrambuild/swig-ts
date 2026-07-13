from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import TypeVar, cast

import httpx

from .common import JsonValue, RetryOptions

T = TypeVar("T")


class SwigDeveloperSdkError(Exception):
    def __init__(
        self,
        message: str,
        code: str,
        status_code: int,
        details: object | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details

    @classmethod
    def from_response(
        cls,
        response: httpx.Response,
        body: object | None,
    ) -> SwigDeveloperSdkError:
        if isinstance(body, Mapping):
            nested = body.get("error")
            if isinstance(nested, Mapping):
                details = nested.get("details")
                return cls(
                    _optional_string(nested.get("message"))
                    or f"Request failed with status {response.status_code}",
                    _optional_string(nested.get("code"))
                    or f"HTTP_{response.status_code}",
                    response.status_code,
                    details if details is not None else body,
                )
            details = body.get("details")
            return cls(
                _optional_string(body.get("message"))
                or f"Request failed with status {response.status_code}",
                _optional_string(body.get("code")) or f"HTTP_{response.status_code}",
                response.status_code,
                details if details is not None else body,
            )
        return cls(
            f"Request failed with status {response.status_code}",
            f"HTTP_{response.status_code}",
            response.status_code,
            body,
        )


class HttpClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        retry: RetryOptions,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._retry = retry
        self._transport = transport

    async def get(self, path: str) -> object:
        return await self._request(path, method="GET")

    async def post(self, path: str, body: Mapping[str, object]) -> object:
        compacted = _compact(body)
        if not isinstance(compacted, Mapping):
            raise TypeError("Request body must be an object")
        return await self._request(path, method="POST", body=compacted)

    async def _request(
        self,
        path: str,
        *,
        method: str,
        body: Mapping[str, object] | None = None,
    ) -> object:
        last_error: SwigDeveloperSdkError | None = None
        for attempt in range(self._retry.max_retries + 1):
            try:
                async with httpx.AsyncClient(transport=self._transport) as client:
                    response = await client.request(
                        method,
                        f"{self._base_url}{path}",
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {self._api_key}",
                        },
                        json=body,
                    )
                response_body = _parse_response_body(response)
                if 200 <= response.status_code < 300:
                    return _unwrap_data(response_body)
                error = SwigDeveloperSdkError.from_response(response, response_body)
                if 400 <= response.status_code < 500:
                    raise error
                last_error = error
            except SwigDeveloperSdkError as error:
                if 400 <= error.status_code < 500:
                    raise
                last_error = error
            except httpx.HTTPError as error:
                last_error = SwigDeveloperSdkError(str(error), "NETWORK_ERROR", 0)
            except Exception as error:
                last_error = SwigDeveloperSdkError(str(error), "NETWORK_ERROR", 0)

            if attempt < self._retry.max_retries:
                await asyncio.sleep(
                    self._retry.retry_delay * self._retry.backoff_multiplier**attempt
                )

        if last_error is not None:
            raise last_error
        raise SwigDeveloperSdkError(
            f"Request failed after {self._retry.max_retries} retries",
            "RETRY_EXHAUSTED",
            0,
        )


def _parse_response_body(response: httpx.Response) -> object:
    if not response.content:
        return None
    try:
        return cast(JsonValue, response.json())
    except ValueError:
        return response.text


def _unwrap_data(body: object) -> object:
    if isinstance(body, Mapping) and "data" in body:
        return body["data"]
    return body


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _compact(value: object) -> object:
    if isinstance(value, Mapping):
        return {
            str(key): _compact(item) for key, item in value.items() if item is not None
        }
    if isinstance(value, list):
        return [_compact(item) for item in value]
    if isinstance(value, tuple):
        return [_compact(item) for item in value]
    return value
