import time
import pytest
from chat_backend.accounts import Accounts, AccountError

@pytest.fixture
def accounts():
    db=Accounts(':memory:','test-only-account-secret-with-more-than-32-bytes')
    yield db
    db.close()

def test_real_account_issuer_and_persistent_logout(accounts):
    user=accounts.register({'username':'Alice','password':'test-password'})
    with pytest.raises(AccountError):accounts.register({'username':'alice','password':'other'})
    result=accounts.login({'username':'ALICE','password':'test-password'})
    identity=accounts.auth().authenticate({'token':result['token']})
    assert identity['userId']==user['userId']
    accounts.logout(result['token'])
    with pytest.raises(Exception):accounts.auth().authenticate({'token':result['token']})
    row=accounts.db.execute('SELECT password_hash FROM users').fetchone()[0]
    assert row.startswith('$2b$12$') and 'test-password' not in row

def test_five_failures_and_exact_fifteen_minute_boundary(accounts):
    accounts.register({'username':'Alice','password':'test-password'})
    now=[int(time.time())];accounts.clock=lambda:now[0]
    for i in range(5):
        with pytest.raises(AccountError) as error:accounts.login({'username':'Alice','password':'wrong'})
        assert error.value.code==('ACCOUNT_LOCKED' if i==4 else 'UNAUTHORIZED')
    now[0]+=899
    with pytest.raises(AccountError):accounts.login({'username':'Alice','password':'test-password'})
    now[0]+=1
    assert accounts.login({'username':'Alice','password':'test-password'})['token']

@pytest.mark.parametrize('credentials',[None,[],{}, {'username':'bad<script>','password':'secret'}, {'username':'Alice','password':''}])
def test_invalid_registration_fails_safely(accounts,credentials):
    with pytest.raises(Exception):accounts.register(credentials)
    assert accounts.db.execute('SELECT count(*) FROM users').fetchone()[0]==0
