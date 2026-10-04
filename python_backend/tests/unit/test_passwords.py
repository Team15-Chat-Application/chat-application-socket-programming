import pytest
from chat_backend.passwords import DEFAULT_COST, PasswordError, hash_password, verify_password


def test_tc_sec_02_default_cost_and_password_verification():
    password = 'fixture-password-🔐'
    hashed = hash_password(password)
    assert DEFAULT_COST == 12
    assert hashed.startswith('$2b$12$')
    assert password not in hashed
    assert verify_password(password, hashed) is True
    assert verify_password('wrong-password', hashed) is False


def test_minimum_cost_and_fresh_random_salt():
    first = hash_password('fixture-password', cost=10)
    second = hash_password('fixture-password', cost=10)
    assert first.startswith('$2b$10$')
    assert first != second
    assert verify_password('fixture-password', second) is True


@pytest.mark.parametrize('password', [None, 123, '', 'a' * 73, '😀' * 19, '\ud800'])
def test_invalid_password_errors_do_not_echo_input(password):
    for operation in (lambda: hash_password(password), lambda: verify_password(password, 'not-a-hash')):
        with pytest.raises(PasswordError) as caught:
            operation()
        assert caught.value.code == 'VALIDATION_ERROR'
        assert str(caught.value) == 'password must contain 1 to 72 UTF-8 bytes'


@pytest.mark.parametrize('cost', [9, 15, 10.5, '10', True])
def test_rejects_unsupported_cost(cost):
    with pytest.raises(PasswordError) as caught:
        hash_password('fixture-password', cost=cost)
    assert caught.value.code == 'VALIDATION_ERROR'


@pytest.mark.parametrize('password', ['a' * 72, '😀' * 18, 'prefix\x00suffix'])
def test_byte_boundaries_and_nul_suffixes(password):
    hashed = hash_password(password, cost=10)
    assert verify_password(password, hashed) is True
    assert verify_password('prefix', hashed) is False


@pytest.mark.parametrize('hashed', [None, 123, '', 'plaintext', '$2b$09$' + 'a' * 53, '$2b$31$' + 'a' * 53])
def test_bad_stored_hash_fails_closed(hashed):
    assert verify_password('fixture-password', hashed) is False


def test_hashing_and_verification_do_not_log_plaintext(caplog, capsys):
    hashed = hash_password('fixture-log-secret', cost=10)
    verify_password('fixture-log-secret', hashed)
    verify_password('wrong-log-secret', hashed)
    captured = capsys.readouterr()
    assert captured.out == captured.err == ''
    assert caplog.records == []


def test_native_hashing_failure_exposes_generic_error(monkeypatch):
    def fail(*_args):
        raise ValueError('fixture-secret')
    monkeypatch.setattr('chat_backend.passwords.bcrypt.hashpw', fail)
    with pytest.raises(PasswordError) as caught:
        hash_password('fixture-secret')
    assert caught.value.code == 'INTERNAL_ERROR'
    assert str(caught.value) == 'Password hashing failed'
