import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

from fastapi import HTTPException, Request, status

from app.services.database import DATA_DIR, get_db

SESSION_COOKIE = "market_risk_session"
SESSION_DAYS = 7
PASSWORD_ITERATIONS = 310_000


def _session_secret() -> bytes:
    configured = os.getenv("SESSION_SECRET")
    if configured:
        return configured.encode("utf-8")

    secret_path = Path(DATA_DIR) / ".session-secret"
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(secret_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return secret_path.read_bytes()
    secret = secrets.token_bytes(32)
    with os.fdopen(descriptor, "wb") as secret_file:
        secret_file.write(secret)
    return secret


SESSION_SECRET = _session_secret()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations_text)
        )
        return hmac.compare_digest(candidate.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_session(user_id: int) -> tuple[str, int]:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    expires_at = now + SESSION_DAYS * 24 * 60 * 60
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (hashlib.sha256(token.encode("utf-8")).hexdigest(), user_id, expires_at, now),
    )
    conn.commit()
    conn.close()
    return token, expires_at


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    conn = get_db()
    row = conn.execute(
        "SELECT users.id, users.email FROM sessions "
        "JOIN users ON users.id = sessions.user_id "
        "WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
        (token_hash, int(time.time())),
    ).fetchone()
    if row is None:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    conn.close()
    return dict(row)


def revoke_session(token: str) -> None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
    conn.commit()
    conn.close()


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
    )