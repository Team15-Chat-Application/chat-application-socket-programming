"""Collect real health observations; never extrapolate a short sample to a month."""
import argparse,json,time
from pathlib import Path
from datetime import datetime,timezone
from urllib.request import urlopen

p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:3000/api/health');p.add_argument('--seconds',type=int,default=60);p.add_argument('--interval',type=int,default=5);p.add_argument('--output',default='reports/uptime-samples.jsonl');args=p.parse_args()
if args.seconds<1 or args.interval<1:p.error('Durations must be positive')
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
deadline=time.monotonic()+args.seconds;ok=total=0;start=datetime.now(timezone.utc).isoformat()
while time.monotonic()<deadline:
    healthy=False
    try:
        with urlopen(args.url,timeout=min(5,args.interval)) as response:
            healthy=response.status==200 and json.load(response).get('ok') is True
    except Exception:pass
    sample={'observedAt':datetime.now(timezone.utc).isoformat(),'healthy':healthy}
    with out.open('a',encoding='utf-8') as handle:handle.write(json.dumps(sample)+'\n')
    total+=1;ok+=int(healthy);print(json.dumps(sample),flush=True)
    remaining=deadline-time.monotonic()
    if remaining>0:time.sleep(min(args.interval,remaining))
report={'startedAt':start,'endedAt':datetime.now(timezone.utc).isoformat(),'samples':total,'healthy':ok,
    'observedSamplePercent':100*ok/total,'monthlyAcceptance':'NOT_ESTABLISHED','note':'Short real observations do not prove monthly 99.5% availability; retain a full operational calendar-month record and maintenance exclusions.'}
out.with_suffix('.summary.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
