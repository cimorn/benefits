(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BenefitsCloud = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CACHE_KEY = 'benefits-handbook:cloud:acknowledged:v1';
  const DRAFT_KEY = 'benefits-handbook:cloud:draft:v1';
  const LEGACY_BACKUP_KEY = 'benefits-handbook:personal:before-cloud:v1';
  const failure = (message, details = {}) => Object.assign(new Error(message), details);
  function create({model, storage, fetch:fetcher, uuid = () => crypto.randomUUID()}) {
    let writing = false, latestSnapshot = null;
    const normalize = records => model.decode(JSON.stringify({version:2, records}));
    function checkedSnapshot(value) {
      if (!value || value.version !== 2 || typeof value.initialized !== 'boolean' || !Number.isSafeInteger(value.revision) || value.revision < 0 || (value.updatedAt !== null && typeof value.updatedAt !== 'string')) throw failure('云端响应格式无效，请稍后重新读取。');
      const records = normalize(value.records);
      if (!value.initialized && (value.revision !== 0 || records.length)) throw failure('云端初始化状态无效，请重新读取。');
      return {version:2, initialized:value.initialized, revision:value.revision, records, updatedAt:value.updatedAt};
    }
    async function request(path, {method = 'GET', body} = {}) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
      let response, result;
      try {
        response = await fetcher(path, {method, credentials:'same-origin', cache:'no-store', signal:controller.signal, headers:{Accept:'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json'})}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
        try { result = await response.json(); } catch { throw failure('服务响应无效，请稍后重试。', {status:response.status}); }
      } catch (error) {
        if (error.status) throw error;
        throw failure('网络连接失败，草稿会保留在本机，请稍后重试。', {code:'NETWORK'});
      } finally { clearTimeout(timer); }
      if (!response.ok) throw failure(typeof result?.error === 'string' ? result.error : '云端操作失败，请稍后重试。', {status:response.status, code:result?.code});
      return result;
    }
    function preserveLegacy() {
      const raw = storage.getItem(model.KEY);
      if (raw !== null && storage.getItem(LEGACY_BACKUP_KEY) === null) storage.setItem(LEGACY_BACKUP_KEY, raw);
    }
    function remember(snapshot) {
      if (latestSnapshot && snapshot.revision < latestSnapshot.revision) return {...latestSnapshot};
      let cacheWarning = '';
      try { preserveLegacy(); storage.setItem(CACHE_KEY, JSON.stringify(snapshot)); }
      catch { cacheWarning = '云端数据已读取，但无法更新本机缓存。请检查浏览器存储空间。'; }
      latestSnapshot = {...snapshot, cacheWarning};
      return {...latestSnapshot};
    }
    function draft() {
      const raw = storage.getItem(DRAFT_KEY);
      if (raw === null) return null;
      let value;
      try { value = JSON.parse(raw); } catch { throw failure('本机草稿格式损坏，请保留网站数据并检查备份。'); }
      if (value.version !== 2 || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || typeof value.requestId !== 'string' || !value.requestId) throw failure('本机草稿格式无效，请保留网站数据并检查备份。');
      return {...value, records:normalize(value.records)};
    }
    return {
      async session() {
        const value = await request('/api/session');
        if (!['local','cloud'].includes(value?.mode) || typeof value.authenticated !== 'boolean') throw failure('无法确认保存模式，请重新连接服务。');
        return {mode:value.mode, authenticated:value.authenticated};
      },
      login:password => request('/api/login', {method:'POST', body:{password}}),
      logout:() => request('/api/logout', {method:'POST', body:{}}),
      async load() { return remember(checkedSnapshot(await request('/api/benefits'))); },
      draft,
      discardDraft() {
        if (writing) throw failure('正在保存，请稍后再清除草稿。');
        storage.removeItem(DRAFT_KEY);
      },
      async save(records, baseRevision, requestId) {
        if (writing) throw failure('正在保存，请稍候再试。');
        if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw failure('保存版本无效，请重新读取云端数据。');
        const normalized = normalize(records), previous = draft();
        if (previous && (previous.baseRevision !== baseRevision || JSON.stringify(previous.records) !== JSON.stringify(normalized))) throw failure('已有未上传草稿。请先导出草稿，再清除草稿后继续保存。', {code:'DRAFT_EXISTS'});
        requestId = requestId || previous?.requestId || uuid();
        if (typeof requestId !== 'string' || !requestId) throw failure('保存请求标识无效。');
        const pending = {version:2, baseRevision, records:normalized, requestId};
        try { preserveLegacy(); storage.setItem(DRAFT_KEY, JSON.stringify(pending)); }
        catch { throw failure('无法保留本机草稿，暂未上传。请导出备份并检查浏览器存储空间。'); }
        writing = true;
        try {
          const snapshot = checkedSnapshot(await request('/api/benefits', {method:'POST', body:pending}));
          const result = remember(snapshot);
          if (!result.cacheWarning) {
            try { if (storage.getItem(DRAFT_KEY) === JSON.stringify(pending)) storage.removeItem(DRAFT_KEY); }
            catch { result.cacheWarning = '已保存到云端，但本机草稿缓存暂未清理。'; }
          } else result.cacheWarning = '已保存到云端，但本机缓存无法更新。请保留当前页面。';
          return result;
        } finally { writing = false; }
      }
    };
  }
  return {CACHE_KEY, DRAFT_KEY, LEGACY_BACKUP_KEY, create};
});
