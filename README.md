# 权益手册

个人权益台账，按所属会员或设备整理。

## 打开

直接双击 `index.html`，无需安装依赖。台账可离线使用，官方来源链接需要联网。

也可以在本目录运行 `node server.cjs`，打开 http://127.0.0.1:4188 。端口被占用时，可通过环境变量 `HANDBOOK_PORT` 指定其他端口。有 npm 的环境也可运行 `npm start`。

## 内容

- 首次打开预置 20 项：淘宝 88VIP 5 项，京东 PLUS 5 项，iPad AppleCare+ 4 项，DJI Care 6 项（Action 6 和 Pocket 4 各 3 项）。
- 到期时间默认留空。可以新增、编辑、删除，或按所属批量填写到期时间。
- 只保留名称、所属、类型、到期时间、次数、备注；次数显示在权益名称下方。
- 总数按权益条目统计，不把“无限次”或置换次数放大为权益数量。
- 到期当天至未来 30 天计入“30 天内到期”；昨天及更早计为已过期；空日期单独统计。
- 点击顶部统计数字可查看对应清单；桌面左侧按所属切换，手机使用所属下拉框。新增权益时可填写已有或新的所属，导航自动更新。
- 只有一层所属，例如京东 PLUS、iPad AppleCare+、Osmo Action 6、Osmo Pocket 4。
- 背景采用两层轻微视差，权益条目进入视口时上滑显示。系统开启“减少动态效果”时直接显示内容；保存编辑后的内容立即显示。

预置备注采用中国大陆公开资料，核对日期为 2026-10-27。页面底部可展开官方来源。个人记录由你修改，资料不会自动覆盖你的备注。Apple 旧计划和具体机型按对应购买条款核对费用。

## 本机保存与备份

点击“保存到本机”后写入当前浏览器的 localStorage，刷新和关闭页面后可恢复。可在页脚导出 JSON 备份或导入备份，导入前会显示替换数量并要求确认。

本地文件入口与 http://127.0.0.1:4188 属于不同存储位置，建议固定使用一个入口。换浏览器或电脑时使用导出 / 导入备份迁移；清除网站数据会清除该浏览器的台账。

## NAS 与 MongoDB

配置 MongoDB 后进入云端模式：登录后读取 NAS 数据，点击保存会同步到数据库。编辑时会保留本机草稿；其他设备已保存新版本时，旧编辑会提示冲突，并保留草稿供导出。云端为空时不会自动上传默认数据，可明确选择导入备份或使用预置权益。

- GitHub：`cimorn/benefits`；镜像：`ghcr.io/cimorn/benefits:latest`。
- 项目和应用容器：`benefits`；数据库容器：`mongodb-benefits`。
- 数据库：`benefits`；独立数据库账号：`benefits_app`。
- NAS 项目目录：`/volume1/docker/benefits`。
- NAS 数据目录：`/volume1/docker/mongodb/data/benefits`，映射到 MongoDB 的 `/data/db`。
- 默认应用端口：NAS `18188` → 容器 `3000`；MongoDB 不发布主机端口。
- 域名前缀：`benefits`。HTTPS 反向代理须保留配置的公开域名 Host。

将 `.env.example` 复制为 `deploy/nas/.env`，设置独立的访问密码、会话密钥、数据库密码和 `APP_ORIGIN`，再运行：

```sh
docker compose --env-file deploy/nas/.env up -d
```

更新应用时保留数据库、数据目录和私有环境文件：

```sh
docker compose --env-file deploy/nas/.env pull benefits
docker compose --env-file deploy/nas/.env up -d --no-deps benefits
```

GitHub Actions 会执行语法检查、单元测试和真实 MongoDB 集成测试，再发布 amd64/arm64 镜像。首次迁移使用原 localhost 页面导出的 JSON 备份，在 NAS 页面登录后导入；不同域名无法直接读取 localhost 的浏览器缓存。

## 维护

`data.js` 存放官方资料，`inventory.js` 定义首次打开的预置条目，`model.js` 负责日期和存储校验，`inventory-app.js` 负责交互，`styles.css` 控制外观。所属和到期筛选保存在 URL 中，支持收藏和浏览器前进、后退。已有本机台账不会因修改默认数据而被覆盖。

当前备份格式为版本 2。旧版缓存与版本 1 备份会自动迁移：“场景”转为“类型”，保留原所属、名称、到期时间、次数和备注，移除使用状态、周期与重复分类字段。

运行 `node --test model.test.cjs` 检查日期边界、数量统计、输入校验、保存恢复、删除和备份校验。可用 `node --check inventory-app.js` 检查前端脚本语法。有 npm 的环境可运行 `npm test` 和 `npm run check`。
