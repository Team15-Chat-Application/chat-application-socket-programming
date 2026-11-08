import os
import ssl
from .runtime import create_runtime
from .config import read_config
from .tls_config import read_tls_config

def main():
    config=read_config()
    cert_path,key_path=read_tls_config(os.environ)
    context=None
    if cert_path is not None:
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version=ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(cert_path,key_path)
    app,socketio,_accounts,_history,close=create_runtime()
    kwargs={'ssl_context':context} if context is not None else {}
    print('Flask chat application is listening on the configured host and port',flush=True)
    try:
        socketio.run(app,host=config['host'],port=config['port'],allow_unsafe_werkzeug=True,**kwargs)
    finally:
        close()

if __name__=='__main__':
    main()
