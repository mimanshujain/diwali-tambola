#!/usr/bin/env python3
"""M7 isolated 30-player rehearsal. No game or application data is deleted."""
import os,sys,json,urllib.request,urllib.error,uuid,time
BASE=os.environ.get('TAMBOLA_URL','http://127.0.0.1:3000').rstrip('/')
KEY=os.environ.get('ADMIN_TOKEN')
if not KEY:
    from pathlib import Path
    env=Path('.env')
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith('ADMIN_TOKEN='): KEY=line.split('=',1)[1].strip().strip('"\'')
assert KEY, 'ADMIN_TOKEN missing: use env or project-root .env; never print the token'
def call(method,path,body=None,headers=None,expect=None):
    h={'Content-Type':'application/json',**(headers or {})}
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method)
    try:
        with urllib.request.urlopen(req,timeout=20) as r: code=r.status;raw=r.read().decode()
    except urllib.error.HTTPError as e:code=e.code;raw=e.read().decode()
    if expect is None: assert 200<=code<300, f'{method} {path}: {code} {raw[:250]}'
    else: assert code==expect, f'{method} {path}: {code}, expected {expect}'
    try:return json.loads(raw)
    except:return raw
admin={'x-admin-key':KEY}
print('[1/5] Health, security headers and browser party asset',flush=True)
call('GET','/health/ready')
with urllib.request.urlopen(BASE+'/party/client.js',timeout=10) as r:
    assert r.status==200 and b'partyPop' in r.read()
    assert r.headers['X-Content-Type-Options']=='nosniff'
    assert r.headers['X-Frame-Options']=='DENY'
call('POST','/games',{'name':'unauthorized'},expect=401)
print('[2/5] Create one isolated 30-player test game',flush=True)
gid=call('POST','/games',{'name':'M7 Rehearsal '+str(uuid.uuid4())[:8],'intervalSeconds':3600},admin)['id']
players=[]
for i in range(30):
    p=call('POST',f'/games/{gid}/players/register',{'name':f'Rehearsal {i+1:02d}','deviceId':str(uuid.uuid4())})
    players.append(p)
    call('POST',f"/games/{gid}/admin/players/{p['player']['id']}/approve",headers=admin)
    call('POST',f'/games/{gid}/players/me/submit',headers={'Authorization':'Bearer '+p['token']})
    if (i+1)%10==0:print(f' Registered {i+1}/30',flush=True)
view=call('GET',f'/games/{gid}/display')
assert len(view['players'])==30 and all(p['submitted'] for p in view['players']), '30 submitted tickets required'
print('[3/5] Verify protected printing, 30 tickets and TV join QR',flush=True)
call('GET',f'/games/{gid}/admin/players',expect=401)
for p in players:
    ticket=call('GET',f"/games/{gid}/admin/players/{p['player']['id']}/ticket",headers=admin)
    assert len(ticket['grid'])==3 and all(len(row)==9 for row in ticket['grid'])
assert '<svg' in call('GET',f'/tv/{gid}/qr.svg')
print('[4/5] Start game and call five unique numbers',flush=True)
call('POST',f'/games/{gid}/start',headers=admin)
for n in [4,19,27,56,83]:call('POST',f'/games/{gid}/calls/manual',{'number':n},admin)
before=call('GET',f'/games/{gid}/display')
assert [x['number'] for x in before['calls']]==[4,19,27,56,83]
call('POST',f'/games/{gid}/pause',headers=admin)
print('[5/5] Verify durable state (before optional API restart)',flush=True)
after=call('GET',f'/games/{gid}/display')
assert len(after['players'])==30 and [x['number'] for x in after['calls']]==[4,19,27,56,83]
print('PASS — 30 players, ticket access, public UI, admin authorization, five calls',flush=True)
print('M7_REHEARSAL_GAME_ID='+gid,flush=True)
