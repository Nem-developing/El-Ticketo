import base64
import json
import time
from urllib.parse import parse_qs, urlsplit

import pytest

from app import sso
from tests.conftest import ADMIN_PASSWORD, MEMBER_PASSWORD

ISSUER = "https://idp.exemple.fr"
CONFIG = {"enabled": True, "issuer": ISSUER, "client_id": "elticketo", "client_secret": "s3"}


@pytest.fixture
def configured(client, admin):
    """SSO configuré depuis l'administration."""
    assert client.put("/api/sso", json=CONFIG, headers=admin).status_code == 200


@pytest.fixture
def idp(monkeypatch):
    """Faux fournisseur d'identité : `claims` règle le jeton d'identité qu'il délivre."""
    provider = {"claims": {}, "token_requests": []}

    def fetch_json(url, data=None, headers=None):
        if url == f"{ISSUER}/.well-known/openid-configuration":
            return {
                "issuer": ISSUER,
                "authorization_endpoint": f"{ISSUER}/authorize",
                "token_endpoint": f"{ISSUER}/token",
            }
        assert url == f"{ISSUER}/token"
        provider["token_requests"].append((data, headers))
        claims = {
            "iss": ISSUER,
            "aud": "elticketo",
            "exp": time.time() + 300,
            "nonce": provider["nonce"],
        } | provider["claims"]
        payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
        return {"id_token": f"e30.{payload}.signature", "access_token": "x"}

    monkeypatch.setattr(sso, "_fetch_json", fetch_json)
    monkeypatch.setattr(sso, "_discovery_cache", {})
    return provider


def come_back(client, idp, authorization_url, **claims) -> tuple[str, dict[str, str]]:
    """Retour du fournisseur : page atteinte et paramètres de son fragment."""
    idp["claims"] = claims
    authorize = parse_qs(urlsplit(authorization_url).query)
    idp["nonce"] = authorize["nonce"][0]
    back = client.get(
        "/api/auth/sso/callback",
        params={"code": "code-1", "state": authorize["state"][0]},
        follow_redirects=False,
    )
    location = urlsplit(back.headers["location"])
    return location.path, {key: values[0] for key, values in parse_qs(location.fragment).items()}


def sso_login(client, idp, next_page="/", **claims) -> dict[str, str]:
    """Parcours complet ; renvoie les paramètres du fragment de retour sur /login."""
    start = client.get("/api/auth/sso/login", params={"next": next_page}, follow_redirects=False)
    assert start.status_code == 302
    page, result = come_back(client, idp, start.headers["location"], **claims)
    assert page == "/login"
    return result


def me(client, token):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def test_sso_is_announced_when_configured(client, configured):
    assert client.get("/api/auth/sso").json() == {"enabled": True}


def test_first_login_creates_a_member(client, idp, configured, admin):
    result = sso_login(
        client, idp, "/tickets/1", sub="u-1", preferred_username="Jean.Dupont@corp.fr"
    )

    assert result["next"] == "/tickets/1"
    user = me(client, result["token"])
    assert (user["username"], user["is_admin"], user["sso"]) == ("jean.dupont", False, True)
    data, headers = idp["token_requests"][0]
    assert data["code"] == "code-1" and data["code_verifier"]
    assert data["redirect_uri"] == "http://testserver/api/auth/sso/callback"
    assert headers["Authorization"].startswith("Basic ")

    logs = [entry["message"] for entry in client.get("/api/logs", headers=admin).json()]
    assert logs[:2] == ["Connexion (SSO)", "Compte « jean.dupont » créé par le SSO"]

    # Connexions suivantes : même compte, retrouvé par son « sub ».
    again = sso_login(client, idp, sub="u-1", preferred_username="autre.nom")
    assert me(client, again["token"])["id"] == user["id"]


def test_existing_account_is_linked_and_loses_its_password(client, idp, configured, member):
    alice_id = me(client, member["Authorization"].split()[1])["id"]
    result = sso_login(client, idp, sub="u-2", email="Alice@corp.fr")

    assert me(client, result["token"])["id"] == alice_id
    login = client.post("/api/auth/login", json={"username": "alice", "password": MEMBER_PASSWORD})
    assert login.status_code == 401


def test_initial_admin_is_never_linked(client, idp, configured):
    result = sso_login(client, idp, sub="u-3", preferred_username="admin")

    user = me(client, result["token"])
    assert (user["username"], user["is_admin"]) == ("admin-2", False)
    login = client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    assert login.status_code == 200


def test_invalid_tokens_are_refused(client, idp, configured, admin):
    for claims in ({"aud": "autre-client"}, {"iss": "https://pirate.fr"}, {"nonce": "rejoue"}):
        result = sso_login(client, idp, sub="u-4", preferred_username="eve", **claims)
        assert "token" not in result
        assert result["error"].startswith("Jeton d'identité refusé")

    entry = client.get("/api/logs", params={"limit": 1}, headers=admin).json()[0]
    assert entry["level"] == "warning"
    assert entry["message"].startswith("Échec de connexion SSO : Jeton d'identité refusé")


def test_deactivated_accounts_cannot_log_in(client, idp, configured, admin):
    first = sso_login(client, idp, sub="u-5", preferred_username="bob")
    bob_id = me(client, first["token"])["id"]
    client.patch(f"/api/users/{bob_id}", json={"is_active": False}, headers=admin)

    result = sso_login(client, idp, sub="u-5", preferred_username="bob")
    assert result == {"error": "Le compte « bob » est désactivé."}


def test_callback_requires_the_browser_that_started_the_login(client, idp, configured):
    response = client.get(
        "/api/auth/sso/callback", params={"code": "c", "state": "forge"}, follow_redirects=False
    )
    assert parse_qs(urlsplit(response.headers["location"]).fragment) == {
        "error": ["La connexion a expiré, recommencez."]
    }


@pytest.mark.parametrize("next_page", ["//pirate.fr", "https://pirate.fr", "/\\pirate.fr"])
def test_next_page_stays_on_the_application(client, idp, configured, next_page):
    assert sso_login(client, idp, next_page, sub="u-6", preferred_username="carol")["next"] == "/"


def test_username_from_claims():
    assert sso.username_from_claims({"sub": "1", "preferred_username": "Élodie Martin"}) == (
        "elodie.martin"
    )
    unverified = {"sub": "1", "email": "boss@corp.fr", "email_verified": False}
    assert sso.username_from_claims(unverified).startswith("sso-")


def test_configuration_never_returns_the_secret(client, configured, admin):
    config = client.get("/api/sso", headers=admin).json()
    assert config == {
        "enabled": True,
        "issuer": ISSUER,
        "client_id": "elticketo",
        "has_secret": True,
        "redirect_uri": "http://testserver/api/auth/sso/callback",
    }
    # Sans secret dans la requête, celui enregistré est gardé.
    changed = CONFIG | {"enabled": False, "client_secret": None}
    assert client.put("/api/sso", json=changed, headers=admin).json()["has_secret"] is True
    assert client.get("/api/auth/sso").json() == {"enabled": False}


def test_configuration_is_validated_and_reserved_to_admins(client, admin, member):
    assert client.get("/api/sso", headers=member).status_code == 403
    assert client.put("/api/sso", json=CONFIG, headers=member).status_code == 403
    incomplete = CONFIG | {"client_id": ""}
    assert client.put("/api/sso", json=incomplete, headers=admin).status_code == 400
    not_an_url = CONFIG | {"issuer": "idp.exemple.fr"}
    assert client.put("/api/sso", json=not_an_url, headers=admin).status_code == 422


def test_admin_tests_the_configuration_without_logging_in(client, idp, admin, member):
    # Le test fonctionne avant même d'activer le SSO pour tout le monde.
    client.put("/api/sso", json=CONFIG | {"enabled": False}, headers=admin)
    start = client.post("/api/sso/test", headers=admin)
    assert start.status_code == 200

    page, result = come_back(client, idp, start.json()["url"], sub="u-7", email="alice@corp.fr")

    assert page == "/admin/sso"
    assert result == {
        "test": "ok",
        "message": "« alice@corp.fr » authentifié ; le compte existant « alice » sera rattaché "
        "au SSO à la première connexion.",
    }
    alice = next(
        u for u in client.get("/api/users", headers=admin).json() if u["username"] == "alice"
    )
    assert alice["sso"] is False
    login = client.post("/api/auth/login", json={"username": "alice", "password": MEMBER_PASSWORD})
    assert login.status_code == 200
    assert client.post("/api/sso/test", headers=member).status_code == 403


def test_failed_test_is_reported(client, idp, configured, admin):
    start = client.post("/api/sso/test", headers=admin)
    page, result = come_back(client, idp, start.json()["url"], sub="u-8", aud="autre-client")

    assert page == "/admin/sso"
    assert result["test"] == "error"
    assert result["message"].startswith("Jeton d'identité refusé")
