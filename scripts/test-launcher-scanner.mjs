// Run after pnpm build. --serve keeps synthetic fixtures on 3900/3901 for browser checks.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
let enabled = true;
const personalRequests = [];
const serve = process.argv.includes('--serve');
const upstream = http.createServer((req, res) => {
  const cookie = req.headers.cookie;
  let body = { features: [], species: [] }, status = 200;
  if (req.url.startsWith('/api/map/v1/access')) {
    status = ['t', 'u'].some(c => cookie === '__Host-kanto_session=' + c.repeat(64)) && enabled ? 200 : cookie === '__Host-kanto_session=' + 'p'.repeat(64) ? 402 : 401;
    body = { subject:'scanner-fixture', paid:true, unlimited:true, state:{ tier:'pikachu', scanner_radius_meters:500, scanner_cooldown_seconds:15 } };
  } else if (req.url.startsWith('/api/map/v1/species')) body = [];
  else if (/^\/api\/map\/v1\/(features|lure-spawns)/.test(req.url)) {
    personalRequests.push({ url: req.url, cookie });
    const feature = { id:'spawn-1', kind:'pokemon', latitude:52.5, longitude:-0.7, pokemon_id:25, shiny:cookie === '__Host-kanto_session='+'t'.repeat(64), expires_at:new Date(Date.now()+60000).toISOString() };
    body = {features:[feature],feature,updated_at:new Date().toISOString(),truncated:false};
  }
  res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body));
});
await new Promise(resolve => upstream.listen(serve ? 3901 : 0, '127.0.0.1', resolve));
const port = serve ? 3900 : 40000 + Math.floor(Math.random() * 10000);
const app = spawn(process.execPath, ['build/index.js'], {
  env:{...process.env, HOST:'127.0.0.1', PORT:String(port), KANTO_MAP_API_URL:`http://127.0.0.1:${upstream.address().port}/`, KANTO_LAUNCHER_SCANNER_KEY:randomBytes(32).toString('hex')},
  stdio:['ignore','ignore','ignore']
});
const cleanup = () => {app.kill();upstream.close();};
process.on('SIGINT',()=>{cleanup();process.exit();});
process.on('SIGTERM',()=>{cleanup();process.exit();});
const request = (path, options) => fetch(`http://127.0.0.1:${port}/map/${path}`,options);
try {
  let ready = false;
  for(let i=0;i<100;i++) {
    try {await request('api/scanner');ready=true;break;} catch {await new Promise(r=>setTimeout(r,100));}
  }
  assert(ready,'Scanner server failed to start');
  assert.equal((await request('api/scanner')).status,401);
  assert.equal((await request('api/scanner?launcher=1')).status,401);
  assert.equal((await request('api/launcher-session',{method:'POST'})).status,401);
  assert.equal((await request('api/launcher-session',{method:'POST',headers:{Authorization:'Bearer '+'p'.repeat(64)}})).status,402);
  const response = await request('api/launcher-session',{method:'POST',headers:{Authorization:'Bearer '+'t'.repeat(64)}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const grant = await response.json();assert(!grant.token.includes('t'.repeat(64)));
  const options={headers:{'x-kanto-scanner':grant.token}};
  assert.equal((await request('api/scanner',options)).status,200);
  // Launcher credentials take precedence over an unrelated browser account cookie.
  for (const [headers, account] of [
    [{'x-kanto-scanner':grant.token, cookie:'__Host-kanto_session='+'u'.repeat(64)}, 't'],
    [{cookie:'__Host-kanto_session='+'u'.repeat(64)}, 'u']
  ]) {
    personalRequests.length = 0;
    const detail = await request('api/pokemon/spawn-1', {headers});
    assert.equal(detail.status,200);
    assert.equal((await detail.json()).shiny, account === 't');
    assert.equal(detail.headers.get('cache-control'),'private, no-store');
    const list = await request('api/pokemon', {method:'POST', headers:{...headers,'content-type':'application/json'},body:JSON.stringify({minLat:52.49,minLon:-0.71,maxLat:52.51,maxLon:-0.69})});
    assert.equal(list.status,200);
    assert.equal(list.headers.get('cache-control'),'private, no-store');
    assert.equal(personalRequests.length,3,'detail, wild and lure queries');
    for (const call of personalRequests) {
      assert.equal(call.cookie,'__Host-kanto_session='+account.repeat(64));
      assert.equal(new URL(call.url,'http://fixture').searchParams.get('personal'),'1');
    }
  }
  enabled=false;assert.equal((await request('api/scanner',options)).status,401);enabled=true;
  assert.equal((await request('api/scanner',{headers:{'x-kanto-scanner':'t'.repeat(64)}})).status,401);
  const shell=await request('?launcher=1');assert.equal(shell.status,200);
  assert(shell.headers.get('content-security-policy').includes('frame-ancestors tauri://localhost'));
  console.log('PASS: anonymous/unentitled denial, opaque scoped exchange, API access, revocation, framed shell isolation and account-private shiny wild/lure/detail results');
  if(serve) console.log('Synthetic browser fixture: http://127.0.0.1:3900/map/');
} catch(error) {cleanup();throw error;}
if(!serve)cleanup();
