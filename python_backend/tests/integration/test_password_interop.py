import json
from pathlib import Path
import subprocess
import pytest
from chat_backend.passwords import hash_password, verify_password

ROOT = Path(__file__).resolve().parents[3]


def node_operation(**payload):
    result = subprocess.run(
        ['node', str(ROOT / 'tests/fixtures/password_bridge.js')],
        input=json.dumps(payload), text=True, encoding='utf-8',
        capture_output=True, cwd=ROOT, timeout=10, check=True)
    assert result.stderr == ''
    return json.loads(result.stdout)


@pytest.mark.parametrize('password', ['fixture-unicode-🔐', 'a' * 72, '😀' * 18, 'prefix\x00suffix'])
def test_node_and_python_verify_each_others_hashes(password):
    node_hash = node_operation(operation='hash', password=password)
    assert verify_password(password, node_hash) is True
    assert verify_password('wrong-password', node_hash) is False
    python_hash = hash_password(password, cost=10)
    assert node_operation(operation='verify', password=password, hash=python_hash) is True
    assert node_operation(operation='verify', password='wrong-password', hash=python_hash) is False
