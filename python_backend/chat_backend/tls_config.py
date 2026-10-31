"""Explicit transport configuration shared by the runtime and CLI launcher."""


def read_tls_config(env):
    cert_path = env.get('TLS_CERT_PATH') or None
    key_path = env.get('TLS_KEY_PATH') or None
    if bool(cert_path) != bool(key_path):
        raise ValueError('Both TLS_CERT_PATH and TLS_KEY_PATH are required')
    production = any(env.get(flag) == 'production' for flag in ('NODE_ENV', 'FLASK_ENV'))
    secret = env.get('JWT_SECRET')
    if production and (not cert_path or not isinstance(secret, str) or len(secret.encode()) < 32):
        raise ValueError('Production requires JWT_SECRET and TLS certificate/key')
    return cert_path, key_path
