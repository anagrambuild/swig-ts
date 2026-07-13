from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Literal, Protocol
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from .common import JsonObject

DEFAULT_ONE_BUSINESS_URL = "https://swig-one-business.vercel.app"


@dataclass(frozen=True, slots=True)
class OneBusinessGrantAccessResult:
    status: str
    swig_pubkey: str
    wallet_address: str
    role_id: int
    authority_public_key: str
    signature: str | None = None
    state: str | None = None


class OneBusinessGrantAccessCallbackError(Exception):
    def __init__(
        self,
        *,
        code: str,
        description: str | None = None,
        state: str | None = None,
    ) -> None:
        super().__init__(description or code)
        self.code = code
        self.description = description
        self.state = state


class OneBusinessLocation(Protocol):
    def assign(self, url: str) -> None: ...

    def replace(self, url: str) -> None: ...


def build_one_business_grant_access_url(
    *,
    swig_pubkey: str,
    authority_public_key: str,
    actions: list[JsonObject] | None = None,
    app_name: str | None = None,
    one_business_url: str = DEFAULT_ONE_BUSINESS_URL,
    redirect_uri: str | None = None,
    state: str | None = None,
) -> str:
    base_url = one_business_url.strip()
    if not base_url:
        raise ValueError("one_business_url is required")
    if not swig_pubkey.strip() or not authority_public_key.strip():
        raise ValueError("swig_pubkey and authority_public_key are required")
    query: dict[str, str] = {
        "swig_pubkey": swig_pubkey.strip(),
        "authority_public_key": authority_public_key.strip(),
    }
    if app_name is not None:
        query["app_name"] = app_name
    if redirect_uri is not None:
        query["redirect_uri"] = redirect_uri
    if state is not None:
        query["state"] = state
    if actions is not None:
        encoded = base64.urlsafe_b64encode(
            json.dumps(actions, separators=(",", ":")).encode("utf-8")
        ).decode("ascii")
        query["actions"] = encoded.rstrip("=")
    normalized_base = base_url if base_url.endswith("/") else f"{base_url}/"
    return f"{urljoin(normalized_base, 'authorize/grant-access')}?{urlencode(query)}"


def redirect_to_one_business_grant_access(
    *,
    location: OneBusinessLocation,
    swig_pubkey: str,
    authority_public_key: str,
    actions: list[JsonObject] | None = None,
    app_name: str | None = None,
    one_business_url: str = DEFAULT_ONE_BUSINESS_URL,
    redirect_uri: str | None = None,
    state: str | None = None,
    mode: Literal["assign", "replace"] = "assign",
) -> None:
    url = build_one_business_grant_access_url(
        swig_pubkey=swig_pubkey,
        authority_public_key=authority_public_key,
        actions=actions,
        app_name=app_name,
        one_business_url=one_business_url,
        redirect_uri=redirect_uri,
        state=state,
    )
    if mode == "replace":
        location.replace(url)
        return
    location.assign(url)


def complete_one_business_grant_access(
    callback_url: str,
) -> OneBusinessGrantAccessResult:
    params = parse_qs(urlparse(callback_url).query, keep_blank_values=True)
    error_code = _read_param(params, "error")
    state = _read_param(params, "state")
    if error_code:
        raise OneBusinessGrantAccessCallbackError(
            code=error_code,
            description=_read_param(params, "error_description"),
            state=state,
        )
    swig_pubkey = _required_param(params, "swig_pubkey")
    wallet_address = _required_param(params, "wallet_address")
    authority_public_key = _required_param(params, "authority_public_key")
    role_id_value = _required_param(params, "role_id")
    try:
        role_id = int(role_id_value)
    except ValueError as parse_error:
        raise ValueError(
            "Grant access callback has an invalid role_id"
        ) from parse_error
    if role_id < 0:
        raise ValueError("Grant access callback has an invalid role_id")
    return OneBusinessGrantAccessResult(
        status=(
            _read_param(params, "status")
            or _read_param(params, "grant_status")
            or "granted"
        ),
        swig_pubkey=swig_pubkey,
        wallet_address=wallet_address,
        role_id=role_id,
        authority_public_key=authority_public_key,
        signature=_read_param(params, "signature"),
        state=state,
    )


def _required_param(params: dict[str, list[str]], name: str) -> str:
    value = _read_param(params, name)
    if not value:
        raise ValueError(f"Grant access callback is missing {name}")
    return value


def _read_param(params: dict[str, list[str]], name: str) -> str | None:
    camel = _snake_to_camel(name)
    for key in (name, camel):
        values = params.get(key)
        if values and values[0].strip():
            return values[0].strip()
    return None


def _snake_to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)
