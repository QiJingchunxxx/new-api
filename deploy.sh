#!/usr/bin/env sh
# 二次开发分支的部署脚本。
#
# 用法：
#   ./deploy.sh --registry      【服务器推荐】从镜像仓库拉取，不在本机编译
#   ./deploy.sh                 本机构建镜像后部署（需要 Docker + 内存 ≥ 2G）
#   ./deploy.sh --clean         本机构建，并在部署前清掉上游官方镜像与残留容器
#   ./deploy.sh --pull          构建时顺带拉取 bun / golang / debian 基础镜像
#   ./deploy.sh --registry --clean   可组合
#
# --registry 需要在同目录的 .env 里配置（否则会拉取本地 tag 而失败）：
#   NEW_API_IMAGE=ghcr.io/<你的 GitHub 用户名小写>/new-api:latest
#   NEW_API_PULL_POLICY=always
#
# 说明：慢的是"从源码构建镜像"这一步，不是 --clean。
#   1核2G 的服务器请一律使用 --registry，镜像交给 GitHub Actions 构建。
#   想在本机构建时：只改 Go 代码 → 前端层命中缓存；改了前端 → 重跑 bun install / build。
#
# 安全说明：--clean 只删除容器与镜像，永远不会触碰数据卷（不执行 down -v / volume rm）。
# 执行顺序刻意是「先构建/拉取、后清理、再启动」：切换前旧容器仍在服务，只有最后几秒中断。
set -e

cd "$(dirname "$0")"

CUSTOM_IMAGE='new-api-custom:latest'
UPSTREAM_REPO='calciumion/new-api'
SERVICE='new-api'
ENV_FILE='.env'

PULL=0
CLEAN=0
REGISTRY=0
for arg in "$@"; do
  case "$arg" in
    --pull) PULL=1 ;;
    --clean) CLEAN=1 ;;
    --registry) REGISTRY=1 ;;
    *)
      echo "未知参数：$arg" >&2
      echo "可用参数：--registry、--pull、--clean" >&2
      exit 1
      ;;
  esac
done

if ! docker compose version >/dev/null 2>&1; then
  echo "未找到 docker compose 插件，请先安装 Docker Compose v2" >&2
  exit 1
fi

# .env 里的 NEW_API_IMAGE 决定实际使用的镜像；没有就用本地构建的 tag
if [ -f "$ENV_FILE" ]; then
  env_image=$(grep -E '^NEW_API_IMAGE=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
EXPECTED_IMAGE=${env_image:-$CUSTOM_IMAGE}

if [ "$REGISTRY" = '1' ]; then
  if [ -z "$env_image" ]; then
    echo "警告：$ENV_FILE 里没有配置 NEW_API_IMAGE，将按本地 tag 拉取（可能失败）。" >&2
    echo "      请在该文件里添加：NEW_API_IMAGE=ghcr.io/<你的用户名小写>/new-api:latest" >&2
  fi
  echo "==> 从镜像仓库拉取 $EXPECTED_IMAGE（不在本机编译）"
  docker compose pull "$SERVICE"
else
  echo "==> 构建镜像 $EXPECTED_IMAGE（首次 5-20 分钟，之后有层缓存会快很多）"
  echo "    1核2G 服务器请改用：./deploy.sh --registry"
  echo "    想看每一步耗时：DOCKER_BUILDKIT=1 docker compose build --progress=plain $SERVICE"
  if [ "$PULL" = '1' ]; then
    docker compose build --pull "$SERVICE"
  else
    docker compose build "$SERVICE"
  fi
fi

if [ "$CLEAN" = '1' ]; then
  echo "==> 清理旧容器与上游官方镜像（数据卷不受影响）"

  if docker ps -a --format '{{.Names}}' | grep -qx "$SERVICE"; then
    # 容器若不属于当前 compose 项目（例如当初用 docker run 起的），退回 docker rm
    docker compose rm -sf "$SERVICE" >/dev/null 2>&1 || docker rm -f "$SERVICE" >/dev/null 2>&1 || true
    echo "    已移除容器 $SERVICE"
  else
    echo "    未发现容器 $SERVICE"
  fi

  upstream_refs=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${UPSTREAM_REPO}:" || true)
  if [ -n "$upstream_refs" ]; then
    for ref in $upstream_refs; do
      if docker image rm "$ref" >/dev/null 2>&1; then
        echo "    已删除镜像 $ref"
      else
        echo "    跳过 $ref（可能仍被其它容器占用）"
      fi
    done
  else
    echo "    未发现 $UPSTREAM_REPO 镜像"
  fi

  # 只清悬空镜像；不要用 -a，那会连基础镜像缓存一起删掉，下次构建会变得很慢
  docker image prune -f >/dev/null 2>&1 || true

  if docker ps --format '{{.Names}}' | grep -qi watchtower; then
    echo "    警告：检测到 watchtower 正在运行，它会尝试自动拉取镜像，建议停掉它" >&2
  fi
fi

echo "==> 重建容器"
docker compose up -d "$SERVICE"

echo "==> 容器状态"
docker compose ps "$SERVICE"

echo "==> 自检"
running_image=$(docker inspect "$SERVICE" --format '{{.Config.Image}}' 2>/dev/null || true)
if [ "$running_image" = "$EXPECTED_IMAGE" ]; then
  echo "    OK：运行中的镜像为 $running_image"
else
  echo "    警告：运行中的镜像为 '$running_image'，预期 $EXPECTED_IMAGE，请检查 docker-compose.yml / .env" >&2
fi
echo "    验证接口：curl -s http://localhost:3000/api/home_landing（本分支特有，官方镜像必为 404）"
