const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('./model.js');
const C = require('./cloud.js');
const record = (id, notes = '') => ({id,name:'测试权益',owner:'测试会员',expires:'',type:'',count:'',notes});
const state = (revision = 3, records = [record('remote')]) => ({version:2,initialized:true,revision,records,updatedAt:'2026-10-28T00:00:00.000Z'});
const response = body => ({ok:true,status:200,json:async() => body});
const flush = async() => { for(let i=0;i<5;i++) await new Promise(resolve => setImmediate(resolve)); };
function harness(fetcher, initialRaw) {
  const elements = new Map(), saved = new Map(initialRaw === undefined ? [] : [[M.KEY,initialRaw]]), requests = [], events = {};
  class Element {
    constructor() { this.hidden=false;this.open=false;this.value='';this.textContent='';this.innerHTML='';this.dataset={};this.listeners={};this.style={setProperty(){}};this.classList={add(){},contains(){return false;}}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    dispatch(type, data = {}) { return this.listeners[type]?.({preventDefault(){},target:this,...data}); }
    querySelector(selector) { return get(selector); }
    querySelectorAll() { return []; }
    showModal() { this.open=true; }
    close() { this.open=false; }
    reset() { this.values={}; }
    focus() {}
    click() { return this.dispatch('click'); }
    scrollIntoView() {}
    setAttribute(name,value) { this[name]=value; }
    removeAttribute(name) { delete this[name]; }
    closest() { return null; }
  }
  const get = selector => {if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);};
  for(const name of ['#editor-form','#bulk-form','#login-form']) {
    const element = get(name);
    element.values={};
    element.elements=new Proxy({namedItem:key => ({get value(){return element.values[key]??'';},set value(value){element.values[key]=value;}})}, {get(target,key){return key in target ? target[key] : {get value(){return element.values[key]??'';},set value(value){element.values[key]=value;}};}});
  }
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const document={querySelector:get,querySelectorAll:()=>[],addEventListener:(type,fn)=>{events[type]=fn;},hidden:false,createElement:()=>new Element()};
  const window={matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(type,fn)=>{events[type]=fn;},scrollY:0};
  const context={BenefitsModel:M,BenefitsCloud:C,initialBenefits:[record('preset')],handbookData:{},document,window,location:{protocol:'http:',hash:''},localStorage:storage,fetch:async(path,options)=>{requests.push([path,options]);return fetcher(path,options);},URL,URLSearchParams,Blob,AbortController,crypto:{randomUUID:()=> 'generated-id'},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,FormData:class {constructor(form){return Object.entries(form.values);}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./inventory-app.js'),'utf8'),context);
  return {get,saved,requests,events,document,storage};
}

test('local session keeps the existing local-only storage path', async() => {
  const legacy=M.encode([record('local')]);
  const app=harness(async()=>response({mode:'local',authenticated:true}),legacy);
  await flush();
  assert.equal(app.requests.length,1);
  assert.equal(app.requests[0][0],'/api/session');
  assert.deepEqual(M.decode(app.saved.get(M.KEY)),[record('local')]);
  assert.equal(app.get('#cloud-controls').hidden,true);
});

test('cloud login bootstrap never writes preset or legacy records to the server', async() => {
  const raw=M.encode([record('legacy')]);
  const app=harness(async path=>response(path === '/api/session' ? {mode:'cloud',authenticated:false} : state()),raw);
  await flush();
  assert.equal(app.get('#login-panel').hidden,false);
  assert.equal(app.get('#ledger-area').hidden,true);
  assert.equal(app.saved.get(M.KEY),raw);
  assert.deepEqual(app.requests.map(([path])=>path),['/api/session']);
});

test('empty cloud is displayed without uploading initialBenefits', async() => {
  const app=harness(async path=>response(path === '/api/session' ? {mode:'cloud',authenticated:true} : {version:2,initialized:false,revision:0,records:[],updatedAt:null}));
  await flush();
  assert.equal(app.get('#ledger-area').hidden,false);
  assert.match(app.get('#content').innerHTML,/data-use-presets/);
  assert.equal(app.requests.filter(([,options])=>options.method === 'POST').length,0);
});

test('save awaits acknowledgement and retains the editor-opening revision across an in-flight refresh', async() => {
  let reads=0,releaseRead,releaseWrite;
  const app=harness(async(path,options)=>{
    if(path==='/api/session')return response({mode:'cloud',authenticated:true});
    if(options.method==='POST')return new Promise(resolve=>{releaseWrite=resolve;});
    if(++reads===1)return response(state());
    return new Promise(resolve=>{releaseRead=resolve;});
  });
  await flush();
  app.get('#refresh-cloud').dispatch('click');
  await flush();
  app.get('#add-benefit').dispatch('click');
  app.get('#editor-form').values=record('new','draft');
  releaseRead(response(state(4,[record('remote','other device')])));
  await flush();
  const pending=app.get('#editor-form').dispatch('submit');
  await flush();
  assert.equal(app.get('#editor').open,true);
  const body=JSON.parse(app.requests.find(([,options])=>options.method==='POST')[1].body);
  assert.equal(body.baseRevision,3);
  assert.equal(body.records.find(item=>item.id==='remote').notes,'');
  releaseWrite(response(state(5,body.records)));
  await pending;
  assert.equal(app.get('#editor').open,false);
  assert.equal(JSON.parse(app.saved.get(C.CACHE_KEY)).revision,5);
});

test('a conflicting save leaves entered values and a recoverable draft intact', async() => {
  const app=harness(async(path,options)=>{
    if(path==='/api/session')return response({mode:'cloud',authenticated:true});
    if(options.method==='POST')return {ok:false,status:409,json:async()=>({code:'REVISION_CONFLICT',error:'云端已有新修改'})};
    return response(state());
  });
  await flush();
  app.get('#add-benefit').dispatch('click');
  app.get('#editor-form').values=record('new','keep this');
  await app.get('#editor-form').dispatch('submit');
  assert.equal(app.get('#editor').open,true);
  assert.equal(app.get('#editor-form').values.notes,'keep this');
  assert.equal(JSON.parse(app.saved.get(C.DRAFT_KEY)).records.find(item=>item.id==='new').notes,'keep this');
  assert.match(app.get('#editor-error').textContent,/云端/);
});

test('local mode preserves another tab independent edits while a dialog is open', async() => {
  const app=harness(async()=>response({mode:'local',authenticated:true}),M.encode([record('local')]));
  await flush();
  app.get('#add-benefit').dispatch('click');
  app.get('#editor-form').values=record('new');
  app.storage.setItem(M.KEY,M.encode([record('local'),record('other-tab')]));
  app.events.storage({key:M.KEY});
  await app.get('#editor-form').dispatch('submit');
  assert.deepEqual(M.decode(app.saved.get(M.KEY)).map(item=>item.id),['local','other-tab','new']);
});

test('bulk date changes keep the opening snapshot when another refresh completes', async() => {
  let reads=0,releaseRead,posted;
  const app=harness(async(path,options)=>{
    if(path==='/api/session')return response({mode:'cloud',authenticated:true});
    if(options.method==='POST'){posted=JSON.parse(options.body);return response(state(5,posted.records));}
    if(++reads===1)return response(state());
    return new Promise(resolve=>{releaseRead=resolve;});
  });
  await flush();
  app.get('#refresh-cloud').dispatch('click');await flush();
  app.get('#set-dates').dispatch('click');
  app.get('#bulk-form').values={expires:'2027-01-01'};
  releaseRead(response(state(4,[record('remote'),record('new-on-server')])));await flush();
  await app.get('#bulk-form').dispatch('submit');
  assert.equal(posted.baseRevision,3);
  assert.deepEqual(posted.records.map(item=>item.id),['remote']);
  assert.equal(posted.records[0].expires,'2027-01-01');
});

test('backup import saves against the revision captured before the file picker opened', async() => {
  let current=3,posted;
  const app=harness(async(path,options)=>{
    if(path==='/api/session')return response({mode:'cloud',authenticated:true});
    if(options.method==='POST'){posted=JSON.parse(options.body);return response(state(5,posted.records));}
    return response(state(current));
  });
  await flush();
  app.get('#import-backup').dispatch('click');
  current=4;await app.get('#refresh-cloud').dispatch('click');
  await app.get('#backup-file').dispatch('change',{target:{files:[{size:200,text:async()=>M.encode([record('imported')])}],value:'backup.json'}});
  await app.get('#confirm-action').dispatch('click');
  assert.equal(posted.baseRevision,3);
  assert.equal(posted.records[0].id,'imported');
});

test('expired login hides private content while preserving the failed cloud draft', async() => {
  const app=harness(async(path,options)=>{
    if(path==='/api/session')return response({mode:'cloud',authenticated:true});
    if(options.method==='POST')return {ok:false,status:401,json:async()=>({error:'登录已过期'})};
    return response(state());
  });
  await flush();
  app.get('#add-benefit').dispatch('click');app.get('#editor-form').values=record('new','retain');
  await app.get('#editor-form').dispatch('submit');
  assert.equal(app.get('#login-panel').hidden,false);
  assert.equal(app.get('#ledger-area').hidden,true);
  assert.equal(JSON.parse(app.saved.get(C.DRAFT_KEY)).records.find(item=>item.id==='new').notes,'retain');
});
