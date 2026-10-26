"""Authentification unique (SSO) par OpenID Connect : Microsoft Entra ID, Google, Keycloak,
Authentik, Okta…

Flux « authorization code » avec PKCE, l'API étant le client. Le jeton d'identité est reçu
directement du fournisseur, en HTTPS : sa signature n'a pas à être vérifiée (OpenID Connect
Core 1.0, § 3.1.3.7) ; son émetteur, son audience, son expiration et son nonce le sont.
"""

import base64
import hashlib
import json
import re
import secrets
import time
import unicodedata
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import quote, urlencode

from app import __version__
from app.models import SsoConfig

TIMEOUT_SECONDS = 10
CLOCK_SKEW_SECONDS = 60


class SsoError(Exception):
    """Échec de la connexion SSO, avec un message affichable."""


_discovery_cache: dict[str, dict[str, Any]] = {}


def _fetch_json(
    url: str, data: dict[str, str] | None = None, headers: dict[str, str] | None = None
) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=urlencode(data).encode() if data is not None else None,
        headers={"Accept": "application/json", "User-Agent": f"ElTicketo/{__version__}"}
        | (headers or {}),
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise SsoError(f"Le fournisseur d'identité a répondu HTTP {exc.code}.") from exc
    except (OSError, ValueError) as exc:
        raise SsoError("Fournisseur d'identité injoignable ou réponse illisible.") from exc


def discover(issuer: str, refresh: bool = False) -> dict[str, Any]:
    """Configuration publiée par le fournisseur, gardée en mémoire après le premier succès."""
    if refresh or issuer not in _discovery_cache:
        _discovery_cache[issuer] = _fetch_json(f"{issuer}/.well-known/openid-configuration")
    return _discovery_cache[issuer]


def new_challenge() -> dict[str, str]:
    """Valeurs à usage unique d'une tentative : `state`, `nonce` et vérificateur PKCE."""
    return {key: secrets.token_urlsafe(32) for key in ("state", "nonce", "verifier")}


def authorization_url(
    config: SsoConfig, redirect_uri: str, challenge: dict[str, str], refresh: bool = False
) -> str:
    digest = hashlib.sha256(challenge["verifier"].encode()).digest()
    params = {
        "response_type": "code",
        "client_id": config.client_id,
        "redirect_uri": redirect_uri,
        "scope": "openid profile email",
        "state": challenge["state"],
        "nonce": challenge["nonce"],
        "code_challenge": base64.urlsafe_b64encode(digest).rstrip(b"=").decode(),
        "code_challenge_method": "S256",
    }
    endpoint = discover(config.issuer, refresh)["authorization_endpoint"]
    return f"{endpoint}?{urlencode(params)}"


def fetch_claims(
    config: SsoConfig, redirect_uri: str, code: str, challenge: dict[str, str]
) -> dict[str, Any]:
    """Échange le code contre le jeton d'identité et renvoie ses informations, vérifiées."""
    provider = discover(config.issuer)
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": challenge["verifier"],
    }
    headers = {}
    methods = provider.get("token_endpoint_auth_methods_supported", ["client_secret_basic"])
    if not config.client_secret:
        data["client_id"] = config.client_id
    elif "client_secret_basic" in methods:
        client_id, secret = quote(config.client_id, safe=""), quote(config.client_secret, safe="")
        credentials = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
        headers["Authorization"] = f"Basic {credentials}"
    else:
        data |= {"client_id": config.client_id, "client_secret": config.client_secret}
    tokens = _fetch_json(provider["token_endpoint"], data, headers)

    try:
        payload = tokens["id_token"].split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (KeyError, IndexError, AttributeError, ValueError):
        raise SsoError("Réponse du fournisseur d'identité illisible.") from None

    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if (
        claims.get("iss") != provider["issuer"]
        or config.client_id not in audiences
        or claims.get("nonce") != challenge["nonce"]
        or not isinstance(claims.get("exp"), int | float)
        or claims["exp"] < time.time() - CLOCK_SKEW_SECONDS
        or not claims.get("sub")
    ):
        raise SsoError("Jeton d'identité refusé (émetteur, audience, expiration ou nonce).")
    return claims


def username_from_claims(claims: dict[str, Any]) -> str:
    """Identifiant El Ticketo tiré du profil : « Jean.Dupont@exemple.fr » → « jean.dupont »."""
    candidates = [claims.get("preferred_username")]
    if claims.get("email_verified") is not False:
        candidates.append(claims.get("email"))
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        local = candidate.split("@")[0].strip()
        ascii_only = unicodedata.normalize("NFKD", local).encode("ascii", "ignore").decode()
        username = re.sub(r"[^a-z0-9._-]", "", re.sub(r"\s+", ".", ascii_only.lower()))[:32]
        if len(username) >= 3:
            return username
    return "sso-" + hashlib.sha256(str(claims["sub"]).encode()).hexdigest()[:8]
