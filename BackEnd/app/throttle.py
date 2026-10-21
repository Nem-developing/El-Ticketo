"""Limitation des tentatives de connexion (protection contre le brute-force).

Compteur en mémoire, propre au processus : suffisant pour une instance unique de l'API.
"""

import threading
import time
from collections import deque


class LoginThrottle:
    def __init__(self, max_attempts: int, window_seconds: float) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def acquire(self, key: str) -> int:
        """Enregistre une tentative et renvoie 0 si elle est autorisée, sinon le nombre de
        secondes à attendre.

        La tentative est comptée *avant* la vérification du mot de passe : des requêtes
        parallèles ne peuvent donc pas dépasser la limite. Un succès appelle `reset`.
        """
        with self._lock:
            now = time.monotonic()
            attempts = self._recent_attempts(key, now)
            if len(attempts) >= self.max_attempts:
                return max(1, int(attempts[0] + self.window_seconds - now) + 1)
            attempts.append(now)
            if len(self._attempts) > 10_000:
                self._prune(now)
            return 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)

    def _recent_attempts(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts.setdefault(key, deque())
        while attempts and attempts[0] <= now - self.window_seconds:
            attempts.popleft()
        return attempts

    def _prune(self, now: float) -> None:
        for key in list(self._attempts):
            if not self._recent_attempts(key, now):
                del self._attempts[key]
