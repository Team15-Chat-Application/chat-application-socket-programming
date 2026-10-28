import os
import ssl
from .runtime import create_runtime
from .config import read_config

def main():
    config=read_config()
    app,socketio,_accounts,_history,_close=create_runtime()
    context=None
    if os.environ.get('TLS_CERT_PATH') and os.environ.get('TLS_KEY_PATH'):
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version=ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(os.environ['TLS_CERT_PATH'],os.environ['TLS_KEY_PATH'])
    kwargs={'ssl_context':context} if context is not None else {}
    print('Flask chat application is listening on the configured host and port',flush=True)
    socketio.run(app,host=config['host'],port=config['port'],allow_unsafe_werkzeug=True,**kwargs)

if __name__=='__main__':
    main()
