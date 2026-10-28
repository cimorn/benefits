const {createHash} = require('node:crypto');
const model = require('../model.js');

const issue = (message, status = 400, code = 'INVALID_REQUEST') => Object.assign(Error(message), {safe: true, status, code});
const conflict = () => issue('另一台设备已保存新内容，请读取最新数据后重新修改。', 409, 'REVISION_CONFLICT');

function validateWrite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 2) throw issue('权益数据版本无效。');
  if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 || input.baseRevision >= Number.MAX_SAFE_INTEGER) throw issue('权益数据版本号无效。');
  if (typeof input.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.requestId)) throw issue('保存请求编号无效。');
  let records;
  try { records = model.decode(JSON.stringify({version: 2, records: input.records})); }
  catch (error) { throw issue(error.message); }
  const digest = createHash('sha256').update(JSON.stringify({version: 2, baseRevision: input.baseRevision, records})).digest('hex');
  return {baseRevision: input.baseRevision, requestId: input.requestId, records, digest};
}

function snapshot(document) {
  if (!document || document.version !== 2 || !Number.isSafeInteger(document.revision) || document.revision < 0 || typeof document.initialized !== 'boolean') throw Error('Invalid stored benefits state');
  const records = model.decode(JSON.stringify({version: 2, records: document.records}));
  return {version: 2, initialized: document.initialized, revision: document.revision, records, updatedAt: document.updatedAt};
}

function acknowledged(document, request) {
  if (document.lastWrite?.requestId !== request.requestId) return null;
  if (document.lastWrite.digest !== request.digest) throw issue('保存请求编号已用于其他内容，请重新保存。', 409, 'REQUEST_ID_REUSED');
  return snapshot(document);
}

async function createBenefitsStore(collection, {clock = Date.now} = {}) {
  try {
    await collection.updateOne({_id: 'benefits'}, {$setOnInsert: {version: 2, initialized: false, revision: 0, records: [], updatedAt: null, lastWrite: null}}, {upsert: true});
  } catch (error) {
    // Two app instances can initialize the same empty database concurrently.
    if (error.code !== 11000) throw error;
  }
  return {
    async read() { return snapshot(await collection.findOne({_id: 'benefits'})); },
    async save(input) {
      const request = validateWrite(input);
      const before = await collection.findOne({_id: 'benefits'});
      const previous = acknowledged(before, request);
      if (previous) return previous;
      if (before.revision !== request.baseRevision) throw conflict();
      const saved = await collection.findOneAndUpdate(
        {_id: 'benefits', revision: request.baseRevision},
        {$set: {version: 2, initialized: true, revision: request.baseRevision + 1, records: request.records, updatedAt: new Date(clock()).toISOString(), lastWrite: {requestId: request.requestId, digest: request.digest}}},
        {returnDocument: 'after', includeResultMetadata: false}
      );
      if (saved) return snapshot(saved);
      // A concurrent exact retry can race with the first successful save.
      const retry = acknowledged(await collection.findOne({_id: 'benefits'}), request);
      if (retry) return retry;
      throw conflict();
    }
  };
}

async function connectBenefitsStore(environment) {
  const {MongoClient} = require('mongodb');
  const client = new MongoClient(environment.MONGODB_URI, {serverSelectionTimeoutMS: 10000, maxPoolSize: 5, retryWrites: false});
  try {
    await client.connect();
    const database = client.db(environment.MONGODB_DATABASE || 'benefits');
    await database.command({ping: 1});
    const store = await createBenefitsStore(database.collection('state'));
    return {store, close: () => client.close()};
  } catch (error) { await client.close(); throw error; }
}

module.exports = {createBenefitsStore, connectBenefitsStore, validateWrite};
