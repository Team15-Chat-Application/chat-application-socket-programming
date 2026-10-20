import re
from unicodedata import category
import nh3


class InputError(Exception):
    code = 'VALIDATION_ERROR'


def sanitize_plain_text(value):
    return nh3.clean(value, tags=set(), attributes={}, link_rel=None,
                     clean_content_tags={'script', 'style', 'textarea', 'option', 'iframe', 'object', 'svg', 'math'})


def sanitize_username(value):
    if not isinstance(value, str) or re.fullmatch(r'[A-Za-z0-9_.-]{1,32}', value) is None:
        raise InputError('username must contain 1 to 32 letters, digits, dots, underscores or hyphens')
    return value


def sanitize_message(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 2000 or any(
        category(c) == 'Cs' or (category(c) == 'Cc' and c not in '\t\r\n') for c in value
    ):
        raise InputError('content must contain 1 to 2000 characters without invalid controls')
    clean = sanitize_plain_text(value)
    if not clean.strip():
        raise InputError('content is empty after sanitisation')
    return clean
