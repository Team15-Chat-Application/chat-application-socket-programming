import os


def read_config(env=None):
    env = os.environ if env is None else env
    raw = env.get('FLASK_PORT', '5000')
    if not raw.isascii() or not raw.isdigit() or not 1 <= int(raw) <= 65535:
        raise ValueError('FLASK_PORT must be an integer from 1 to 65535')
    host = env.get('FLASK_HOST', '127.0.0.1')
    if not host.strip():
        raise ValueError('FLASK_HOST must not be empty')
    return {'host': host, 'port': int(raw)}
