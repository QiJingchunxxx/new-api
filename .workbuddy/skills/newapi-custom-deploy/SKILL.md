---
name: newapi-custom-deploy
description: 二次开发分支 new-api（QiJingchunxxx/new-api fork）的构建与部署流程。当需要部署/更新/回滚自定义改动的 new-api、处理镜像来源、排查"服务器上改动不生效"或 Docker 构建太慢时使用。关键词：部署、deploy、docker compose、镜像、GHCR、1核2G、构建慢、改动不见了。
agent_created: true
---

# new-api 二次开发分支：构建与部署

仓库：`D:/Projects/newapi/new-api`（fork 自 QuantumNous/new-api，远端 `origin` = github.com/QiJingchunxxx/new-api，分支 `main`）。

## 核心约束（决定了整套方案）

- **生产服务器 1核2G，跑不动镜像构建**：`go build` + `rsbuild` 会 OOM 或耗时几十分钟，还会拖垮同机的 postgres/redis。
- **本机（开发用的 Windows）没有 Docker**（也没 Podman）。
- 所以：**构建放在 GitHub Actions，服务器只拉镜像**。

## 文件分工

| 文件 | 作用 |
|---|---|
| `.github/workflows/build-image.yml` | push 到 main（或手动触发）时在 GitHub 上构建，推到 `ghcr.io/<owner 小写>/new-api`，tag 为 `latest` + `sha-xxxxxxx` |
| `docker-compose.yml` | 双模式：`image: ${NEW_API_IMAGE:-new-api-custom:latest}`、`pull_policy: ${NEW_API_PULL_POLICY:-never}`，同时保留 `build:` 供构建机使用 |
| `.env`（gitignore，从 `.env.example` 抄） | 服务器上配 `NEW_API_IMAGE=ghcr.io/<用户名小写>/new-api:latest` + `NEW_API_PULL_POLICY=always` |
| `deploy.sh` | `--registry`（服务器：只拉不构建）/ 无参数（构建机：构建后部署）/ `--clean`（删旧容器 + 删 `calciumion/new-api:*` 镜像）/ `--pull`（构建时拉基础镜像） |

## 标准发布流程

```bash
# 开发机
git add -A && git commit -m "..." && git push          # → 触发 Actions 构建（约 5-10 分钟）

# 服务器
git pull
./deploy.sh --registry                                  # 或 --registry --clean（首次迁移时）
curl -s http://localhost:3000/api/home_landing          # 返回 JSON = 新代码已生效
```

回滚：GHCR 上每个提交都有 `sha-xxxxxxx` tag。
`NEW_API_IMAGE=ghcr.io/<用户名>/new-api:sha-abc1234` 然后重新 `--registry` 即可。

## 必须记住的坑

1. **GHCR 镜像名必须全小写**，而 GitHub 用户名可能含大写 → workflow 里用 `echo "name=ghcr.io/${GITHUB_REPOSITORY_OWNER,,}/new-api"` 转小写，不要直接拼 `${{ github.repository_owner }}`。
2. **GHCR 包默认是私有的**：要么在 GitHub 上把 package 可见性改成 public，要么服务器上 `echo $PAT | docker login ghcr.io -u <用户名> --password-stdin`（PAT 需 `read:packages`）。
3. **绝对不要 `docker compose down -v`**：会删 `pg_data` / `./data` 卷 = 删库。`deploy.sh` 里没有任何 volume 操作。
4. **不要 `docker image prune -a`**（会删基础镜像缓存，下次构建变很慢）；只用 `-f`（悬空镜像）。
5. 上游 `docker-build.yml` 只在**打 tag** 时触发（推 `calciumion/new-api`，fork 上会失败）；`ci.yml` 只在 PR 时触发。所以 push 到 main 不会跑出一堆失败的工作流 —— 但如果创建版本 tag 会。
6. 「服务器上改动不见了」的两类原因：① 用的是官方镜像（镜像里根本没有源码）；② 改了代码但没重建/重拉镜像。UI 里改的配置存在数据库，所以会保留，容易造成"有的改了有的没改"的错觉。
7. 想在服务器上构建只想临时救急时，至少加 4G swap 并停掉其它容器，但**不推荐**。

## 本机验证部署文件的手段（无 Docker）

- YAML 语法：`"C:/Users/15828/.workbuddy/binaries/python/envs/default/Scripts/python.exe" -c "import yaml; yaml.safe_load(open('docker-compose.yml',encoding='utf-8'))"`（该 venv 已装 pyyaml）
- Shell 语法：`sh -n deploy.sh`
- 逻辑验证：造一个假 `docker` 放进临时目录并前置到 PATH，跑 `sh deploy.sh --registry --clean`，检查输出分支与退出码（已验证：有/无 .env、--clean、非法参数）
