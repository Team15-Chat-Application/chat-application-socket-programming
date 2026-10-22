"""Verify real development launchers; this never certifies a working chat product."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent


def unused_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def http_result(url, method='GET'):
    request = Request(url, method=method)
    try:
        response = urlopen(request, timeout=2)
    except HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response), response.headers


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


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
                    require(response.status == 200 and body['ok'] is True and
                            body['data']['service'] == service, f'{service}: invalid health response')
                    break
            except (URLError, TimeoutError):
                time.sleep(0.05)  # Retry the readiness condition within a bounded deadline.
        else:
            raise RuntimeError(f'{service} launcher did not become ready')
        url = f'http://127.0.0.1:{port}'
        for _ in range(5):
            status, body, _headers = http_result(url + '/api/auth/login', 'POST')
            require(status == 404 and body.get('error', {}).get('code') == 'NOT_FOUND',
                    f'{service}: real login handler is unexpectedly available; update the smoke contract before proceeding')
        status, body, headers = http_result(url + '/api/auth/login', 'POST')
        require(status == 429 and body.get('error', {}).get('code') == 'RATE_LIMITED' and
                1 <= int(headers.get('Retry-After', '0')) <= 60 and headers.get('Cache-Control') == 'no-store',
                f'{service}: launcher login limiter failed')
        probe = subprocess.run(['node', 'scripts/probe_default_socket.js', url, service], cwd=ROOT,
                               capture_output=True, text=True, timeout=10, check=True)
        result = json.loads(probe.stdout)
        require(result.get('unauthenticatedSocketRejected') is True, f'{service}: invalid socket probe result')
        require(http_result(url + '/api/health')[0] == 200, f'{service}: launcher stopped during denial checks')
        print(f'{service}: actual launcher health, five unavailable-login responses, sixth-attempt 429 and socket denial passed', flush=True)
        return dict(result, health='PASS', loginHandler='UNAVAILABLE', loginRateLimit='PASS')
    finally:
        if process.poll() is None:
            process.terminate()
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate(timeout=5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, help='Write actual smoke results as JSON')
    args = parser.parse_args()
    report = {'executedAt': datetime.now(timezone.utc).isoformat(),
              'workingProductVerified': False,
              'scope': 'Real default launchers only; polling transport; no authentication or messaging fixtures',
              'services': []}
    try:
        report['services'].append(check('node', ['node', 'dist/index.js'], 'NODE_PORT'))
        report['services'].append(check('flask', [sys.executable, '-m', 'chat_backend'], 'FLASK_PORT'))
        report['status'] = 'PASS'
    except Exception:
        report['status'] = 'FAIL'
        raise
    finally:
        if args.report:
            path = args.report if args.report.is_absolute() else ROOT / args.report
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
