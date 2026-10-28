/* 公开权益资料。金额均为人民币；来源与核对时间见页面底部。 */
const handbookData = {
  taobao: {
    name: '淘宝 88VIP', mark: '88VIP', description: '购物优惠与生活特权',
    action: ['官方权益规则', 'https://pages.tmall.com/wow/z/member-club/default/89RZJ2IFLT7'],
    selectorLabel: '年卡类型', defaultVariant: 'all',
    variants: { all: { label: '全能卡' }, shopping: { label: '购物卡' }, life: { label: '生活卡' } },
    rows: [
      { title: '购物折上 95 折', highlight: '带 88VIP 标识的商品适用', detail: '在其他优惠后再打 95 折；部分商品共用每月 500 元优惠上限。', how: '商品页看标识\n结算时确认优惠' },
      { title: '退货包运费', highlight: '每单 ≤ 25 元，每月 ≤ 50 元', detail: '每张年卡累计上限 288 元。先扣运费险等保障，再补剩余运费。', how: '订单 → 退货退款\n选择官方寄件' },
      { title: '每日 2 元红包', highlight: '满 2.01 元可用，当天有效', detail: '每日自动发放，24 小时到期；不累积到第二天。', how: '我的淘宝 → 我的权益\n→ 红包', only: ['all', 'shopping'] },
      { title: '联名会员', highlight: '视频、音乐、外卖等权益', detail: '在会员中心选择权益，领取并绑定对应账号；具体组合看卡种。', how: '我的淘宝 → 88VIP\n→ 生活权益', only: ['all', 'life'] },
      { title: '售后保障包', highlight: '破损、少件、质量问题可求助', detail: '与商家沟通未解决时，提交凭证，由专属客服跟进。', how: '我的淘宝 → 88VIP\n→ 专属客服', only: ['all', 'shopping'] }
    ],
    notes: {
      all: ['联名会员需要领取并绑定账号，开通 88VIP 不等于自动到账。', '退货运费额度不适用于维修寄件；月额度按会员周期计算。'],
      shopping: ['购物卡的联名会员是否提供，以开卡页面和会员中心为准。', '退货运费额度不适用于维修寄件；月额度按会员周期计算。'],
      life: ['生活卡不含每日 2 元红包和售后保障包；联名会员需手动领取。', '退货运费额度不适用于维修寄件；月额度按会员周期计算。']
    },
    sources: [['88VIP 权益规则（2026-09-29 生效）', 'https://pages.tmall.com/wow/z/member-club/default/89RZJ2IFLT7'], ['88VIP 会员服务协议', 'https://terms.alicdn.com/legal-agreement/terms/suit_bu1_tmall/suit_bu1_tmall201903151049_99115.html']]
  },
  jd: {
    name: '京东 PLUS', mark: 'PLUS', description: '自营购物与售后服务',
    action: ['进入会员中心', 'https://plus.jd.com/'],
    rows: [
      { title: '自营无限免邮', highlight: '京东自营商品享免邮', detail: '第三方店铺不在此权益内；特殊运费项目以结算页为准。', how: '购买自营商品\n结算时查看运费' },
      { title: '免费上门退换', highlight: '符合条件的自营售后免运费', detail: '退换货或维修申请审核通过后，可在服务覆盖范围内预约上门取件。', how: '我的 → 退换 / 售后\n选择订单申请' },
      { title: '180 天只换不修', highlight: '带服务标识的商品，质量故障可换', detail: '正式 PLUS 会员适用。签收后 180 天内，硬件性能故障符合三包时，可使用 1 次。', how: '我的 → 退换 / 售后\n申请维修并等待检测' },
      { title: '会员价与专享券', highlight: 'PLUS 专享价，领券后再下单', detail: '只适用标注商品和符合门槛的订单；不是全站统一折扣。', how: 'PLUS 会员中心领券\n商品页查看 PLUS 价' },
      { title: '生活服务包', highlight: '用积分兑换生活服务', detail: '可兑项目、所需积分、次数和可用城市，在兑换页面查看。', how: 'PLUS 会员中心\n→ 生活服务包' }
    ],
    notes: ['180 天只换不修适用于带标识的商品及符合条件的质量故障，不覆盖摔坏、进水等意外。', '换新仅限 1 次，换新后不重新计算 180 天；先申请售后，再按审核要求寄件。'],
    sources: [['京东 PLUS 无限免邮', 'https://help.jd.com/user/issue/893-4380.html'], ['PLUS 免费上门退换说明', 'https://wqs.jd.com/my/vipplus_refund.shtml'], ['180 天只换不修规则', 'https://help.jd.com/user/issue/321-4542.html'], ['PLUS 权益与优惠项目', 'https://help.jd.com/user/issue/965-4551.html']]
  },
  apple: {
    name: 'AppleCare+', mark: 'Care+', description: '意外损坏维修与电池服务',
    action: ['预约官方维修', 'https://support.apple.com/zh-cn/repair'],
    selectorLabel: '设备', defaultVariant: 'ipad-new',
    variants: {
      'ipad-new': { label: 'iPad · 新款机型', rows: [
        { title: '仅屏幕损坏', highlight: '188 元 / 次', detail: '只损坏屏幕、没有其他损伤时适用；整机快速更换按其他意外收费。', how: 'Apple 支持 App\n选择 iPad → 维修' },
        { title: '其他意外损坏', highlight: '628 元 / 次', detail: '包括符合保障条件的摔坏、进液等；保障有效期内不限次数。', how: 'Apple Store 或\nApple 授权服务商' },
        { title: '电池服务', highlight: '容量低于原始容量 80%：0 元', detail: '经官方检测符合条件，可免额外费用更换电池。', how: '预约检测电池' },
        { title: 'Pencil 与键盘', highlight: '188 元 / 次', detail: '保障范围内的 Apple Pencil、Pencil Pro 或 Apple 品牌 iPad 键盘意外损坏。', how: '预约时说明配件问题' }
      ], notes: ['此档适用：iPad（A16）、mini（A17 Pro）、Air（M2 / M3 / M4）、Pro（M4 / M5）。其他型号请选择“iPad · 其他机型”。', '金额为已购买 AppleCare+ 后的单次服务费。旧计划按购买日期查询对应条款；遗失、被盗和不影响功能的外观损伤不在保障内。'] },
      'ipad-other': { label: 'iPad · 其他机型', rows: [
        { title: '意外损坏维修', highlight: '368 元 / 次', detail: '此档不单设 188 元屏幕维修价；符合保障条件的屏幕损坏、摔坏、进液等按此收费。', how: 'Apple 支持 App\n选择 iPad → 维修' },
        { title: '电池服务', highlight: '容量低于原始容量 80%：0 元', detail: '经官方检测符合条件，可免额外费用更换电池。', how: '预约检测电池' },
        { title: 'Pencil 与键盘', highlight: '188 元 / 次', detail: '保障范围内的 Apple Pencil 或 Apple 品牌 iPad 键盘意外损坏。', how: '预约时说明配件问题' }
      ], notes: ['适用于未列入“新款机型”的 iPad，例如 iPad 第 10 代、mini 第 6 代、Air（M1）、Pro（M2）。', '金额为 AppleCare+ 有效期内的单次服务费，意外损坏不限次数。遗失、被盗和不影响功能的外观损伤不在保障内。'] },
      iphone: { label: 'iPhone', rows: [
        { title: '仅正面屏幕损坏', highlight: '188 元 / 次', detail: '只有正面屏幕损伤时适用；如还有机身等其他损伤，按其他意外收费。', how: 'Apple 支持 App\n选择 iPhone → 维修' },
        { title: '仅背面玻璃损坏', highlight: '188 元 / 次', detail: '不适用于 iPhone SE 或 iPhone 12 之前的机型。', how: '预约检测背面玻璃' },
        { title: '内屏 / 其他意外', highlight: '628 元 / 次', detail: '内屏损坏及符合保障条件的其他意外损坏；有效期内不限次数。', how: 'Apple Store 或\nApple 授权服务商' },
        { title: '电池服务', highlight: '容量低于原始容量 80%：0 元', detail: '经官方检测符合条件，可免额外费用更换电池。', how: '预约检测电池' }
      ], notes: ['金额为已购买 AppleCare+ 后的单次服务费。屏幕、背玻璃专属价格须符合单独损坏条件。', '按 2026-10-16 起购买计划的条款整理，其他屏幕类别及旧计划请查对应条款；遗失、被盗不在保障内。'] },
      mac: { label: 'Mac · 非 Neo 机型', rows: [
        { title: '屏幕或外壳损坏', highlight: '799 元 / 次', detail: '只有屏幕或外壳损伤时适用；如有其他损坏，按下档收费。', how: 'Apple 支持 App\n选择 Mac → 维修' },
        { title: '其他意外损坏', highlight: '2,299 元 / 次', detail: '包括符合保障条件的进液等；保障有效期内不限次数。', how: 'Apple Store 或\nApple 授权服务商' },
        { title: '电池服务', highlight: '容量低于原始容量 80%：0 元', detail: '适用于配有电池的 Mac，须经官方检测符合条件。', how: '预约检测电池' }
      ], notes: ['此档不适用于 MacBook Neo；该机型请在上方单独选择。', '金额为 AppleCare+ 单次服务费。旧计划按购买日期查条款；遗失、被盗和不影响功能的外观损伤不在保障内。'] },
      'mac-neo': { label: 'MacBook Neo', rows: [
        { title: '屏幕或外壳损坏', highlight: '399 元 / 次', detail: '仅适用于 13 英寸 MacBook Neo（A18 Pro），且没有其他损坏。', how: 'Apple 支持 App\n选择 Mac → 维修' },
        { title: '其他意外损坏', highlight: '1,199 元 / 次', detail: '包括符合保障条件的进液等；保障有效期内不限次数。', how: 'Apple Store 或\nApple 授权服务商' },
        { title: '电池服务', highlight: '容量低于原始容量 80%：0 元', detail: '经官方检测符合条件，可免额外费用更换电池。', how: '预约检测电池' }
      ], notes: ['上述价格专用于 MacBook Neo（13 英寸，A18 Pro）。其他 Mac 请切换至“非 Neo 机型”。', '金额为 AppleCare+ 单次服务费。旧计划按购买日期查条款；遗失、被盗和不影响功能的外观损伤不在保障内。'] }
    },
    sources: [['AppleCare+ 中国大陆介绍', 'https://www.apple.com.cn/applecare/'], ['iPhone / iPad 条款（按购买日期选择）', 'https://www.apple.com.cn/legal/sales-support/applecare/applecareplus/cn/'], ['iPhone / iPad 现行费用条款 · PDF', 'https://www.apple.com.cn/legal/sales-support/applecare/applecareplus/2610/261016_applecareplusch.pdf'], ['Mac 条款（按购买日期选择）', 'https://www.apple.com.cn/legal/sales-support/applecare/applecareplus/cn/mac/'], ['Mac 现行费用条款 · PDF', 'https://www.apple.com.cn/legal/sales-support/applecare/applecareplus/2603/260302_applecareplusmac_prc_tc.pdf']]
  },
  dji: {
    name: 'DJI Care 随心换', mark: 'DJI Care', description: '意外损坏置换与官方维修',
    action: ['申请官方寄修', 'https://repair.dji.com/cn/repair/index'],
    selectorLabel: '设备', defaultVariant: 'action6',
    variants: {
      action6: { label: 'Osmo Action 6', purchase: '189 元 / 1 年 · 299 元 / 2 年', replacement: '169 元 / 次' },
      pocket4: { label: 'Osmo Pocket 4', purchase: '219 元 / 1 年 · 349 元 / 2 年', replacement: '219 元 / 次' }
    },
    rows: [
      { title: '意外损坏置换', highlightKey: 'replacement', detail: '符合保障范围的摔坏、进水等，寄回设备并支付置换费，可换同型号设备。', how: 'DJI 大疆服务小程序\n→ 自助服务 → 极速换新' },
      { title: '次数与有效期', highlight: '1 年版 2 次；2 年版 4 次', detail: '每次置换都需另外付费，次数在对应保障期内使用。', how: 'DJI 大疆服务小程序\n→ 设备信息查询' },
      { title: '性能故障维修', highlight: '保修范围内的非人为故障免费', detail: '先申请检测，区分保修维修和付费置换；不要直接把质量故障当作意外置换。', how: '自助寄修\n检测后确认处理方案' },
      { title: '寄修与极速换新', highlight: '普通寄修可先检测，再选方案', detail: '极速换新适合已确认的意外损坏；符合服务范围的寄件享双向包邮。', how: '需要先检测：自助寄修\n确定用次数：极速换新' }
    ],
    notes: ['Action 6 与 Pocket 4 是手持设备，不含无人机飞丢保障；遗失、被盗不能用损坏置换。', '保障购买费与单次置换费分开计算。先查剩余次数，小故障也可以选择普通维修。'],
    sources: [['DJI Care 各机型购买与置换费用', 'https://repair.dji.com/help/content?customId=01700008375&documentType=&lang=zh-CN&paperDocType=ARTICLE&re=CN&spaceId=17'], ['DJI Care 随心换使用指南', 'https://repair.dji.com/help/content?customId=zh-cn03400006885&lang=zh-CN&re=CN&spaceId=34'], ['Osmo Pocket 4 售后政策', 'https://repair.dji.com/help/content?customId=01700043691&lang=zh-CN&paperDocType=ARTICLE&re=CN&spaceId=17']]
  }
};
