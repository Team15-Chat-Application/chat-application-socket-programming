"""Explicit transport configuration shared by the runtime and CLI launcher."""


def _is_production(env):
    # run_flask.ps1 copies .env values verbatim, unlike Node's --env-file, so the
    # flag can arrive quoted, padded or capitalised and must not select plaintext.
    for flag in ('NODE_ENV', 'FLASK_ENV'):
        value = env.get(flag)
        if isinstance(value, str):
            value = value.strip()
            if value[:1] in ('"', "'") and value[-1:] == value[:1]:
                value = value[1:-1].strip()
            if value.lower() == 'production':
                return True
    return False


def read_tls_config(env):
    cert_path = env.get('TLS_CERT_PATH') or None
    key_path = env.get('TLS_KEY_PATH') or None
    if bool(cert_path) != bool(key_path):
        raise ValueError('Both TLS_CERT_PATH and TLS_KEY_PATH are required')
    secret = env.get('JWT_SECRET')
    if _is_production(env) and (not cert_path or not isinstance(secret, str) or len(secret.encode()) < 32):
        raise ValueError('Production requires JWT_SECRET and TLS certificate/key')
    return cert_path, key_path
