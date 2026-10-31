import os
from pathlib import Path
from flask import request
from .accounts import Accounts
from .history import HistoryStore
from .rooms import RoomStore
from .messages import MessageService
from .app import create_application, failure
from .tls_config import read_tls_config


def create_runtime(env=None, filename=None):
    env=os.environ if env is None else env
    cert_path,_key_path=read_tls_config(env)
    secret=env.get('JWT_SECRET')
    root=Path(__file__).resolve().parents[2]
    filename=filename or env.get('FLASK_DB_PATH') or env.get('CHAT_DB_PATH') or str(root/'data'/'flask.sqlite')
    accounts=Accounts(filename,secret) if isinstance(secret,str) and len(secret.encode())>=32 else None
    history=HistoryStore(filename)
    if accounts is not None:history.username_for=accounts.username
    rooms=RoomStore(repository=history)
    messages=MessageService(rooms,history=history)

    def account_route(operation):
        def handler():
            try:
                if accounts is None:return failure('AUTH_NOT_IMPLEMENTED','Set JWT_SECRET to enable authentication'),503
                if operation=='logout':
                    header=request.headers.get('Authorization','')
                    if not header.startswith('Bearer '):return failure('UNAUTHORIZED','Authentication required'),401
                    token=header[7:];identity=accounts.auth().authenticate({'token':token});accounts.logout(token)
                    # Disconnect live sockets for this revoked session immediately.
                    for sid,context in list(app.extensions['chat_identities'].items()):
                        if context['identity']['sessionId']==identity['sessionId']:socketio.server.disconnect(sid,namespace='/')
                    return '',204
                data=request.get_json(silent=True)
                if not isinstance(data,dict):return failure('VALIDATION_ERROR','Credentials must be a JSON object'),400
                result=getattr(accounts,operation)(data)
                return ({'ok':True,'data':{'user':result},'user':result},201) if operation=='register' else ({'ok':True,'data':result,**result},200)
            except Exception as error:
                code=getattr(error,'code','INTERNAL_ERROR')
                return failure(code,str(error) if code!='INTERNAL_ERROR' else 'An internal error occurred'),{'CONFLICT':409,'UNAUTHORIZED':401,'ACCOUNT_LOCKED':423,'VALIDATION_ERROR':400}.get(code,500)
        return handler

    candidates=[root/'public'/'vendor',root/'dist'/'public'/'vendor',root/'node_modules'/'socket.io'/'client-dist']
    vendor=next((p for p in candidates if (p/'socket.io.min.js').is_file()),candidates[-1])
    app,socketio=create_application(auth=accounts.auth() if accounts is not None else None,rooms=rooms,messages=messages,
        login_handler=account_route('login'),register_handler=account_route('register'),logout_handler=account_route('logout'),
        asset_root=root/'public',vendor_root=vendor,secure_transport=bool(cert_path))

    def close():
        history.close()
        if accounts is not None:accounts.close()
    return app,socketio,accounts,history,close
