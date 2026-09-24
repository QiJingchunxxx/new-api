# new-api 二次开发 · 长期项目笔记

## 项目定位
- fork 自 QuantumNous/new-api，远端 `github.com/QiJingchunxxx/new-api`（分支 `main`）。
  **这是二次开发分支，禁止回退到官方镜像 `calciumion/new-api:latest`。**
- 自研功能：贡献上游 Key（用户提交供应商 Key 换每日额度）、共享号池（多 Key 轮询 + 失败无痕切换）、
  首页落地页装修、FAQ 使用指南页、钱包「每日额度」。

## 部署链路（重要）
- 服务器 **1核2G，不能本地构建**（bun install + go build 会 OOM 并拖死 postgres）。
- 链路：本地 `git push` → GitHub Actions（`.github/workflows/build-image.yml`）构建
  → GHCR `ghcr.io/qijingchunxxx/new-api:latest` → 服务器 `git pull && ./deploy.sh --registry`。
- 服务器目录 `/opt/new-api`，`.env` 里配 `NEW_API_IMAGE` 与 `NEW_API_PULL_POLICY=always`。
- 服务器上的代码**只能**通过 `git pull` 同步；严禁用 WinSCP / 宝塔覆盖式上传
  （会造成 git 工作区永远脏、`git pull` 被挡住，且用户会误以为代码已更新）。
- 数据卷：`./data`、`./logs`、`pg_data`。部署脚本一律不许带 `-v`。
- 记忆日志目录 `.workbuddy/` 已被提交进仓库，会出现在 `git status` 里。

## 产品偏好（用户明确要求，写新界面前先回顾）
- **用户端不显示任何内部机制说明与免责声明**：定期检查、额度自动回收、"提交即表示同意…"。
  这类内容只放管理端和代码注释。
- 用户端**绝不暴露**：上游 API 地址、上游原始报错、号池渠道编号、其他用户的 Key。
- 审美要求高，不接受框架默认样式；落地页要接近大厂官网质感。
- 文案必须中英双语：i18n key 用英文原文，`zh.json` 补中文。**前端露出英文 = bug**。
- 管理端展示的数字/状态必须来自真实数据，不要造假数据占位。
- **页面上不出现上游项目品牌**：`new-api` / `New API` / `QuantumNous` / `docs.newapi.pro`
  的署名、外链、默认站点名、文档入口一律去掉（页脚只保留本站自己的信息）。
  例外：第三方客户端配置格式的 `id: 'new-api'` 是协议标识符，不能改。
- 站点名默认值用中性的 `AI Gateway`，用户会去后台改成自己的品牌名。

## 技术约定
- 配置项：`setting/operation_setting/xxx_setting.go` + `config.GlobalConfig.Register`；
  键名不要以 `Key` / `Secret` / `Token` 结尾（`GET /api/option/` 会过滤掉）。
- **改代码里的配置默认值，对"后台已保存过该项"的实例无效**（数据库值优先），必须让用户在后台改。
- 共享号池三条硬前提：渠道 `IsMultiKey + polling`、`AutoBan=1`、`common.RetryTimes ≥ 1`。

## 用户习惯
- 中文沟通，喜欢直接给可复制的命令；会把服务器报错原文整段贴过来。
- 排障时优先看硬证据：`[behind N]`、镜像名、`grep -c` 的输出。
- 对密钥不敏感，**多次把 PAT 直接贴进对话**，每次都要提醒立即撤销。
