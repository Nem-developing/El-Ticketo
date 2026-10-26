"""Hachage des mots de passe (scrypt, bibliothèque standard), tokens et données signées."""

import base64
import hashlib
import hmac
import secrets
import time

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1


def _b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt, digest = encoded.split("$")
        if algorithm != "scrypt":
            return False
        expected = base64.b64decode(digest)
        candidate = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except ValueError:
        return False
    return hmac.compare_digest(candidate, expected)


# Sert à vérifier un mot de passe même quand l'utilisateur n'existe pas, pour que
# le temps de réponse ne révèle pas quels identifiants sont valides.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# Clé des liens de fichiers et du cookie de connexion SSO. Elle change à chaque démarrage, ce
# qui invalide les anciens liens : ils ne servent que quelques minutes à quelques heures.
_KEY = secrets.token_bytes(32)


def sign(data: str) -> str:
    return f"{data}.{hmac.new(_KEY, data.encode(), hashlib.sha256).hexdigest()}"


def unsign(signed: str) -> str | None:
    """Données signées par `sign`, ou None si la signature est fausse."""
    data = signed.rpartition(".")[0]
    return data if hmac.compare_digest(sign(data).encode(), signed.encode()) else None


# Une balise <img> ou un lien de téléchargement ne peut pas envoyer le token de session :
# les fichiers sont servis par des liens signés, que la liste des pièces jointes fournit.
def _signature(attachment_id: int, expires: int) -> str:
    message = f"{attachment_id}:{expires}".encode()
    return hmac.new(_KEY, message, hashlib.sha256).hexdigest()


def attachment_url(attachment_id: int) -> str:
    # Valable 1 à 2 h et identique pendant une heure : le navigateur garde l'image en cache.
    expires = (int(time.time()) // 3600 + 2) * 3600
    signature = _signature(attachment_id, expires)
    return f"/api/attachments/{attachment_id}/file?expires={expires}&signature={signature}"


def is_valid_attachment_link(attachment_id: int, expires: int, signature: str) -> bool:
    expected = _signature(attachment_id, expires)
    return expires > time.time() and hmac.compare_digest(signature.encode(), expected.encode())
