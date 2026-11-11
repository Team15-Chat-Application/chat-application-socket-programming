"""Equivalent account/session adapter; prepared for the auth owner's handoff."""
import sqlite3
import time
from pathlib import Path
from threading import RLock
from uuid import uuid4
import jwt
from .input import sanitize_username
from .passwords import hash_password, verify_password
from .jwt_auth import JwtAuth, ISSUER, AUDIENCE


class AccountError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


class Accounts:
    def __init__(self, filename, secret, clock=time.time):
        if not isinstance(secret,str) or len(secret.encode()) < 32:
            raise ValueError('JWT secret must contain at least 32 UTF-8 bytes')
        if filename != ':memory:':Path(filename).parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(filename,check_same_thread=False)
        self.db.row_factory=sqlite3.Row
        self.lock=RLock()
        self.secret,self.clock=secret,clock
        self.db.executescript('''PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until INTEGER);
          CREATE TABLE IF NOT EXISTS sessions(session_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,
            expires_at INTEGER NOT NULL,revoked_at INTEGER DEFAULT NULL,FOREIGN KEY(user_id) REFERENCES users(user_id));''')

    def public(self,row):
        return {'userId':row['user_id'],'username':row['username'],'role':row['role']}

    def register(self, credentials):
        if not isinstance(credentials,dict):raise AccountError('VALIDATION_ERROR','Credentials must be an object')
        username=sanitize_username(credentials.get('username'))
        hashed=hash_password(credentials.get('password'))
        user={'userId':str(uuid4()),'username':username,'role':'user'}
        try:
            with self.lock,self.db:
                self.db.execute('INSERT INTO users(user_id,username,password_hash) VALUES (?,?,?)',(user['userId'],username,hashed))
        except sqlite3.IntegrityError:
            raise AccountError('CONFLICT','Username is already taken') from None
        return user

    def login(self, credentials):
        if not isinstance(credentials,dict):raise AccountError('UNAUTHORIZED','Invalid username or password')
        try:username=sanitize_username(credentials.get('username'))
        except Exception:raise AccountError('UNAUTHORIZED','Invalid username or password') from None
        # Serialize account updates so concurrent failures cannot lose increments.
        with self.lock,self.db:
            row=self.db.execute('SELECT * FROM users WHERE username=?',(username,)).fetchone()
            if row is None:raise AccountError('UNAUTHORIZED','Invalid username or password')
            now=int(self.clock())
            if row['locked_until'] is not None and row['locked_until'] > now:
                raise AccountError('ACCOUNT_LOCKED','Account is temporarily locked')
            try:valid=verify_password(credentials.get('password'),row['password_hash'])
            except Exception:valid=False
            if not valid:
                attempts=(0 if row['locked_until'] is not None and row['locked_until'] <= now else row['failed_attempts'])+1
                until=now+900 if attempts>=5 else None
                self.db.execute('UPDATE users SET failed_attempts=?,locked_until=? WHERE user_id=?',(attempts,until,row['user_id']))
                self.db.commit()  # Failed attempts must persist despite the following rejection.
                raise AccountError('ACCOUNT_LOCKED' if until else 'UNAUTHORIZED','Account is temporarily locked' if until else 'Invalid username or password')
            self.db.execute('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE user_id=?',(row['user_id'],))
            sid=str(uuid4());expires=now+3600
            self.db.execute('INSERT INTO sessions(session_id,user_id,expires_at) VALUES (?,?,?)',(sid,row['user_id'],expires))
            token=jwt.encode({'sub':row['user_id'],'jti':sid,'iat':now,'exp':expires,'iss':ISSUER,'aud':AUDIENCE},self.secret,algorithm='HS256')
            return {'token':token,'expiresAt':expires,'user':self.public(row)}

    def session(self,sid):
        with self.lock:
            row=self.db.execute('SELECT session_id AS sessionId,user_id AS userId,expires_at AS expiresAt,revoked_at AS revokedAt FROM sessions WHERE session_id=?',(sid,)).fetchone()
            return dict(row) if row else None

    def username(self,uid):
        with self.lock:
            row=self.db.execute('SELECT username FROM users WHERE user_id=?',(uid,)).fetchone()
            return row[0] if row else uid[:8]

    def auth(self):return JwtAuth(secret=self.secret,find_session=self.session)

    def logout(self,token):
        identity=self.auth().authenticate({'token':token})
        with self.lock,self.db:
            self.db.execute('UPDATE sessions SET revoked_at=? WHERE session_id=?',(int(self.clock()),identity['sessionId']))

    def close(self):self.db.close()
