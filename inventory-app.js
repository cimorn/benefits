(() => {
  'use strict';
  const M = BenefitsModel;
  const content = document.querySelector('#content');
  const editor = document.querySelector('#editor');
  const form = document.querySelector('#editor-form');
  const bulk = document.querySelector('#bulk-editor');
  const bulkForm = document.querySelector('#bulk-form');
  const confirmation = document.querySelector('#confirm-dialog');
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const external = ([label, url]) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  let records = [], storageReady = false, confirmAction, toastTimer;
  let mode = 'pending', authenticated = false, cloudReady = false, revision = 0, cloudInitialized = false, writing = false, loadingCloud = false;
  let editorBase, bulkBase, importBase;
  const browserStorage = {getItem:key => localStorage.getItem(key),setItem:(key,value) => localStorage.setItem(key,value),removeItem:key => localStorage.removeItem(key)};
  const cloud = BenefitsCloud.create({model:M, storage:browserStorage, fetch:(...args) => fetch(...args), uuid:() => crypto.randomUUID()});
  const motion = setupMotion();

  const captureBase = () => ({records:M.decode(M.encode(records)), revision});
  const savedMessage = () => mode === 'cloud' ? '已保存到云端' : '已保存到本机';
  const dialogOpen = () => editor.open || bulk.open || confirmation.open;
  function updateControls() {
    const ready = mode === 'local' ? storageReady : cloudReady && authenticated;
    document.querySelector('#ledger-area').hidden = !(mode === 'local' || (cloudReady && authenticated));
    document.querySelector('#login-panel').hidden = !(mode === 'cloud' && !authenticated);
    document.querySelector('#cloud-controls').hidden = mode === 'local';
    document.querySelector('#logout').hidden = mode !== 'cloud' || !authenticated;
    document.querySelector('#refresh-cloud').disabled = writing || loadingCloud;
    document.querySelector('#logout').disabled = writing;
    document.querySelector('#add-benefit').disabled = !ready || writing;
    document.querySelector('#import-backup').disabled = !ready || writing;
    document.querySelector('#export-backup').disabled = !(mode === 'local' || (cloudReady && authenticated));
    document.querySelectorAll('[data-save-label]').forEach(button => {button.textContent = mode === 'cloud' ? '保存并同步' : '保存到本机';button.disabled = writing;});
    document.querySelector('#confirm-action').disabled = writing;
    document.querySelector('#save-description').textContent = `${mode === 'cloud' ? '云端保存' : mode === 'local' ? '本机保存' : '正在连接'} · 数量按权益条目统计`;
    try {
      const noDraft = mode !== 'cloud' || !authenticated || !cloud.draft();
      document.querySelector('#export-draft').hidden = noDraft;
      document.querySelector('#discard-draft').hidden = noDraft;
      document.querySelector('#discard-draft').disabled = writing;
    }
    catch (error) { storageError(error.message); }
  }
  function setStatus(message) { document.querySelector('#sync-status').textContent = message; }
  function clearStorageError() { document.querySelector('#storage-error').hidden = true; }
  function localStart() {
    mode = 'local';
    try { records = M.read(localStorage, initialBenefits); M.save(localStorage, records); storageReady = true; }
    catch (error) { storageError(`无法读取或保存本机数据：${error.message}。原缓存未覆盖，请检查浏览器存储设置。`); }
    updateControls(); render();
  }
  function requireLogin(message = '') {
    authenticated = false; cloudReady = false; records = [];
    document.querySelector('#login-error').textContent = message;
    document.querySelector('#login-error').hidden = !message;
    setStatus('请登录后读取云端台账'); updateControls();
  }
  function cloudFailure(error) {
    if (error.status === 401) {
      editor.close(); bulk.close(); confirmation.close(); requireLogin('登录已过期，请重新登录。未上传草稿保留在本机。');
    } else {
      setStatus(error.status === 409 ? '云端已有更新 · 草稿保留在本机' : error.code === 'DRAFT_EXISTS' ? '有未上传草稿 · 请先导出并清除' : '连接失败 · 草稿保留在本机');
      updateControls();
    }
  }
  function acceptCloud(value) {
    records = value.records; revision = value.revision; cloudInitialized = value.initialized; cloudReady = true;
    clearStorageError();
    if (value.cacheWarning) storageError(value.cacheWarning);
    let hasDraft = false;
    try { hasDraft = Boolean(cloud.draft()); } catch (error) { storageError(error.message); }
    setStatus(value.initialized ? `已读取云端台账${hasDraft ? ' · 有未上传草稿' : ''}` : '云端台账尚未初始化');
    updateControls(); render();
  }
  async function refreshCloud() {
    if (!authenticated || writing || loadingCloud) return;
    loadingCloud = true; setStatus('正在读取云端…'); updateControls();
    try {
      const value = await cloud.load();
      if (authenticated) acceptCloud(value);
    } catch (error) { cloudFailure(error); storageError(error.message); }
    finally { loadingCloud = false; updateControls(); }
  }
  async function bootstrap() {
    if (location.protocol === 'file:') { localStart(); return; }
    setStatus('正在连接…'); updateControls();
    try {
      const session = await cloud.session(); mode = session.mode;
      if (mode === 'local') { clearStorageError(); localStart(); return; }
      authenticated = session.authenticated;
      if (!authenticated) requireLogin(); else { updateControls(); await refreshCloud(); }
    } catch (error) { setStatus('暂时无法连接服务'); storageError(error.message); updateControls(); }
  }

  function setupMotion() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const touch = window.matchMedia('(pointer: coarse)');
    const layers = [...document.querySelectorAll('.parallax-layer')];
    let frame = 0;
    function updateBackground() {
      frame = 0;
      const distance = reducedMotion.matches ? 0 : Math.max(window.scrollY,0) * (touch.matches ? 0.55 : 1);
      layers.forEach((layer,index) => {
        const offset = Math.min(distance * (index === 0 ? 0.14 : 0.065), index === 0 ? 240 : 130);
        layer.style.transform = `translate3d(0, ${-offset.toFixed(2)}px, 0)`;
      });
    }
    function scheduleBackground() { if (!frame) frame = requestAnimationFrame(updateBackground); }
    function reveal(element) {
      element.dataset.revealState = 'revealed';
      observer?.unobserve(element);
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { threshold: 0, rootMargin: '0px 0px -18px 0px' }) : null;
    function refresh({instant = false} = {}) {
      observer?.disconnect();
      const targets = [...document.querySelectorAll('#stats .stat, .category-sidebar, .brand-panel, .inventory-table tbody tr, .empty-state, .sources, .site-footer')];
      let rowIndex = 0;
      targets.forEach((element,index) => {
        element.classList.add('motion-reveal');
        element.dataset.revealDirection = element.classList.contains('category-sidebar') ? 'left' : 'up';
        const delay = element.tagName === 'TR' ? (rowIndex++ % 4) * 35 : element.classList.contains('stat') ? index * 45 : 0;
        element.style.setProperty('--reveal-delay',`${delay}ms`);
        if (reducedMotion.matches || !observer || instant || element.dataset.revealState === 'revealed') reveal(element);
        else { element.dataset.revealState = 'pending'; observer.observe(element); }
      });
      scheduleBackground();
    }
    window.addEventListener('scroll',scheduleBackground,{passive:true});
    window.addEventListener('resize',scheduleBackground,{passive:true});
    window.addEventListener('pageshow',scheduleBackground);
    reducedMotion.addEventListener('change',() => refresh({instant:reducedMotion.matches}));
    document.addEventListener('focusin',event => {
      const target = event.target.closest('.motion-reveal[data-reveal-state="pending"]');
      if (target) { target.style.setProperty('--reveal-delay','0ms'); reveal(target); }
    });
    return {refresh};
  }

  function storageError(message) {
    const box = document.querySelector('#storage-error'); box.textContent = message; box.hidden = false;
  }
  function notify(message) {
    clearTimeout(toastTimer); const toast = document.querySelector('#toast'); toast.textContent = message; toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }
  async function commit(next, base = captureBase()) {
    if (writing) throw Error('正在保存，请稍候再试。');
    if (mode === 'local') {
      if (!storageReady) throw Error('本机存储不可用，暂时不能保存');
      records = M.save(localStorage, next); render(); return;
    }
    if (mode !== 'cloud' || !authenticated || !cloudReady) throw Error('请先登录并读取云端台账。');
    writing = true; setStatus('正在保存到云端…'); updateControls();
    try {
      const value = await cloud.save(next, base.revision);
      acceptCloud(value); setStatus('已保存到云端');
    } catch (error) {
      cloudFailure(error);
      if (error.status === 409) error.message = '云端已有新修改，未上传草稿已保留。请先导出草稿，再重新读取云端后核对修改。';
      throw error;
    } finally { writing = false; updateControls(); }
  }
  function ownerNames() { return [...new Set(records.map(item => item.owner))]; }
  function ownerHref(owner, filter = 'all') {
    const query = new URLSearchParams();
    if (owner) query.set('name',owner);
    if (filter !== 'all') query.set('filter',filter);
    return `#${owner ? 'owner' : 'all'}${query.size ? `?${query}` : ''}`;
  }
  function route() {
    const [slug, query] = location.hash.slice(1).split('?'), params = new URLSearchParams(query);
    const owner = slug === 'owner' ? params.get('name') || '' : Object.hasOwn(handbookData,slug) ? records.find(item => item.id.startsWith(`initial-${slug}-`))?.owner || '' : '';
    const value = params.get('filter');
    return { owner, filter: ['expiring','expired','undated'].includes(value) ? value : 'all' };
  }
  function navigate(owner, filter = 'all') {
    const hash = ownerHref(owner,filter);
    if (location.hash === hash) render(); else location.hash = hash;
  }
  function ownerRecords(owner) { return owner ? records.filter(item => item.owner === owner) : records; }
  function render() {
    const {owner,filter} = route(), owners = ownerNames(), all = ownerRecords(owner);
    let visible = all.filter(item => filter === 'all' || M.expiry(item.expires,today()).kind === filter);
    if (filter === 'expiring' || filter === 'expired') visible = [...visible].sort((a,b) => a.expires.localeCompare(b.expires));
    const stats = M.summarize(records,today());
    document.querySelector('#stats').innerHTML = [['total','全部权益'],['expiring','30 天内到期'],['expired','已过期'],['undated','日期未填']].map(([key,label]) => `<button type="button" class="stat ${!owner && filter === (key === 'total' ? 'all' : key) ? 'selected' : ''}" data-filter="${key === 'total' ? 'all' : key}"><strong>${stats[key]}</strong><span>${label}</span></button>`).join('');
    const navigation = [{name:'',label:'全部权益',count:records.length}, ...owners.map(name => ({name,label:name,count:ownerRecords(name).length}))];
    document.querySelector('.category-nav').innerHTML = navigation.map(item => `<a href="${escape(ownerHref(item.name))}" data-owner="${escape(item.name)}" ${item.name === owner ? 'aria-current="page"' : ''}><span class="category-name">${escape(item.label)}</span><span class="nav-count">${item.count}</span></a>`).join('');
    document.querySelector('#owner-select').innerHTML = navigation.map(item => `<option value="${escape(item.name)}" ${item.name === owner ? 'selected' : ''}>${escape(item.label)} · ${item.count}</option>`).join('');
    document.title = `权益手册 · ${owner || '全部权益'}`;
    const sourceList = Object.values(handbookData).flatMap(item => item.sources);
    content.innerHTML = `
      <div class="benefits-layout inventory-layout">
        <aside class="brand-panel">
          <div class="brand-heading"><h1>${owner ? escape(owner) : '全部权益'}</h1><p class="brand-description">${all.length} 项权益</p></div>
          <label class="filter-control">到期筛选<select id="expiry-filter">${[['all','全部'],['expiring','30 天内到期'],['expired','已过期'],['undated','日期未填']].map(([key,label]) => `<option value="${key}" ${filter === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <button type="button" class="secondary-button bulk-button" id="set-dates" ${!all.length ? 'disabled' : ''}>批量设到期时间</button>
        </aside>
        <div class="records-panel">
          <table class="inventory-table" aria-label="${owner ? escape(owner) : '全部'}权益台账">
            <colgroup><col><col><col><col><col></colgroup>
            <thead><tr><th scope="col">权益 / 所属</th><th scope="col">类型</th><th scope="col">到期时间</th><th scope="col">备注</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead>
            <tbody>${visible.map(item => { const due = M.expiry(item.expires,today()); return `<tr>
              <th scope="row"><span class="record-name">${escape(item.name)}</span><span class="record-owner">${escape(item.owner)}</span>${item.count ? `<span class="record-count">${escape(item.count)}</span>` : ''}</th>
              <td class="type-cell"><span class="mobile-label">类型</span>${item.type ? escape(item.type) : '<span class="unset">—</span>'}</td>
              <td class="date-cell"><span class="mobile-label">到期时间</span>${item.expires ? `<time datetime="${item.expires}">${item.expires}</time>` : '<span class="unset">未填写</span>'}${due.kind === 'expiring' || due.kind === 'expired' ? `<span class="date-badge ${due.kind}">${due.label}</span>` : ''}</td>
              <td class="notes-cell"><span class="mobile-label">备注</span>${item.notes ? escape(item.notes).replace(/\n/g,'<br>') : '<span class="unset">—</span>'}</td>
              <td class="edit-cell"><button type="button" class="edit-button" data-edit="${escape(item.id)}" aria-label="编辑：${escape(item.name)}（${escape(item.owner)}）">编辑</button></td>
            </tr>`; }).join('')}</tbody>
          </table>
          ${!visible.length ? `<div class="empty-state"><p>${all.length ? '没有符合条件的权益' : mode === 'cloud' && !cloudInitialized ? '云端台账还是空的，可以导入已有备份或新增权益。' : '还没有权益'}</p><button class="secondary-button" type="button" data-empty-action="${all.length ? 'clear' : 'add'}">${all.length ? '清除筛选' : '新增权益'}</button>${mode === 'cloud' && !cloudInitialized ? '<button class="secondary-button" type="button" data-use-presets>使用预置权益</button>' : ''}</div>` : ''}
          <p class="list-total">显示 ${visible.length} 项</p>
        </div>
      </div>
      <details class="sources"><summary>预置内容的官方来源 · 2026.10.27</summary><ul>${sourceList.map(source => `<li>${external(source)}</li>`).join('')}</ul></details>`;
    document.querySelector('#owners').innerHTML = owners.map(owner => `<option value="${escape(owner)}"></option>`).join('');
    content.querySelector('#expiry-filter').addEventListener('change',event => navigate(owner,event.target.value));
    content.querySelector('#set-dates').addEventListener('click',openBulk);
    motion.refresh({instant:editor.open || bulk.open || confirmation.open});
  }
  function showEditor(item) {
    if (writing) return;
    editorBase = captureBase();
    form.reset();
    const defaults = {id:crypto.randomUUID(),name:'',owner:route().owner,expires:'',type:'',count:'',notes:''};
    for (const [key,value] of Object.entries(item || defaults)) if(form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
    document.querySelector('#editor-title').textContent = item ? '编辑权益' : '新增权益';
    document.querySelector('#delete-benefit').hidden = !item;
    document.querySelector('#editor-error').hidden = true;
    editor.showModal();
  }
  function ask(title,message,label,action) {
    if (writing) return;
    document.querySelector('#confirm-title').textContent = title;
    document.querySelector('#confirm-message').textContent = message;
    document.querySelector('#confirm-action').textContent = label;
    confirmAction = action; confirmation.showModal();
  }
  function bulkTargets() {
    const owner = document.querySelector('#bulk-owner').value;
    const available = mode === 'local' ? records : bulkBase?.records || records;
    return owner ? available.filter(item => item.owner === owner) : available;
  }
  function openBulk() {
    if (writing) return;
    bulkBase = captureBase();
    const owners = ownerNames();
    document.querySelector('#bulk-owner').innerHTML = `<option value="">全部所属</option>${owners.map(owner => `<option>${escape(owner)}</option>`).join('')}`;
    document.querySelector('#bulk-owner').value = route().owner;
    bulkForm.elements.expires.value = '';
    document.querySelector('#bulk-error').hidden = true;
    updateBulkCount(); bulk.showModal();
  }
  function updateBulkCount() { document.querySelector('#bulk-count').textContent = `将更新此范围内 ${bulkTargets().length} 项权益的到期时间。`; }
  document.querySelector('#add-benefit').addEventListener('click',() => showEditor());
  document.querySelector('#stats').addEventListener('click',event => { const button = event.target.closest('[data-filter]'); if(button) navigate('',button.dataset.filter); });
  content.addEventListener('click',event => {
    const button = event.target.closest('[data-edit]'); if(button) showEditor(records.find(item => item.id === button.dataset.edit));
    const empty = event.target.closest('[data-empty-action]'); if(empty) { if(empty.dataset.emptyAction === 'add') showEditor(); else navigate(route().owner); }
    if(event.target.closest('[data-use-presets]')) {
      const base = captureBase();
      ask('使用预置权益',`将把 ${initialBenefits.length} 项预置权益保存到空的云端台账。已有个人备份可使用页脚“导入备份”。`,'使用并保存',async() => {await commit(initialBenefits,base);notify(savedMessage());});
    }
  });
  document.querySelector('#owner-select').addEventListener('change',event => { navigate(event.target.value); document.querySelector('#owner-select').focus({preventScroll:true}); });
  document.querySelector('.skip-link').addEventListener('click',event => { event.preventDefault(); content.focus(); content.scrollIntoView(); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => document.getElementById(button.dataset.close).close()));
  form.addEventListener('submit',async event => {
    event.preventDefault();
    try { const item = M.normalize(Object.fromEntries(new FormData(form))); await commit(M.upsert(mode === 'local' ? records : editorBase.records,item),editorBase); editor.close(); if(route().owner && route().owner !== item.owner) navigate(item.owner); notify(savedMessage()); }
    catch(error) { document.querySelector('#editor-error').textContent = error.message; document.querySelector('#editor-error').hidden = false; }
  });
  document.querySelector('#delete-benefit').addEventListener('click',() => {
    const id = form.elements.id.value;
    const base = editorBase;
    ask('删除权益',`删除“${form.elements.name.value}”？这条记录将从统计中移除。`,'确认删除',async() => { await commit(M.remove(mode === 'local' ? records : base.records,id),base); editor.close(); if(route().owner && !ownerRecords(route().owner).length) navigate(''); notify(mode === 'cloud' ? '权益已删除并同步' : '权益已删除'); });
  });
  document.querySelector('#confirm-action').addEventListener('click',async() => { try { await confirmAction(); confirmation.close(); } catch(error) { document.querySelector('#confirm-message').textContent = `操作失败：${error.message}`; } });
  document.querySelector('#bulk-owner').addEventListener('change',updateBulkCount);
  bulkForm.addEventListener('submit',async event => {
    event.preventDefault();
    try { const ids = new Set(bulkTargets().map(item => item.id)); await commit((mode === 'local' ? records : bulkBase.records).map(item => ids.has(item.id) ? {...item,expires:bulkForm.elements.expires.value} : item),bulkBase); bulk.close(); notify(`已更新 ${ids.size} 项权益的到期时间${mode === 'cloud' ? '并同步' : ''}`); }
    catch(error) { document.querySelector('#bulk-error').textContent = error.message; document.querySelector('#bulk-error').hidden = false; }
  });
  function exportRecords(items, label = '权益台账') {
    const blob = new Blob([M.encode(items)],{type:'application/json;charset=utf-8'}), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${label}-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); notify('备份文件已导出');
  }
  document.querySelector('#export-backup').addEventListener('click',() => exportRecords(records));
  document.querySelector('#export-draft').addEventListener('click',() => {try {const draft = cloud.draft();if(draft)exportRecords(draft.records,'权益台账-未上传草稿');}catch(error){storageError(error.message);}});
  document.querySelector('#discard-draft').addEventListener('click',() => {
    ask('清除未上传草稿','请先导出需要保留的草稿。清除后可重新编辑或导入备份，云端台账不会改变。','清除草稿',() => {cloud.discardDraft();updateControls();setStatus('未上传草稿已清除');});
  });
  document.querySelector('#import-backup').addEventListener('click',() => {importBase = captureBase();document.querySelector('#backup-file').click();});
  document.querySelector('#backup-file').addEventListener('change',async event => {
    const file = event.target.files[0]; if(!file) return;
    try { if(file.size > 10 * 1024 * 1024) throw Error('备份文件不能超过 10 MB'); const base = importBase || captureBase(), imported = M.decode(await file.text()); ask('导入备份',`备份中有 ${imported.length} 项权益，将替换${mode === 'cloud' ? '云端' : '本机'}现有的 ${base.records.length} 项。`,'导入并替换',async() => { await commit(imported,base); notify(mode === 'cloud' ? '备份已导入并同步' : '备份已导入'); }); }
    catch(error) { notify(`导入失败：${error.message}`); }
    event.target.value = '';
  });
  window.addEventListener('hashchange',render);
  window.addEventListener('storage',event => { if(mode === 'local' && event.key === M.KEY) { try { records = M.read(localStorage,initialBenefits); render(); notify('已同步本机其他窗口的修改'); } catch(error) { storageError(error.message); } } else if(mode === 'cloud' && event.key === BenefitsCloud.DRAFT_KEY) updateControls(); });
  document.addEventListener('visibilitychange',() => { if(!document.hidden && !dialogOpen()) {if(mode === 'cloud')refreshCloud();else if(mode === 'local')render();} });
  document.querySelector('#refresh-cloud').addEventListener('click',() => mode === 'cloud' ? refreshCloud() : bootstrap());
  document.querySelector('#login-form').addEventListener('submit',async event => {
    event.preventDefault();
    const button = document.querySelector('#login-form button[type="submit"]'); button.disabled = true;
    const password = document.querySelector('#login-password');
    try {
      await cloud.login(password.value); password.value = ''; authenticated = true;
      document.querySelector('#login-error').hidden = true; clearStorageError(); updateControls(); await refreshCloud();
    } catch(error) {document.querySelector('#login-error').textContent = error.message;document.querySelector('#login-error').hidden = false;}
    finally {button.disabled = false;}
  });
  document.querySelector('#logout').addEventListener('click',async() => {
    if(writing)return;
    try {await cloud.logout();requireLogin();}catch(error){storageError(error.message);}
  });
  bootstrap();
})();
