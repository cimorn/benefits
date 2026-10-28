const assert = require('node:assert/strict');
const copy = value => value == null ? value : structuredClone(value);

// Mongo's single-document conditional update is atomic. Keep that boundary in
// this test double; the optional integration test exercises real MongoDB too.
class MemoryCollection {
  constructor() { this.document = null; }
  async updateOne(filter, update, options = {}) {
    if (!this.document && options.upsert) {
      this.document = {_id: filter._id, ...copy(update.$setOnInsert)};
      return {upsertedCount: 1};
    }
    return {upsertedCount: 0};
  }
  async findOne() { return copy(this.document); }
  async findOneAndUpdate(filter, update) {
    if (!this.document || this.document._id !== filter._id || this.document.revision !== filter.revision) return null;
    Object.assign(this.document, copy(update.$set));
    return copy(this.document);
  }
}

const record = (id = 'one', notes = '') => ({id, name: '会员权益', owner: '我的会员', expires: '2027-01-01', type: '购物', count: '1次', notes});
const write = (baseRevision = 0, records = [record()], requestId = 'request-1') => ({version: 2, baseRevision, records, requestId});
function exported(module, name) {
  assert.equal(typeof module[name], 'function', `${name} 尚未实现`);
  return module[name];
}
module.exports = {MemoryCollection, record, write, exported};
