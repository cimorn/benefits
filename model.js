(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BenefitsModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'benefits-handbook:personal:v1';
  const textFields = ['id', 'name', 'owner', 'expires', 'type', 'count', 'notes'];
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }
  function normalize(record) {
    if (!record || typeof record !== 'object') throw Error('权益数据格式错误');
    const source = {...record, type: record.type === undefined ? record.scene : record.type};
    const item = {};
    for (const field of textFields) {
      if (source[field] != null && typeof source[field] !== 'string') throw Error('权益数据必须是文字');
      item[field] = (source[field] || '').trim();
      if (item[field].length > (field === 'notes' ? 3000 : 160)) throw Error('内容过长，请缩短后保存');
    }
    if (!item.id || !item.name) throw Error('请填写权益名称');
    if (!item.owner) throw Error('请填写所属会员或设备');
    if (item.expires && !validDate(item.expires)) throw Error('到期日期无效');
    return item;
  }
  function normalizeList(records) {
    if (!Array.isArray(records) || records.length > 10000) throw Error('权益数据列表无效');
    const result = records.map(normalize), ids = new Set();
    for (const item of result) { if (ids.has(item.id)) throw Error('权益 ID 重复'); ids.add(item.id); }
    return result;
  }
  function expiry(value, today) {
    if (!value) return { kind: 'undated', days: null, label: '未填写' };
    if (!validDate(value) || !validDate(today)) throw Error('日期无效');
    const days = Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    if (days < 0) return { kind: 'expired', days, label: '已过期' };
    if (days <= 30) return { kind: 'expiring', days, label: days === 0 ? '今天到期' : `还剩 ${days} 天` };
    return { kind: 'active', days, label: '' };
  }
  function summarize(records, today) {
    const summary = { total: records.length, expiring: 0, expired: 0, undated: 0 };
    for (const record of records) { const kind = expiry(record.expires, today).kind; if (kind !== 'active') summary[kind]++; }
    return summary;
  }
  function encode(records) { return JSON.stringify({ version: 2, records: normalizeList(records) }, null, 2); }
  function decode(raw) {
    let data; try { data = JSON.parse(raw); } catch { throw Error('本地数据或备份格式损坏'); }
    if (![1,2].includes(data?.version)) throw Error('备份版本不支持');
    return normalizeList(data.records);
  }
  function read(storage, defaults) { const raw = storage.getItem(KEY); return raw === null ? normalizeList(defaults) : decode(raw); }
  function save(storage, records) { const raw = encode(records); storage.setItem(KEY, raw); return decode(raw); }
  function upsert(records, record) {
    const item = normalize(record), exists = records.some(existing => existing.id === item.id);
    return exists ? records.map(existing => existing.id === item.id ? item : existing) : [...records, item];
  }
  function remove(records, id) { return records.filter(record => record.id !== id); }
  return { KEY, normalize, expiry, summarize, encode, decode, read, save, upsert, remove };
});
