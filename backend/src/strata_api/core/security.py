"""Security, authentication & cryptography utilities."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
import bcrypt
import jwt
from strata_api.config import settings

# In-memory revocation denylist for tokens (can also be backed by DB/Redis)
_revoked_tokens: Set[str] = set()

DEFAULT_DEV_JWT_SECRET = "strata_super_secret_jwt_key_development_only_change_in_prod"


def validate_jwt_security_config() -> None:
    """Validate that JWT secret is securely configured, failing fast on production boot."""
    env = (getattr(settings, "ENVIRONMENT", "") or "").strip().lower()
    secret = getattr(settings, "JWT_SECRET_KEY", "") or ""
    if env in ("production", "prod"):
        if not secret or secret == DEFAULT_DEV_JWT_SECRET or len(secret) < 32:
            raise RuntimeError(
                "FATAL: Application cannot start in production environment with default or insecure JWT_SECRET_KEY. "
                "Set a secure 32+ character JWT_SECRET_KEY environment variable."
            )


def hash_password(password: str) -> str:
    """Securely hash a plain text password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def revoke_token(token_or_jti: str, user_id: Optional[str] = None) -> None:
    """Revoke an active access or refresh token by adding its jti or token string to denylist and DB."""
    if not token_or_jti:
        return
    _revoked_tokens.add(token_or_jti)
    expires_at = None
    extracted_jti = None
    extracted_user_id = user_id
    try:
        unverified = jwt.decode(token_or_jti, options={"verify_signature": False})
        extracted_jti = unverified.get("jti")
        if not extracted_user_id:
            extracted_user_id = unverified.get("sub")
        exp_ts = unverified.get("exp")
        if exp_ts:
            expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        if extracted_jti:
            _revoked_tokens.add(extracted_jti)
    except Exception:
        pass

    try:
        from strata_api.core.persistence import save_revoked_token_to_db
        save_revoked_token_to_db(token_or_jti, user_id=extracted_user_id, expires_at=expires_at)
        if extracted_jti:
            save_revoked_token_to_db(extracted_jti, user_id=extracted_user_id, expires_at=expires_at)
    except Exception:
        pass


def is_token_revoked(token_or_jti: str) -> bool:
    """Check if a token string or JTI has been marked as revoked in-memory or database."""
    if not token_or_jti:
        return False
    if token_or_jti in _revoked_tokens:
        return True

    extracted_jti = None
    try:
        unverified = jwt.decode(token_or_jti, options={"verify_signature": False})
        extracted_jti = unverified.get("jti")
        if extracted_jti and extracted_jti in _revoked_tokens:
            return True
    except Exception:
        pass

    # Fallback to database check
    try:
        from strata_api.core.persistence import is_token_revoked_in_db
        if is_token_revoked_in_db(token_or_jti):
            _revoked_tokens.add(token_or_jti)
            return True
        if extracted_jti and is_token_revoked_in_db(extracted_jti):
            _revoked_tokens.add(extracted_jti)
            return True
    except Exception:
        pass

    return False


def clear_revoked_tokens() -> None:
    """Clear token revocation denylist in memory and DB (used in test teardown)."""
    _revoked_tokens.clear()
    try:
        from strata_api.core.persistence import delete_all_revoked_tokens_from_db
        delete_all_revoked_tokens_from_db()
    except Exception:
        pass



def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token with JTI tracking."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = to_encode.get("jti") or str(uuid.uuid4())
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": jti,
        "type": to_encode.get("type", "access"),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed, long-lived JWT refresh token with unique JTI."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=7)

    jti = str(uuid.uuid4())
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": jti,
        "type": "refresh",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str, expected_type: Optional[str] = "access") -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token, rejecting revoked tokens and enforcing token type."""
    if is_token_revoked(token):
        return None
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if expected_type is not None and payload.get("type") != expected_type:
            return None
        jti = payload.get("jti")
        if jti and is_token_revoked(jti):
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT refresh token, rejecting revoked tokens."""
    return decode_access_token(token, expected_type="refresh")


def decode_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a password reset token."""
    return decode_access_token(token, expected_type="reset_password")


def decode_magic_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a magic login link token."""
    return decode_access_token(token, expected_type="magic_link")


def sanitize_column_name(col: str) -> str:
    """Sanitize column name to prevent SQL injection or bad syntax."""
    return col.replace('"', '""')

# In-memory storage for hashed API keys with user/workspace mapping, expiry, and revocation support
_api_keys_db: Dict[str, Dict[str, Any]] = {}


def hash_api_key(api_key: str) -> str:
    """Compute SHA-256 hash of an API key for safe storage and constant-time lookup."""
    return hashlib.sha256(api_key.strip().encode("utf-8")).hexdigest()


def generate_api_key(
    user_id: str,
    workspace_id: Optional[str] = None,
    name: str = "Default API Key",
    expires_in_days: Optional[int] = 30,
) -> Tuple[str, Dict[str, Any]]:
    """Generate a high-entropy API key, hash it, and store metadata tied to a user/workspace.

    Returns the raw API key (to be shown to the user once) and the stored record.
    """
    raw_secret = secrets.token_hex(20)
    raw_key = f"strata_live_{raw_secret}"
    key_id = f"key_{uuid.uuid4().hex[:12]}"
    key_hash = hash_api_key(raw_key)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(days=expires_in_days) if expires_in_days is not None else None

    record = {
        "id": key_id,
        "key_hash": key_hash,
        "key_prefix": raw_key[:16],
        "user_id": user_id,
        "workspace_id": workspace_id,
        "name": name,
        "is_revoked": False,
        "created_at": created_at,
        "expires_at": expires_at,
        "last_used_at": None,
    }
    _api_keys_db[key_hash] = record
    try:
        from strata_api.core.persistence import save_api_key_to_db
        save_api_key_to_db(record)
    except Exception:
        pass
    return raw_key, record


def verify_api_key(api_key: Optional[str]) -> bool:
    """Verify an API key against stored hashed keys, checking validity, expiry, and revocation."""
    if not api_key or not isinstance(api_key, str) or not api_key.strip():
        return False

    key_hash = hash_api_key(api_key)
    record = _api_keys_db.get(key_hash)
    if not record:
        try:
            from strata_api.core.persistence import get_api_key_by_hash_from_db
            db_record = get_api_key_by_hash_from_db(key_hash)
            if db_record:
                _api_keys_db[key_hash] = db_record
                record = db_record
        except Exception:
            pass

    if not record:
        return False

    if record.get("is_revoked", False):
        return False

    expires_at = record.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at)
            except Exception:
                pass
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_at:
                return False

    now = datetime.now(timezone.utc)
    record["last_used_at"] = now
    try:
        from strata_api.core.persistence import update_api_key_usage_in_db
        update_api_key_usage_in_db(key_hash, now)
    except Exception:
        pass
    return True


def get_api_key_record(api_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve key record if the API key is verified, active, and unexpired."""
    if not verify_api_key(api_key):
        return None
    key_hash = hash_api_key(api_key)
    return _api_keys_db.get(key_hash)


def revoke_api_key(key_id_or_raw: str) -> bool:
    """Revoke an active API key by ID or raw secret in memory and DB."""
    revoked = False
    for record in _api_keys_db.values():
        if record["id"] == key_id_or_raw or record["key_hash"] == hash_api_key(key_id_or_raw):
            record["is_revoked"] = True
            revoked = True
            break
    try:
        from strata_api.core.persistence import revoke_api_key_in_db
        if revoke_api_key_in_db(key_id_or_raw):
            revoked = True
    except Exception:
        pass
    return revoked


def list_api_keys_for_user(user_id: str) -> List[Dict[str, Any]]:
    """List non-secret API key metadata for a specific user from DB and memory."""
    keys_map: Dict[str, Dict[str, Any]] = {}
    try:
        from strata_api.core.persistence import get_api_keys_for_user_from_db
        for db_key in get_api_keys_for_user_from_db(user_id):
            keys_map[db_key["id"]] = db_key
    except Exception:
        pass

    for r in _api_keys_db.values():
        if r.get("user_id") == user_id:
            keys_map[r["id"]] = r

    result = []
    for r in keys_map.values():
        c_at = r.get("created_at")
        e_at = r.get("expires_at")
        u_at = r.get("last_used_at")
        result.append({
            "id": r["id"],
            "name": r["name"],
            "key_prefix": r["key_prefix"],
            "workspace_id": r.get("workspace_id"),
            "is_revoked": r.get("is_revoked", False),
            "created_at": c_at.isoformat() if hasattr(c_at, "isoformat") else c_at,
            "expires_at": e_at.isoformat() if e_at and hasattr(e_at, "isoformat") else e_at,
            "last_used_at": u_at.isoformat() if u_at and hasattr(u_at, "isoformat") else u_at,
        })
    return result


def clear_api_keys() -> None:
    """Clear in-memory and database API keys (primarily for testing)."""
    _api_keys_db.clear()
    try:
        from strata_api.core.persistence import delete_all_api_keys_from_db
        delete_all_api_keys_from_db()
    except Exception:
        pass

