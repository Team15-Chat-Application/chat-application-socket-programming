"""Verify actual Node build and Flask launchers on isolated loopback ports."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent


def unused_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def check(service, command, port_key):
    port = unused_port()
    env = os.environ.copy()
    env.update({port_key: str(port), 'NODE_HOST': '127.0.0.1', 'FLASK_HOST': '127.0.0.1',
                'PYTHONPATH': str(ROOT / 'python_backend')})
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, encoding='utf-8')
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f'{service} launcher exited: {process.communicate()[0]}')
            try:
                with urlopen(f'http://127.0.0.1:{port}/api/health', timeout=0.5) as response:
                    body = json.load(response)
                    assert response.status == 200 and body['ok'] is True
                    assert body['data']['service'] == service
                    print(f'{service}: actual launcher HTTP health passed on port {port}', flush=True)
                    return
            except (URLError, TimeoutError):
                time.sleep(0.05)  # Retry the readiness condition within a bounded deadline.
        raise RuntimeError(f'{service} launcher did not become ready')
    finally:
        if process.poll() is None:
            process.terminate()
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate(timeout=5)


if __name__ == '__main__':
    check('node', ['node', 'dist/index.js'], 'NODE_PORT')
    check('flask', [sys.executable, '-m', 'chat_backend'], 'FLASK_PORT')
