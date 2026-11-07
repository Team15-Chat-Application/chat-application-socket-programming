"""Fresh local-test certificate using installed OpenSSL; never a production CA identity."""
from pathlib import Path
import shutil,subprocess,sys
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'reports/test-tls')
folder.mkdir(parents=True,exist_ok=True)
binary=shutil.which('openssl')
if binary is None:
    git_path=Path(subprocess.check_output(['git','--exec-path'],text=True).strip())
    candidate=git_path.parents[2]/'usr'/'bin'/'openssl.exe'
    if candidate.is_file():binary=str(candidate)
if binary is None:raise SystemExit('Install OpenSSL or use the OpenSSL supplied by Git for Windows.')
subprocess.run([binary,'req','-x509','-newkey','rsa:2048','-nodes','-days','2',
    '-keyout',str(folder/'key.pem'),'-out',str(folder/'cert.pem'),'-subj','/CN=localhost',
    '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],check=True,capture_output=True)
print('Local test certificate/key generated. Not a production certificate.')
