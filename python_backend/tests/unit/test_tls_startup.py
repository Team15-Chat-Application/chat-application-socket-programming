"""Regression cases from Yaswanth's 31 October PR #47 review."""
from unittest.mock import Mock

import pytest

from chat_backend.runtime import create_runtime
from chat_backend import __main__ as launcher

SECRET = 'isolated-tls-config-test-secret-over-32-bytes'


@pytest.mark.parametrize('flag', ['NODE_ENV', 'FLASK_ENV'])
@pytest.mark.parametrize('settings', [
    {'JWT_SECRET': SECRET},
    {'TLS_CERT_PATH': 'cert.pem', 'TLS_KEY_PATH': 'key.pem'},
    {'TLS_CERT_PATH': 'cert.pem', 'TLS_KEY_PATH': 'key.pem', 'JWT_SECRET': 'short'},
])
def test_either_production_flag_requires_tls_and_strong_secret(tmp_path, flag, settings):
    filename = tmp_path / 'must-not-be-created.sqlite'
    result = None
    try:
        with pytest.raises(ValueError, match='Production requires'):
            result = create_runtime({flag: 'production', **settings}, str(filename))
    finally:
        if result is not None:
            result[-1]()
    assert not filename.exists()


@pytest.mark.parametrize('only_path', ['TLS_CERT_PATH', 'TLS_KEY_PATH'])
def test_partial_tls_configuration_is_rejected_even_in_development(tmp_path, only_path):
    filename = tmp_path / 'must-not-be-created.sqlite'
    result = None
    try:
        with pytest.raises(ValueError, match='Both TLS_CERT_PATH and TLS_KEY_PATH'):
            result = create_runtime({'JWT_SECRET': SECRET, only_path: 'unused.pem'}, str(filename))
    finally:
        if result is not None:
            result[-1]()
    assert not filename.exists()


def test_flask_production_cannot_be_disabled_by_node_development(tmp_path):
    result = None
    try:
        with pytest.raises(ValueError, match='Production requires'):
            result = create_runtime({'NODE_ENV': 'development', 'FLASK_ENV': 'production',
                                     'JWT_SECRET': SECRET}, str(tmp_path / 'unused.sqlite'))
    finally:
        if result is not None:
            result[-1]()


@pytest.mark.parametrize('only_path', ['TLS_CERT_PATH', 'TLS_KEY_PATH'])
def test_launcher_never_starts_plaintext_with_partial_tls(monkeypatch, only_path):
    for name in ['NODE_ENV', 'FLASK_ENV', 'TLS_CERT_PATH', 'TLS_KEY_PATH']:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('JWT_SECRET', SECRET)
    monkeypatch.setenv(only_path, 'unused.pem')
    socketio = Mock()
    factory = Mock(return_value=(Mock(), socketio, None, None, Mock()))
    monkeypatch.setattr(launcher, 'create_runtime', factory)
    monkeypatch.setattr(launcher, 'read_config', lambda: {'host': '127.0.0.1', 'port': 5000})
    with pytest.raises(ValueError, match='Both TLS_CERT_PATH and TLS_KEY_PATH'):
        launcher.main()
    socketio.run.assert_not_called()


# run_flask.ps1 writes .env values into the process environment verbatim, so a
# quoted, padded or capitalised production flag must not select plaintext.
@pytest.mark.parametrize('flag', ['NODE_ENV', 'FLASK_ENV'])
@pytest.mark.parametrize('spelling', ['Production', 'PRODUCTION', 'production ', '"production"', "'production'"])
def test_production_flag_recognised_regardless_of_case_padding_or_quotes(tmp_path, flag, spelling):
    result = None
    try:
        with pytest.raises(ValueError, match='Production requires'):
            result = create_runtime({flag: spelling, 'JWT_SECRET': SECRET},
                                    str(tmp_path / 'must-not-be-created.sqlite'))
    finally:
        if result is not None:
            result[-1]()
    assert not (tmp_path / 'must-not-be-created.sqlite').exists()


@pytest.mark.parametrize('spelling', ['Production', '"production"'])
def test_launcher_refuses_production_flag_variants_before_listening(monkeypatch, spelling):
    for name in ['NODE_ENV', 'FLASK_ENV', 'TLS_CERT_PATH', 'TLS_KEY_PATH']:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('JWT_SECRET', SECRET)
    monkeypatch.setenv('FLASK_ENV', spelling)
    socketio = Mock()
    factory = Mock(return_value=(Mock(), socketio, None, None, Mock()))
    monkeypatch.setattr(launcher, 'create_runtime', factory)
    monkeypatch.setattr(launcher, 'read_config', lambda: {'host': '127.0.0.1', 'port': 5000})
    with pytest.raises(ValueError, match='Production requires'):
        launcher.main()
    socketio.run.assert_not_called()
    factory.assert_not_called()


@pytest.mark.parametrize('spelling', ['development', 'test', '"development"'])
def test_non_production_spellings_still_allow_plaintext_development(tmp_path, spelling):
    result = create_runtime({'NODE_ENV': spelling, 'JWT_SECRET': SECRET}, str(tmp_path / 'dev.sqlite'))
    try:
        assert result[0] is not None
    finally:
        result[-1]()
