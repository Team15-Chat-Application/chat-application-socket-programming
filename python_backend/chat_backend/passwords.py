import re
import bcrypt

DEFAULT_COST = 12
MAX_PASSWORD_BYTES = 72


class PasswordError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def password_bytes(password):
    if not isinstance(password, str) or not password:
        raise PasswordError('VALIDATION_ERROR', 'password must contain 1 to 72 UTF-8 bytes')
    try:
        encoded = password.encode('utf-8')
    except UnicodeEncodeError:
        raise PasswordError('VALIDATION_ERROR', 'password must contain 1 to 72 UTF-8 bytes') from None
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise PasswordError('VALIDATION_ERROR', 'password must contain 1 to 72 UTF-8 bytes')
    return encoded


def hash_password(password, *, cost=DEFAULT_COST):
    encoded = password_bytes(password)
    if type(cost) is not int or not 10 <= cost <= 14:
        raise PasswordError('VALIDATION_ERROR', 'bcrypt cost must be an integer from 10 to 14')
    try:
        return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=cost)).decode('ascii')
    except Exception:
        raise PasswordError('INTERNAL_ERROR', 'Password hashing failed') from None


def verify_password(password, stored_hash):
    encoded = password_bytes(password)
    if not isinstance(stored_hash, str) or not re.fullmatch(r'\$2[ab]\$1[0-4]\$[./A-Za-z0-9]{53}', stored_hash):
        return False
    try:
        return bcrypt.checkpw(encoded, stored_hash.encode('ascii'))
    except ValueError:
        return False
