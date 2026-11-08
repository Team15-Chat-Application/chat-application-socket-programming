
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


def http_result(url, method='GET', data=None):
    request = Request(
        url,
        data=data,
        method=method,
        headers={'Content-Type': 'application/json'}
    )
    try:
        response = urlopen(request, timeout=2)
    except HTTPError as error:
        response = error

    with response:
        raw_body = response.read()
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            body = {}

        return response.status, body, response.headers


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def check(service, command, port_key):
    port = unused_port()
    env = os.environ.copy()
    env.update({
        port_key: str(port),
        'NODE_HOST': '127.0.0.1',
        'FLASK_HOST': '127.0.0.1',
        'PYTHONPATH': str(ROOT / 'python_backend')
    })

    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8'
    )

    try:
        deadline = time.monotonic() + 10

        while time.monotonic() < deadline:
            if process.poll() is not None:
                output, _ = process.communicate()
                raise RuntimeError(f'{service} launcher exited: {output}')

            try:
                with urlopen(
                    f'http://127.0.0.1:{port}/api/health',
                    timeout=0.5
                ) as response:
                    body = json.load(response)
                    require(
                        response.status == 200
                        and body.get('ok') is True
                        and body.get('data', {}).get('service') == service,
                        f'{service}: invalid health response'
                    )
                    break
            except (URLError, TimeoutError):
                time.sleep(0.05)
        else:
            raise RuntimeError(f'{service} launcher did not become ready')

        url = f'http://127.0.0.1:{port}'

        if service == 'node':
            # The Node launcher now has real authentication routes.
            # Send invalid JSON-shaped credentials and ensure they are rejected.
            invalid_login = json.dumps({
                'username': '',
                'password': ''
            }).encode('utf-8')

            for _ in range(5):
                status, body, headers = http_result(
                    url + '/api/auth/login',
                    'POST',
                    invalid_login
                )
                require(
                    status in (400, 401)
                    and body.get('ok') is False
                    and headers.get('Cache-Control') == 'no-store',
                    f'{service}: invalid login was not safely rejected '
                    f'(HTTP {status})'
                )

            # The sixth request should hit the IP-based login rate limiter.
            status, body, headers = http_result(
                url + '/api/auth/login',
                'POST',
                invalid_login
            )
            require(
                status == 429
                and body.get('error', {}).get('code') == 'RATE_LIMITED'
                and 1 <= int(headers.get('Retry-After', '0')) <= 60
                and headers.get('Cache-Control') == 'no-store',
                f'{service}: launcher login limiter failed '
                f'(HTTP {status})'
            )

            login_handler = 'AVAILABLE_REJECTS_INVALID_INPUT'

        else:
            # The Flask launcher is expected to keep authentication unavailable.
            for _ in range(5):
                status, body, _headers = http_result(
                    url + '/api/auth/login',
                    'POST'
                )
                require(
                    status == 404
                    and body.get('error', {}).get('code') == 'NOT_FOUND',
                    f'{service}: login handler is unexpectedly available'
                )

            status, body, headers = http_result(
                url + '/api/auth/login',
                'POST'
            )
            require(
                status == 429
                and body.get('error', {}).get('code') == 'RATE_LIMITED'
                and 1 <= int(headers.get('Retry-After', '0')) <= 60
                and headers.get('Cache-Control') == 'no-store',
                f'{service}: launcher login limiter failed'
            )

            login_handler = 'UNAVAILABLE'

        probe = subprocess.run(
            ['node', 'scripts/probe_default_socket.js', url, service],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10
        )

        if probe.returncode != 0:
            raise RuntimeError(
                f'{service}: socket probe failed.\n'
                f'STDOUT:\n{probe.stdout}\n'
                f'STDERR:\n{probe.stderr}'
            )

        result = json.loads(probe.stdout)

        require(
            result.get('unauthenticatedSocketRejected') is True,
            f'{service}: invalid socket probe result'
        )
        require(
            http_result(url + '/api/health')[0] == 200,
            f'{service}: launcher stopped during denial checks'
        )

        print(
            f'{service}: launcher health, login checks, rate limiting '
            'and socket denial passed',
            flush=True
        )

        return dict(
            result,
            health='PASS',
            loginHandler=login_handler,
            loginRateLimit='PASS'
        )

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
    parser.add_argument(
        '--report',
        type=Path,
        help='Write actual smoke results as JSON'
    )
    args = parser.parse_args()

    report = {
        'executedAt': datetime.now(timezone.utc).isoformat(),
        'workingProductVerified': False,
        'scope': (
            'Real default launchers; polling transport; '
            'no authentication or messaging fixtures'
        ),
        'services': []
    }

    try:
        report['services'].append(
            check('node', ['node', 'dist/index.js'], 'NODE_PORT')
        )
        report['services'].append(
            check(
                'flask',
                [sys.executable, '-m', 'chat_backend'],
                'FLASK_PORT'
            )
        )
        report['status'] = 'PASS'

    except Exception:
        report['status'] = 'FAIL'
        raise

    finally:
        if args.report:
            path = (
                args.report
                if args.report.is_absolute()
                else ROOT / args.report
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(report, indent=2) + '\n',
                encoding='utf-8'
            )
