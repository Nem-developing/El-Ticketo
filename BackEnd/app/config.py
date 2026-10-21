"""Configuration de l'API, lue depuis les variables d'environnement."""

import os
import re
from dataclasses import dataclass, field
from urllib.parse import quote_plus

USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]{3,32}$")


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        message = f"La variable {name} doit être un nombre entier (reçu : {raw!r})."
        raise ValueError(message) from None


def _database_url_from_env() -> str:
    """`DATABASE_URL` est prioritaire, sinon l'URL est construite depuis les variables `DB_*`."""
    if url := os.getenv("DATABASE_URL"):
        return url
    user = quote_plus(_env("DB_USER", "elticketo"))
    password = quote_plus(_env("DB_PASSWORD", ""))
    host = _env("DB_HOSTNAME", "localhost")
    port = _env("DB_PORT", "3306")
    name = _env("DB_NAME", "elticketo")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


def _csv_from_env(name: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, "").split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=_database_url_from_env)
    # Durée de validité d'une session (token renvoyé par /auth/login).
    token_ttl_hours: int = field(default_factory=lambda: _int_env("TOKEN_TTL_HOURS", 168))
    # Compte administrateur créé au tout premier démarrage (base vide).
    admin_username: str = field(default_factory=lambda: _env("ADMIN_USERNAME", "admin").lower())
    admin_password: str = field(default_factory=lambda: _env("ADMIN_PASSWORD", "admin"))
    # Au-delà de `login_max_attempts` échecs en `login_lockout_minutes`, la connexion est
    # bloquée temporairement pour ce couple adresse IP / identifiant.
    login_max_attempts: int = field(default_factory=lambda: _int_env("LOGIN_MAX_ATTEMPTS", 5))
    login_lockout_minutes: int = field(
        default_factory=lambda: _int_env("LOGIN_LOCKOUT_MINUTES", 15)
    )
    # Origines autorisées en CORS (inutile si le front et l'API partagent le même domaine).
    cors_origins: list[str] = field(default_factory=lambda: _csv_from_env("CORS_ORIGINS"))

    def __post_init__(self) -> None:
        # Une configuration invalide doit empêcher le démarrage, avec un message explicite.
        if self.token_ttl_hours < 1:
            raise ValueError("TOKEN_TTL_HOURS doit être supérieur ou égal à 1.")
        if self.login_max_attempts < 1 or self.login_lockout_minutes < 1:
            raise ValueError("LOGIN_MAX_ATTEMPTS et LOGIN_LOCKOUT_MINUTES doivent être ≥ 1.")
        if not USERNAME_PATTERN.match(self.admin_username):
            raise ValueError(
                "ADMIN_USERNAME doit faire 3 à 32 caractères parmi lettres, chiffres, « . _ - »."
            )
        if not self.admin_password:
            raise ValueError("ADMIN_PASSWORD ne peut pas être vide.")
