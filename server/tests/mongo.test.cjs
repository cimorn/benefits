const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {MongoClient} = require('mongodb');
const {createBenefitsStore} = require('../store.cjs');
const {record, write} = require('./helpers.cjs');
const uri = process.env.BENEFITS_TEST_MONGODB_URI;

test('real MongoDB persists state across service recreation and atomically accepts one competing save', {skip: !uri, timeout: 20000}, async t => {
  // This opt-in test must never point at a production database. Only the unique
  // collection created here is removed, including on an assertion failure.
  const databaseName = new URL(uri).pathname.slice(1);
  assert.match(databaseName, /_test$/i, 'BENEFITS_TEST_MONGODB_URI must name an isolated _test database');
  const client = new MongoClient(uri, {serverSelectionTimeoutMS: 5000, retryWrites: false});
  await client.connect();
  const collection = client.db(databaseName).collection(`state_${randomUUID().replaceAll('-', '')}`);
  t.after(async () => { try { await collection.drop(); } finally { await client.close(); } });
  const service = await createBenefitsStore(collection);
  assert.equal((await service.read()).initialized, false);
  const requests = Array.from({length: 8}, (_, index) => write(0, [record(`record-${index}`)], `request-${index}`));
  const results = await Promise.allSettled(requests.map(request => service.save(request)));
  const winners = results.flatMap((result, index) => result.status === 'fulfilled' ? [index] : []);
  assert.equal(winners.length, 1);
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.code, 'REVISION_CONFLICT');
  const first = results[winners[0]].value;
  const restarted = await createBenefitsStore(collection);
  assert.deepEqual(await restarted.read(), first);
  assert.deepEqual(await restarted.save(requests[winners[0]]), first);
  const next = await restarted.save(write(1, [], 'delete-all'));
  assert.equal(next.revision, 2);
  assert.equal(next.initialized, true);
  assert.deepEqual((await restarted.read()).records, []);
});
