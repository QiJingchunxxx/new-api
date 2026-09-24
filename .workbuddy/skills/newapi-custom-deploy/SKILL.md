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

## 排障：`./deploy.sh` 报「未知参数：--registry」

说明服务器上的脚本是旧版 = 服务器**没有真的拉到最新代码**。按顺序查：

```bash
cd /opt/new-api
git status -sb            # 看是否 [behind N]
git log --oneline -1      # 是否等于开发机的最新提交
grep -c registry deploy.sh
```

1. **`[behind N]` + `grep` 为 0** → 就是没拉成功。若 `git status` 显示工作区有大量 `M`/`??` 文件（尤其 `?? deploy.sh`），
   说明服务器这份代码是**从开发机手工拷贝过来的**，未提交改动挡住了 pull。这些改动在 fork 的提交里已经有了，属于冗余，安全做法：
   ```bash
   git fetch origin
   git stash push -u -m "server-wip-$(date +%Y%m%d%H%M)"   # -u 只收未跟踪文件，不动 .env / data / logs(均被 gitignore)
   git pull --ff-only
   grep -c registry deploy.sh                              # 应 ≥2
   git stash drop                                          # 确认无误后清掉
   ```
   紧急兜底（会同时删掉未跟踪的 `.workbuddy/`）：`git checkout -- . && git clean -fd && git pull --ff-only`
2. **`git remote -v` 的 origin 不是自己的 fork** → `git remote set-url origin <fork>` 后 `git fetch origin && git reset --hard origin/main`。
3. **不在 main 上（detached HEAD 或别的分支）** → `git checkout main && git pull --ff-only`。

安全前提（已核实）：仓库不跟踪任何 `data/`、`logs/` 文件，`.gitignore` 含 `logs`、`.env`、`/data/`、`web/node_modules`、`web/dist`
→ 上述 git 操作不会碰到数据库、日志、`.env`。

## 排障：`docker pull ghcr.io/...` 报 `unauthorized` / `denied: denied`

先分清「镜像不存在」还是「没权限」，两条匿名命令就能判定（仓库公开时无需登录）：

```bash
# 1) 构建到底成没成功？（看 conclusion 与 head_sha）
curl -s "https://api.github.com/repos/<owner>/<repo>/actions/runs?per_page=5" \
  | python -c "import sys,json;[print(r['name'],r['status'],r['conclusion'],r['head_sha'][:7]) for r in json.load(sys.stdin)['workflow_runs']]"

# 2) 包是公开还是私有？（token 为空 / 403 = 私有；能拿到 token 并能读 tags/list = 公开）
curl -s "https://ghcr.io/token?scope=repository:<owner小写>/new-api:pull&service=ghcr.io"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <上一步的 token>" \
  "https://ghcr.io/v2/<owner小写>/new-api/tags/list"
```

GHCR 对「包私有」和「包不存在」返回同样的错误，所以**必须先分开这两件事**再动手修。

1. Actions 里什么都没有 → fork 默认禁用 Actions：`/actions` 点 "I understand my workflows, go ahead and enable them"，再手动 Run workflow。
2. 构建成功但拉不到 → 包是私有的（GHCR 包默认私有）。

拉私有包的两种方式：

- **改公开（最省事）**：包设置页的地址是
  `https://github.com/<owner>/<repo>/pkgs/container/new-api/settings`（或 `https://github.com/users/<owner>/packages/container/new-api/settings`）
  → Danger Zone → Change **package** visibility → Public。
  **极易点错**：仓库设置页（`/<owner>/<repo>/settings`）的 Danger Zone 写的是 "Change **repository** visibility / Archive this repository"，
  和包完全无关；包页面才会出现 "Change **package** visibility / Delete this package"。
  镜像里只有编译产物，用户贡献的 Key 在数据库里、不打进镜像，所以公开的风险主要是自定义代码可见。
- **服务器登录**：必须是 **classic PAT**（细粒度 PAT 不支持 GHCR！）且只勾 `read:packages`：
  ```bash
  read -rsp "粘贴 PAT 后回车: " GHCR_PAT \
    && echo "$GHCR_PAT" | docker login ghcr.io -u <用户名> --password-stdin \
    && unset GHCR_PAT
  ```
  用 `read -s` 是为了不让令牌进 bash history、不显示在屏幕上。

`denied: denied` 的常见原因，按概率排序：
1. **把占位符的尖括号一起复制进去了**（如 `echo "<ghp_xxx>"`）——令牌里不能有 `<` `>`；
2. 用的是细粒度 PAT（GHCR 不认）；
3. classic PAT 没勾 `read:packages`；
4. 令牌过期或被撤销。

登录失败不会写入凭据；若怀疑残留，先 `docker logout ghcr.io` 再试。

**永远不要向聊天/工单里粘贴真实的 PAT**：一旦贴出就应视为泄露，立即在 GitHub 上 Delete。

## 铁律：只走 git 同步代码

不要在服务器上通过 WinSCP / 宝塔 / 压缩包覆盖的方式更新代码 —— 那会让工作区出现「同名但内容不同」的未跟踪文件，
`git status` 永远脏、`git pull` 随时被挡，就是上面第 1 条故障的根因。服务器的更新方式只有：

```bash
git pull && ./deploy.sh --registry
```

## 本机验证部署文件的手段（无 Docker）

- YAML 语法：`"C:/Users/15828/.workbuddy/binaries/python/envs/default/Scripts/python.exe" -c "import yaml; yaml.safe_load(open('docker-compose.yml',encoding='utf-8'))"`（该 venv 已装 pyyaml）
- Shell 语法：`sh -n deploy.sh`
- 逻辑验证：造一个假 `docker` 放进临时目录并前置到 PATH，跑 `sh deploy.sh --registry --clean`，检查输出分支与退出码（已验证：有/无 .env、--clean、非法参数）
