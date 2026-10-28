const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.js');
let cloud = {};
try { cloud = require('./cloud.js'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const record = (id, notes = '') => ({id, name:'测试权益', owner:'测试会员', expires:'', type:'', count:'', notes});
const snapshot = (records = [], revision = 1) => ({version:2, initialized:true, revision, records, updatedAt:'2026-10-28T00:00:00.000Z'});
function memory(values = {}) {
  const saved = new Map(Object.entries(values));
  return {getItem:key => saved.get(key) ?? null, setItem:(key,value) => saved.set(key,value), removeItem:key => saved.delete(key)};
}
function create(options) {
  assert.equal(typeof cloud.create, 'function', 'cloud transport must exist');
  return cloud.create({model:M, storage:memory(), uuid:() => 'test-request', ...options});
}
const response = (body, status = 200) => ({ok:status >= 200 && status < 300, status, json:async() => body});

test('cloud bootstrap preserves exact legacy bytes without posting defaults or cache', async() => {
  const legacy = '{"version":1,"records":[]}  \n', storage = memory({[M.KEY]:legacy}), calls = [];
  const client = create({storage, fetch:async(path, options) => { calls.push([path, options]); return response(snapshot([record('remote')], 4)); }});
  const result = await client.load();
  assert.equal(result.revision, 4);
  assert.equal(storage.getItem(M.KEY), legacy);
  assert.equal(storage.getItem(cloud.LEGACY_BACKUP_KEY), legacy);
  assert.deepEqual(calls.map(([path, options]) => [path, options.method]), [['/api/benefits','GET']]);
  assert.equal(JSON.parse(storage.getItem(cloud.CACHE_KEY)).records[0].id, 'remote');
});

test('uninitialized and deliberately empty cloud ledgers stay distinct', async() => {
  let state = {version:2, initialized:false, revision:0, records:[], updatedAt:null};
  const client = create({fetch:async() => response(state)});
  assert.equal((await client.load()).initialized, false);
  state = snapshot([], 3);
  assert.equal((await client.load()).initialized, true);
  assert.deepEqual((await client.load()).records, []);
});

test('revision conflicts preserve the exact submitted draft and never retry automatically', async() => {
  const storage = memory(), calls = [];
  const client = create({storage, fetch:async(path, options) => { calls.push([path, options]); return response({code:'REVISION_CONFLICT',error:'云端已有更新'},409); }});
  await assert.rejects(client.save([record('edited','草稿')], 7), error => error.status === 409 && error.code === 'REVISION_CONFLICT');
  const draft = client.draft();
  assert.equal(draft.baseRevision,7);
  assert.equal(draft.records[0].notes,'草稿');
  assert.equal(draft.requestId,'test-request');
  assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(calls[0][1].body),{version:2,baseRevision:7,records:[record('edited','草稿')],requestId:'test-request'});
  assert.equal(calls[0][1].credentials,'same-origin');
});

test('successful saves cache only acknowledged data and clear their draft', async() => {
  const storage = memory(), client = create({storage,fetch:async() => response(snapshot([record('a')],8))});
  const saved = await client.save([record('a')],7);
  assert.equal(saved.revision,8);
  assert.equal(client.draft(),null);
  assert.equal(JSON.parse(storage.getItem(cloud.CACHE_KEY)).revision,8);
});

test('unavailable storage prevents a cloud write before the request starts', async() => {
  let calls = 0;
  const storage = {...memory(),setItem(){throw Error('quota');}};
  const client = create({storage,fetch:async() => {calls++;return response(snapshot());}});
  await assert.rejects(client.save([record('a')],2),/草稿/);
  assert.equal(calls,0);
});

test('ambiguous network failures retain draft while later cloud reads do not erase it', async() => {
  let fail = true;
  const client = create({fetch:async() => {if(fail)throw Error('offline');return response(snapshot([record('remote')],5));}});
  await assert.rejects(client.save([record('local')],3),/网络/);
  fail = false;
  await client.load();
  assert.equal(client.draft().baseRevision,3);
  assert.equal(client.draft().records[0].id,'local');
});

test('session and login use the declared API without storing a password', async() => {
  const storage = memory(), calls = [];
  const client = create({storage,fetch:async(path,options) => {calls.push([path,options]);return response(path === '/api/session' ? {mode:'cloud',authenticated:false} : {authenticated:true});}});
  assert.deepEqual(await client.session(),{mode:'cloud',authenticated:false});
  await client.login('private-test-password');
  assert.equal(calls[1][0],'/api/login');
  assert.equal(calls[1][1].method,'POST');
  assert.deepEqual(JSON.parse(calls[1][1].body),{password:'private-test-password'});
  assert.equal(storage.getItem(cloud.CACHE_KEY),null);
  assert.equal(storage.getItem(cloud.DRAFT_KEY),null);
});

test('malformed cloud responses never replace an acknowledged cache', async() => {
  const existing = JSON.stringify(snapshot([record('cached')],2)), storage = memory({[cloud.CACHE_KEY]:existing});
  const client = create({storage,fetch:async() => response({...snapshot(),records:[record('a'),record('a')]})});
  await assert.rejects(client.load(),/重复/);
  assert.equal(storage.getItem(cloud.CACHE_KEY),existing);
});

test('a delayed pre-save read cannot roll acknowledged data back', async() => {
  let release, reads = 0;
  const storage = memory(), client = create({storage,fetch:async(path,options) => options.method === 'POST' ? response(snapshot([record('saved')],4)) : ++reads === 1 ? new Promise(resolve => {release=resolve;}) : response(snapshot([],3))});
  const older = client.load();
  await client.save([record('saved')],3);
  release(response(snapshot([record('old')],3)));
  const result = await older;
  assert.equal(result.revision,4);
  assert.equal(JSON.parse(storage.getItem(cloud.CACHE_KEY)).revision,4);
});

test('another failed draft cannot be silently replaced by an unrelated save', async() => {
  let calls = 0;
  const client = create({fetch:async() => {calls++;throw Error('offline');}});
  await assert.rejects(client.save([record('first')],3));
  await assert.rejects(client.save([record('second')],4),/草稿.*导出/);
  assert.equal(client.draft().records[0].id,'first');
  assert.equal(calls,1);
  client.discardDraft();
  await assert.rejects(client.save([record('second')],4));
  assert.equal(client.draft().records[0].id,'second');
});
