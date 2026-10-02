import pytest
from chat_backend.config import read_config


def test_configuration_defaults_to_loopback():
    assert read_config({}) == {'host': '127.0.0.1', 'port': 5000}


@pytest.mark.parametrize('port', ['1', '65535'])
def test_valid_port_boundaries(port):
    assert read_config({'FLASK_PORT': port})['port'] == int(port)


@pytest.mark.parametrize('port', ['0', '65536', '-1', '5000abc', '', '3.5', '\u0665'])
def test_invalid_port_is_rejected(port):
    with pytest.raises(ValueError, match='FLASK_PORT'):
        read_config({'FLASK_PORT': port})


def test_empty_host_is_rejected():
    with pytest.raises(ValueError, match='FLASK_HOST'):
        read_config({'FLASK_HOST': ' '})
