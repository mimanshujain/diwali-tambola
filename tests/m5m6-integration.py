#!/usr/bin/env python3
"""M5/M6 isolated HTTP acceptance tests, no nonstandard Python packages.
Creates disposable game/player records; does not delete or mutate existing games.
Usage: python3 tests/m5m6-integration.py
"""
import json
import os
from pathlib import Path
from urllib import error, request
from uuid import uuid4

BASE = os.environ.get('TAMBOLA_URL', 'http://127.0.0.1:3000').rstrip('/')

def load_admin():
    candidate = os.environ.get('ADMIN_TOKEN')
    if candidate:
        return candidate
    env = Path(__file__).resolve().parents[1] / '.env'
    if not env.exists():
        raise RuntimeError('No ADMIN_TOKEN environment variable or project .env file')
    for raw in env.read_text().splitlines():
        if raw.startswith('ADMIN_TOKEN='):
            return raw.split('=', 1)[1].strip().strip('"\'')
    raise RuntimeError('ADMIN_TOKEN missing; do not paste its value in chat')

KEY = load_admin()

def http(method, path, payload=None, headers=None, expect=None):
    h = {'Accept': 'application/json', **(headers or {})}
    data = None
    if payload is not None:
        h['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode()
    req = request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with request.urlopen(req, timeout=15) as response:
            status = response.status
            raw = response.read().decode('utf-8')
            content_type = response.headers.get('Content-Type', '')
    except error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode('utf-8')
        content_type = exc.headers.get('Content-Type', '')
    # Expected failures match exact HTTP status; success accepts 2xx (Nest POST = 201).
    if expect is None:
        assert 200 <= status < 300, f'{method} {path}: unexpected HTTP {status}: {raw[:250]}'
    else:
        assert status == expect, f'{method} {path}: expected {expect}, received {status}: {raw[:250]}'
    if 'json' in content_type:
        return json.loads(raw)
    return raw


def admin():
    return {'x-admin-key': KEY}


def bearer(token):
    return {'Authorization': 'Bearer ' + token}

print('[1] Health and admin authorization')
assert http('GET','/health/ready')['dependencies']['database'] == 'connected'
http('POST','/games',{'name':'Unauthorized'},expect=401)
game = http('POST','/games',{'name':'M5 M6 isolated acceptance','intervalSeconds':3600},admin())
gid = game['id']
print('  Created isolated test game:', gid)

print('[2] TV / admin / guest pages and locally generated QR')
for route, marker in [(f'/tv/{gid}','Numbers called'),(f'/admin/{gid}','Lucky Strike requests'),(f'/join/{gid}','Get my ticket'),('/admin','New game')]:
    assert marker in http('GET',route), f'Expected screen missing: {route}'
# The public display and QR must both work on a brand-new game before any
# game-control transaction has run; this catches missing startup migrations.
assert http('GET',f'/games/{gid}/display')['calls'] == []
assert '<svg' in http('GET',f'/tv/{gid}/qr.svg')

print('[3] Register and submit two unique tickets')
players = []
for index in range(2):
    p = http('POST',f'/games/{gid}/players/register',{
        'name':f'M5 Test Player {index+1}',
        'mobile':'1555010' + str(1000 + index),
        'deviceId':str(uuid4()),
    })
    token = p['token']; players.append((p['player']['id'],token))
    http('POST',f'/games/{gid}/players/me/submit',headers=bearer(token))
assert len(http('GET',f'/games/{gid}/display')['players']) == 2
first = players[0][1]
http('POST',f'/games/{gid}/players/me/power/request',{'number':47},bearer(first),expect=409)

print('[4] Start and request Lucky Strike')
http('POST',f'/games/{gid}/start',headers=admin())
r = http('POST',f'/games/{gid}/players/me/power/request',{'number':47},bearer(first))
assert r['status'] == 'PENDING'
http('POST',f'/games/{gid}/players/me/power/request',{'number':48},bearer(first),expect=409)
assert len([x for x in http('GET',f'/games/{gid}/admin/power-requests',headers=admin()) if x['status']=='PENDING']) == 1

print('[5] Approve, verify exactly one draw, and block replay')
http('POST',f'/games/{gid}/admin/power-requests/{r["id"]}/approve',headers={'x-admin-key':'wrong'},expect=401)
approved = http('POST',f'/games/{gid}/admin/power-requests/{r["id"]}/approve',headers=admin())
assert approved['status'] == 'APPROVED' and approved['number'] == 47
calls = http('GET',f'/games/{gid}/calls')
assert len(calls)==1 and calls[0]['number']==47 and calls[0]['source']=='SUPERPOWER'
assert http('GET',f'/games/{gid}/players/me/power',headers=bearer(first))['status']=='USED'
http('POST',f'/games/{gid}/admin/power-requests/{r["id"]}/approve',headers=admin(),expect=409)
http('POST',f'/games/{gid}/players/me/power/request',{'number':49},bearer(first),expect=409)
http('POST',f'/games/{gid}/calls/manual',{'number':47},admin(),expect=409)
assert http('GET',f'/games/{gid}/display')['powerCalls'][0]['number']==47

print('[6] Rejected request leaves second player token available')
second = players[1][1]
r2 = http('POST',f'/games/{gid}/players/me/power/request',{'number':49},bearer(second))
http('POST',f'/games/{gid}/admin/power-requests/{r2["id"]}/reject',headers=admin())
assert http('GET',f'/games/{gid}/players/me/power',headers=bearer(second))['status']=='AVAILABLE'
http('POST',f'/games/{gid}/players/me/power/request',{'number':50},bearer(second))

print('[7] Admin ticket retrieval and game controls')
ticket = http('GET',f'/games/{gid}/admin/players/{players[0][0]}/ticket',headers=admin())
assert len(ticket['grid'])==3 and all(len(row)==9 for row in ticket['grid'])
http('GET',f'/games/{gid}/admin/players/{players[0][0]}/ticket',expect=401)
http('POST',f'/games/{gid}/pause',headers=admin())
assert http('GET',f'/games/{gid}')['status']=='PAUSED'
http('POST',f'/games/{gid}/resume',headers=admin())
assert http('GET',f'/games/{gid}')['status']=='RUNNING'

print('PASS: M5 superpower, M6 endpoints, authentication, and recovery controls')
print('Test game ID:', gid)

# Optional slower acceptance scenario: M5 power completion and 30-second priority.
# Run separately: python3 tests/m5m6-integration.py --priority
if '--priority' in __import__('sys').argv:
    import time
    print('[priority 1] Create a fresh isolated category-priority game')
    g = http('POST','/games',{'name':'M5 priority acceptance','intervalSeconds':3600},admin())['id']
    identities=[]
    for i in range(2):
        p=http('POST',f'/games/{g}/players/register',{
            'name':'Power Priority ' + ('A' if i==0 else 'B'),
            'mobile':'1555020'+str(1000+i), 'deviceId':str(uuid4())})
        identities.append(p)
    a,b=identities
    token_b=b['token']
    numbers_a=set(a['ticket']['numbers'])
    numbers_b=set(b['ticket']['numbers'])
    for _ in range(25):
        if numbers_a & numbers_b:
            break
        regenerated=http('POST',f'/games/{g}/players/me/regenerate',headers=bearer(token_b))
        numbers_b=set(regenerated['ticket']['numbers'])
    common=sorted(numbers_a & numbers_b)
    assert common, 'Unable to construct tickets with shared number'
    chosen=common[0]
    for p in (a,b):
        http('POST',f'/games/{g}/players/me/submit',headers=bearer(p['token']))
    categories=http('GET',f'/games/{g}/categories')
    house=next(c for c in categories if c['rule_type']=='FULL_HOUSE')
    http('POST',f'/games/{g}/start',headers=admin())
    print('[priority 2] Call A+B numbers except shared final number')
    for n in sorted((numbers_a | numbers_b)-{chosen}):
        http('POST',f'/games/{g}/calls/manual',{'number':n},admin())
    power=http('POST',f'/games/{g}/players/me/power/request',{'number':chosen},bearer(a['token']))
    http('POST',f'/games/{g}/admin/power-requests/{power["id"]}/approve',headers=admin())
    http('POST',f'/games/{g}/players/me/claims',{'categoryId':house['id']},bearer(b['token']))
    http('POST',f'/games/{g}/pause',headers=admin())
    http('POST',f'/games/{g}/admin/categories/{house["id"]}/resolve',headers=admin(),expect=409)
    print('[priority 3] The 30-second window blocks early resolution: PASS')
    time.sleep(31)
    result=http('POST',f'/games/{g}/admin/categories/{house["id"]}/resolve',headers=admin())
    winner_ids={x['playerId'] for x in result['winners']}
    assert winner_ids == {b['player']['id']}, f'Expected B alone due to priority, got {winner_ids}'
    print('PASS: Lucky Strike gives the eligible other claimant first prize priority')
    print('Priority game ID:',g)
