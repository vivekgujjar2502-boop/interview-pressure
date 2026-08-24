import hashlib
import hmac
import secrets

PBKDF2_ITERATIONS = 390_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False

    try:
        algorithm, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        int(iterations),
    ).hex()

    return hmac.compare_digest(candidate, digest)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


PASSWORD_RULE_MESSAGE = (
    "Password must be at least 8 characters and contain "
    "at least one letter and one number."
)


def validate_password(password: str) -> str | None:
    """Return None when valid, otherwise a human-readable reason."""
    if len(password) < 8:
        return PASSWORD_RULE_MESSAGE
    if not any(char.isalpha() for char in password):
        return PASSWORD_RULE_MESSAGE
    if not any(char.isdigit() for char in password):
        return PASSWORD_RULE_MESSAGE
    return None
