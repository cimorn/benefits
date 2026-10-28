const test = require('node:test');
const assert = require('node:assert/strict');
const {MemoryCollection, record, write, exported} = require('./helpers.cjs');
let moduleUnderTest = {};
try { moduleUnderTest = require('../store.cjs'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const store = async () => exported(moduleUnderTest, 'createBenefitsStore')(new MemoryCollection());

test('new database is explicitly uninitialized; an intentionally empty first save stays initialized', async () => {
  const service = await store();
  assert.deepEqual(await service.read(), {version: 2, initialized: false, revision: 0, records: [], updatedAt: null});
  const saved = await service.save(write(0, []));
  assert.equal(saved.initialized, true);
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.records, []);
  assert.deepEqual(await service.read(), saved);
});

test('two saves with the same base revision cannot silently overwrite each other', async () => {
  const service = await store();
  const results = await Promise.allSettled([
    service.save(write(0, [record('a')], 'request-a')),
    service.save(write(0, [record('b')], 'request-b'))
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected').reason;
  assert.equal(failure.status, 409);
  assert.equal(failure.code, 'REVISION_CONFLICT');
  assert.equal((await service.read()).revision, 1);
});

test('repeated latest request acknowledges the same revision, including a recreated service', async () => {
  const collection = new MemoryCollection();
  const service = await exported(moduleUnderTest, 'createBenefitsStore')(collection);
  const request = write();
  const saved = await service.save(request);
  assert.deepEqual(await service.save(request), saved);
  const restarted = await exported(moduleUnderTest, 'createBenefitsStore')(collection);
  assert.deepEqual(await restarted.save(request), saved);
  assert.equal((await restarted.read()).revision, 1);
});

test('same request ID with altered records is rejected, and retrying an older write after advancement conflicts', async () => {
  const service = await store();
  await service.save(write());
  await assert.rejects(service.save(write(0, [record('two')], 'request-1')), error => error.status === 409 && error.code === 'REQUEST_ID_REUSED');
  await service.save(write(1, [record('two')], 'request-2'));
  await assert.rejects(service.save(write()), error => error.status === 409 && error.code === 'REVISION_CONFLICT');
  assert.deepEqual((await service.read()).records, [record('two')]);
});

test('server validates schema, dates, duplicate IDs, version, revision, and request identifier before saving', async () => {
  const service = await store();
  const invalid = [
    {...write(), version: 1}, {...write(), baseRevision: -1}, {...write(), baseRevision: 0.5},
    {...write(), requestId: ''}, {...write(), records: [record(), record()]},
    {...write(), records: [{...record(), name: ''}]},
    {...write(), records: [{...record(), expires: '2026-02-30'}]},
    {...write(), records: [{...record(), count: 2}]},
    {...write(), records: [null]}
  ];
  for (const request of invalid) await assert.rejects(service.save(request), error => error.status === 400);
  assert.equal((await service.read()).revision, 0);
});

test('normalization uses existing v2 model and removes unexpected record fields', async () => {
  const service = await store();
  const saved = await service.save(write(0, [{...record(), name: '  会员权益  ', extra: 'discard'}]));
  assert.deepEqual(saved.records, [record()]);
});
