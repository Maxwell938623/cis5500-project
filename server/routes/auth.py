import os
import secrets
import hashlib
import base64
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote_plus

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import get_db_connection

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-secret-key-32chars!!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID", "")
TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET", "")
TWITTER_REDIRECT_URI = os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8000/auth/twitter/callback")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# In-memory state store for OAuth flows (state -> {provider, verifier, ts})
_oauth_states: dict = {}
_OAUTH_STATE_TTL = 600  # 10 minutes


def _purge_expired_states():
    now = time.time()
    expired = [k for k, v in _oauth_states.items() if now - v.get("ts", 0) > _OAUTH_STATE_TTL]
    for k in expired:
        del _oauth_states[k]


def _consume_oauth_state(state: str, provider: str) -> dict:
    _purge_expired_states()
    stored = _oauth_states.get(state)
    if not stored or stored.get("provider") != provider:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if time.time() - stored.get("ts", 0) > _OAUTH_STATE_TTL:
        del _oauth_states[state]
        raise HTTPException(status_code=400, detail="OAuth state expired")
    del _oauth_states[state]
    return stored


def _ensure_users_table():
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                password_hash TEXT,
                provider TEXT NOT NULL DEFAULT 'local',
                provider_id TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        conn.commit()


def _create_token(user_id: int, email: str, name: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "name": name or "", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _verify_token(credentials.credentials)


# ── Pydantic models ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Standard auth ────────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest):
    _ensure_users_table()
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    normalized_email = req.email.lower().strip()
    password_hash = pwd_context.hash(req.password)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO users (email, name, password_hash, provider) VALUES (%s, %s, %s, 'local') RETURNING id, email, name",
                (normalized_email, req.name or normalized_email.split("@")[0], password_hash),
            )
            user = cur.fetchone()
            conn.commit()
        token = _create_token(user["id"], user["email"], user["name"])
        return {"access_token": token, "token_type": "bearer", "user": {"email": user["email"], "name": user["name"]}}
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/login")
def login(req: LoginRequest):
    _ensure_users_table()
    normalized_email = req.email.lower().strip()
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, email, name, password_hash FROM users WHERE email = %s AND provider = 'local'", (normalized_email,))
            user = cur.fetchone()
        if not user or not pwd_context.verify(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = _create_token(user["id"], user["email"], user["name"])
        return {"access_token": token, "token_type": "bearer", "user": {"email": user["email"], "name": user["name"]}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Login failed")


@router.get("/me")
def get_me(current_user: dict = Depends(_get_current_user)):
    return {"email": current_user.get("email"), "name": current_user.get("name")}


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/google/authorize")
def google_authorize():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    _purge_expired_states()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"provider": "google", "ts": time.time()}
    params = (
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid+email+profile"
        f"&state={state}"
        f"&access_type=offline"
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth{params}"}


@router.get("/google/callback")
async def google_callback(code: str = Query(...), state: str = Query(...)):
    _consume_oauth_state(state, "google")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_token_failed")
        tokens = token_resp.json()

        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if user_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_failed")
        google_user = user_resp.json()

    email = google_user.get("email", "").lower()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_email_missing")
    if not google_user.get("verified_email", False):
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_email_unverified")
    name = google_user.get("name") or email.split("@")[0]
    provider_id = str(google_user.get("id", ""))
    if not provider_id:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_invalid")

    _ensure_users_table()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        if not user:
            cur.execute(
                "INSERT INTO users (email, name, provider, provider_id) VALUES (%s, %s, 'google', %s) RETURNING id, email, name",
                (email, name, provider_id),
            )
            user = cur.fetchone()
        conn.commit()

    token = _create_token(user["id"], user["email"], user["name"])
    return RedirectResponse(f"{FRONTEND_URL}/oauth-callback#token={quote_plus(token)}")


# ── Twitter / X OAuth 2.0 PKCE ───────────────────────────────────────────────

def _pkce_pair():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


@router.get("/twitter/authorize")
def twitter_authorize():
    if not TWITTER_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Twitter OAuth not configured")
    _purge_expired_states()
    state = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()
    _oauth_states[state] = {"provider": "twitter", "verifier": verifier, "ts": time.time()}
    params = (
        f"?response_type=code"
        f"&client_id={TWITTER_CLIENT_ID}"
        f"&redirect_uri={TWITTER_REDIRECT_URI}"
        f"&scope=tweet.read+users.read+offline.access"
        f"&state={state}"
        f"&code_challenge={challenge}"
        f"&code_challenge_method=S256"
    )
    return {"url": f"https://twitter.com/i/oauth2/authorize{params}"}


@router.get("/twitter/callback")
async def twitter_callback(code: str = Query(...), state: str = Query(...)):
    stored = _consume_oauth_state(state, "twitter")
    verifier = stored["verifier"]

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "code": code,
                "grant_type": "authorization_code",
                "client_id": TWITTER_CLIENT_ID,
                "redirect_uri": TWITTER_REDIRECT_URI,
                "code_verifier": verifier,
            },
            auth=(TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET),
        )
        if token_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=twitter_token_failed")
        tokens = token_resp.json()

        user_resp = await client.get(
            "https://api.twitter.com/2/users/me?user.fields=name,username",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if user_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=twitter_userinfo_failed")
        tw_data = user_resp.json().get("data", {})

    provider_id = str(tw_data.get("id", ""))
    if not provider_id:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=twitter_userinfo_invalid")
    name = tw_data.get("name") or tw_data.get("username", "twitter_user")
    email = f"twitter_{provider_id}@placeholder.invalid"

    _ensure_users_table()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name FROM users WHERE provider = 'twitter' AND provider_id = %s", (provider_id,))
        user = cur.fetchone()
        if not user:
            cur.execute(
                "INSERT INTO users (email, name, provider, provider_id) VALUES (%s, %s, 'twitter', %s) RETURNING id, email, name",
                (email, name, provider_id),
            )
            user = cur.fetchone()
        conn.commit()

    token = _create_token(user["id"], user["email"], user["name"])
    return RedirectResponse(f"{FRONTEND_URL}/oauth-callback#token={quote_plus(token)}")
