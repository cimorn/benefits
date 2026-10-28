const test = require('node:test');
const assert = require('node:assert/strict');
let model = {};
try { model = require('./model.js'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const ready = name => { assert.equal(typeof model[name], 'function', `${name} 尚未实现`); return model[name]; };
const record = (id, expires = '') => ({id,name:'测试权益',owner:'我的88VIP',expires,type:'购物',count:'',notes:''});
const memory = raw => ({raw,getItem(){return this.raw ?? null;},setItem(key,value){this.raw=value;}});

test('到期当天仍属于即将到期，昨天已过期，第30天包含，第31天不包含', () => {
 const expiry=ready('expiry');
 assert.equal(expiry('2026-10-27','2026-10-27').kind,'expiring');
 assert.equal(expiry('2026-10-26','2026-10-27').kind,'expired');
 assert.equal(expiry('2026-11-26','2026-10-27').kind,'expiring');
 assert.equal(expiry('2026-11-27','2026-10-27').kind,'active');
});
test('未填写日期不计为有效或即将到期', () => {assert.equal(ready('expiry')('','2026-10-27').kind,'undated');});
test('按日历日计算，跨夏令时和闰日不多算或少算', () => {
 const expiry=ready('expiry'); assert.equal(expiry('2026-11-02','2026-11-01').days,1); assert.equal(expiry('2028-03-01','2028-02-28').days,2);
});
test('数量按记录数统计，次数字段不放大总数', () => {
 const records=[record('1'),record('2','2026-10-27'),record('3','2026-10-26'),record('4','2027-01-01')];records[0].count='无限次';
 assert.deepEqual(ready('summarize')(records,'2026-10-27'),{total:4,expiring:1,expired:1,undated:1});
});
test('无效日期拒绝保存；空日期允许保存', () => {
 const normalize=ready('normalize'); assert.throws(()=>normalize(record('1','2026-02-30')),/日期/);assert.equal(normalize(record('1')).expires,'');
});
test('空名称与空所属拒绝保存，自定义所属可保存', () => {
 const normalize=ready('normalize');assert.throws(()=>normalize({...record('1'),name:' '}),/名称/);assert.throws(()=>normalize({...record('1'),owner:' '}),/所属/);assert.equal(normalize({...record('1'),owner:'我的视频会员'}).owner,'我的视频会员');
});
test('保存后再读取，编辑内容和到期日保持一致', () => {
 const save=ready('save'),read=ready('read'),storage=memory();const items=[{...record('1','2027-05-01'),notes:'个人备注'}];save(storage,items);assert.deepEqual(read(storage,[]),items);
});
test('删除全部后保持空台账，不重新填入默认权益', () => {
 const save=ready('save'),read=ready('read'),storage=memory();save(storage,[]);assert.deepEqual(read(storage,[record('default')]),[]);
});
test('存储失败抛出错误，原记录不变化', () => {
 const save=ready('save'),items=[record('1')],storage={setItem(){throw Error('quota');}};assert.throws(()=>save(storage,items),/quota/);assert.equal(items[0].expires,'');
});
test('损坏的本地数据不能静默替换成默认权益', () => {assert.throws(()=>ready('read')(memory('{broken'),[record('default')]),/数据/);});
test('备份导入拒绝重复ID和未知版本', () => {
 const decode=ready('decode');assert.throws(()=>decode(JSON.stringify({version:1,records:[record('1'),record('1')]})),/重复/);assert.throws(()=>decode(JSON.stringify({version:9,records:[]})),/版本/);
});
test('更新与删除仅影响目标记录', () => {
 const upsert=ready('upsert'),remove=ready('remove'),items=[record('1'),record('2')]; const edited=upsert(items,{...record('1'),notes:'已修改'});
 assert.equal(edited.length,2);assert.equal(edited[0].notes,'已修改');assert.equal(items[0].notes,'');assert.deepEqual(remove(edited,'1').map(r=>r.id),['2']);
});
test('旧版备份迁移：场景转为类型，其余保留字段不丢失', () => {
 const legacy={id:'legacy',category:'dji',name:'意外置换',owner:'Osmo Pocket 4',status:'使用中',expires:'2027-05-12',scene:'维修',count:'2 次',cycle:'每年',notes:'我的备注'};
 const migrated=ready('decode')(JSON.stringify({version:1,records:[legacy]}));
 assert.deepEqual(migrated,[{id:'legacy',name:'意外置换',owner:'Osmo Pocket 4',expires:'2027-05-12',type:'维修',count:'2 次',notes:'我的备注'}]);
});
test('新备份只包含统一所属、类型和保留字段，并可重新读取', () => {
 const encode=ready('encode'),decode=ready('decode'),items=[record('new','2027-06-01')];
 const document=JSON.parse(encode(items));assert.equal(document.version,2);assert.deepEqual(document.records,items);assert.deepEqual(decode(JSON.stringify(document)),items);
});
test('已有类型即使为空也不被旧场景覆盖', () => {
 assert.equal(ready('normalize')({...record('1'),type:'',scene:'旧场景'}).type,'');
});
