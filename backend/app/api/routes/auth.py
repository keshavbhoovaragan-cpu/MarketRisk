import re
import sqlite3
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from typing import Literal

from app.services.auth import (
    SESSION_COOKIE,
    create_session,
    get_current_user,
    hash_password,
    revoke_session,
    set_session_cookie,
    verify_password,
)
from app.services.database import get_db

router = APIRouter()
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)


class Preferences(BaseModel):
    experience_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    risk_tolerance: Literal["conservative", "moderate", "aggressive"] = "moderate"
    investment_horizon: Literal["short_term", "medium_term", "long_term"] = "long_term"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: Credentials, response: Response):
    email = body.email.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")

    now = int(time.time())
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, hash_password(body.password), now),
        )
        user_id = cursor.lastrowid
        conn.execute(
            "INSERT INTO portfolios (name, created_at, user_id, cash_balance, starting_cash, is_paper) "
            "VALUES (?, ?, ?, ?, ?, 1)",
            ("My first portfolio", now, user_id, 100_000, 100_000),
        )
        conn.execute(
            "INSERT INTO user_preferences (user_id, experience_level, risk_tolerance, investment_horizon, updated_at) "
            "VALUES (?, 'beginner', 'moderate', 'long_term', ?)",
            (user_id, now),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    finally:
        conn.close()

    token, _ = create_session(user_id)
    set_session_cookie(response, token)
    return {"user": {"id": user_id, "email": email}}


@router.post("/login")
async def login(body: Credentials, response: Response):
    email = body.email.strip().lower()
    conn = get_db()
    user = conn.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ? COLLATE NOCASE", (email,)
    ).fetchone()
    conn.close()
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token, _ = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": {"id": user["id"], "email": user["email"]}}


@router.get("/me")
async def current_user(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    conn = get_db()
    preferences = conn.execute(
        "SELECT experience_level, risk_tolerance, investment_horizon FROM user_preferences WHERE user_id = ?",
        (user["id"],),
    ).fetchone()
    conn.close()
    return {"preferences": dict(preferences) if preferences else {
        "experience_level": "beginner", "risk_tolerance": "moderate", "investment_horizon": "long_term"
    }}


@router.put("/preferences")
async def save_preferences(body: Preferences, user: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        "INSERT INTO user_preferences (user_id, experience_level, risk_tolerance, investment_horizon, updated_at) "
        "VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET "
        "experience_level=excluded.experience_level, risk_tolerance=excluded.risk_tolerance, "
        "investment_horizon=excluded.investment_horizon, updated_at=excluded.updated_at",
        (user["id"], body.experience_level, body.risk_tolerance, body.investment_horizon, int(time.time())),
    )
    conn.commit()
    conn.close()
    return {"preferences": body.model_dump() if hasattr(body, "model_dump") else body.dict()}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    del user
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        revoke_session(token)
    response.delete_cookie(key=SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response