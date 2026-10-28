/* 首次打开时预置常用权益，个人到期日期待填写。 */
const initialBenefits = (() => {
  const records = [];
  function add(category, owner, rows, selection = {}) {
    rows.forEach((row, index) => records.push({
      id: `initial-${category}-${selection.key || 'default'}-${index}`,
      name: row.title, owner, expires: '',
      type: category === 'apple' || category === 'dji' ? '设备维修' : '购物 / 生活',
      count: row.count || '',
      notes: `${row.highlightKey ? selection[row.highlightKey] : row.highlight}。${row.detail}`
    }));
  }
  add('taobao', '淘宝 88VIP · 全能卡', handbookData.taobao.rows.filter(row => !row.only || row.only.includes('all')));
  add('jd', '京东 PLUS', handbookData.jd.rows);
  add('apple', 'iPad AppleCare+', handbookData.apple.variants['ipad-new'].rows.map(row => ({...row, detail: `${row.detail}${row.title === '仅屏幕损坏' ? '适用 iPad A16、mini A17 Pro、Air M2/M3/M4、Pro M4/M5；其他机型意外损坏为 368 元/次。' : ''}`})));
  for (const key of ['action6', 'pocket4']) {
    const device = handbookData.dji.variants[key];
    add('dji', device.label, [
      {...handbookData.dji.rows[0], count:'1 年版 2 次 / 2 年版 4 次', detail:`${handbookData.dji.rows[0].detail}1 年版 2 次，2 年版 4 次；不含遗失、被盗。`},
      handbookData.dji.rows[2],
      { title:'售后双向包邮', highlight:'符合服务范围的寄件免运费', detail:'使用官方指定的寄修和寄件服务。' }
    ], {...device,key});
  }
  return records;
})();
