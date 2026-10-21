from concurrent.futures import ThreadPoolExecutor

from app import throttle as throttle_module
from app.throttle import LoginThrottle
from tests.conftest import ADMIN_PASSWORD


def test_login_is_blocked_after_too_many_failures(client):
    bad = {"username": "admin", "password": "wrong"}
    for _ in range(client.app.state.settings.login_max_attempts):
        assert client.post("/api/auth/login", json=bad).status_code == 401

    blocked = client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Trop de tentatives" in blocked.json()["detail"]

    # Le blocage ne vise que ce couple adresse / identifiant.
    other = client.post("/api/auth/login", json={"username": "alice", "password": "x"})
    assert other.status_code == 401


def test_successful_login_resets_the_counter(client):
    bad = {"username": "admin", "password": "wrong"}
    for _ in range(client.app.state.settings.login_max_attempts - 1):
        client.post("/api/auth/login", json=bad)
    good = {"username": "admin", "password": ADMIN_PASSWORD}
    assert client.post("/api/auth/login", json=good).status_code == 200
    assert client.post("/api/auth/login", json=bad).status_code == 401


def test_attempts_expire_after_the_window(monkeypatch):
    now = 1000.0
    monkeypatch.setattr(throttle_module.time, "monotonic", lambda: now)
    throttle = LoginThrottle(max_attempts=2, window_seconds=60)

    assert throttle.acquire("ip|admin") == 0
    assert throttle.acquire("ip|admin") == 0
    assert throttle.acquire("ip|admin") == 61

    now += 61
    assert throttle.acquire("ip|admin") == 0


def test_parallel_attempts_cannot_exceed_the_limit():
    throttle = LoginThrottle(max_attempts=5, window_seconds=60)
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(lambda _: throttle.acquire("ip|admin"), range(40)))
    assert results.count(0) == 5
