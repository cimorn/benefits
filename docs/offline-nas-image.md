# NAS 离线导入镜像

仓库和 GHCR 包保持私有时，可在 GitHub Actions 手动运行 **Build private NAS offline image**，选择 NAS 的 CPU 架构。Intel、AMD 的 x86-64 NAS 选择 `linux/amd64`；ARM64 NAS 选择 `linux/arm64`。工作流先运行全部测试，再构建并导出单一架构的 Docker 镜像。

构建成功后，从该次运行的 Artifacts 下载 `benefits-offline-架构-提交号`。产物仅对有仓库访问权限的人开放，保留 7 天，包含：

- `benefits-提交号-架构.tar.gz`：可由 Docker 导入的压缩镜像。
- 同名 `.tar.gz.sha256`：压缩文件的 SHA-256 校验值。
- `image.txt`：镜像架构、镜像 ID、源码提交号及构建记录。

解压 GitHub 的下载 ZIP 后，将 `.tar.gz` 上传到 NAS 的私人目录。通过 NAS 的 Docker 镜像界面导入，或在 NAS 执行：

```sh
docker load --input benefits-提交号-架构.tar.gz
```

镜像包含 `ghcr.io/cimorn/benefits:latest` 和对应的 `sha-提交号` 标签。离线部署时，将实际使用的 Compose 中 `benefits` 服务的 `pull_policy: always` 改为 `pull_policy: never`，然后部署；否则 Compose 会再次请求私有 GHCR。命令行也可显式禁止拉取：

```sh
docker compose --env-file deploy/nas/.env up -d --pull never
```

`mongo:7.0` 镜像仍须事先存在于 NAS，或由 NAS 从 Docker Hub 拉取。离线产物只包含 Benefits 应用镜像，不含数据库镜像、登录密码、环境文件或权益记录。

程序升级后可再次运行此工作流，导入新的镜像，再重建 `benefits` 应用服务。保留 `mongodb-benefits`、`deploy/nas/.env` 和 `/volume1/docker/mongodb/data/benefits`。现有 GHCR 发布工作流照常运行。
