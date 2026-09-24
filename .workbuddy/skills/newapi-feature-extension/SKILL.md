---
name: newapi-feature-extension
description: 在 new-api（Go + React/TanStack Router + Base UI）仓库中新增一个"用户可见功能"的标准流程与踩坑清单。当需要给 new-api 增加业务功能、配置项、定时任务、后台管理页或落地页区块时使用。关键词：new-api、新增功能、配置组、AutoMigrate、定时任务、侧边栏、routeTree、i18n、System Settings。
agent_created: true
---

# new-api 功能扩展流程

本仓库：`D:/Projects/newapi/new-api`（Go 1.25 + Gin + GORM；前端 `web/` React 19 + TanStack Router，包管理器 **bun**）。

## 0. 环境前提（重要）

- 本机**没有 Go 工具链**，也**没有 bun**，因此 Go 侧无法编译验证；新增 Go 代码必须逐行自检（未使用 import、方法名、GORM 零值更新等）。
- 前端可以用一个"外挂"方式做类型检查（不需要 bun）：
  1. `cd web && npm install --legacy-peer-deps --no-audit --no-fund`（首次会报 `Cannot read properties of null (reading 'edgesOut')`，直接重试一次即可成功；约 5 分钟）；
  2. `./node_modules/.bin/tsgo -b`；
  3. 过滤掉环境噪声后再看结果：
     `./node_modules/.bin/tsgo -b 2>&1 | grep -v "__tests__\|\.test\.tsx\|\.test\.ts"`。
     残留的 `src/features/channels/api.ts` 报错是 npm 装的 axios 版本与 bun.lock 不一致导致的既有噪声，与本次改动无关。
  - ⚠️ npm 装的依赖树与 bun 不一致（缺 `antd`、`@lobehub/ui` 等 peer），**`rsbuild build` 跑不通**，不要指望用 npm 出包。
  - 验证完请清理：`rm -rf web/node_modules web/package-lock.json web/dist`，避免污染 bun 依赖树（删除这类目录在本机可能要绕过沙箱）。
- 真正出包仍需在有 bun 的机器上执行 `cd web && bun install && bun run build`（Go 用 `go:embed web/dist` 打包前端产物）。

## 1. 新增配置项（后台可改）

1. 新建 `setting/<域>/xxx_setting.go`（业务类放 `setting/operation_setting/`）。
2. 定义 struct，字段用 `json:"snake_case"`；在 `init()` 里 `config.GlobalConfig.Register("xxx_setting", &xxxSetting)`。
3. 选项键就是 `xxx_setting.<json_tag>`；`model/option.go` 的 `handleConfigUpdate` 会按 `.` 前缀自动热更新，**无需重启**。
4. 提供 `GetXxxSetting()` 读取。
5. **坑**：`GET /api/option/` 会过滤掉以 `Key` / `Secret` / `Token` / `api_key` 结尾的字段名 —— 配置字段不要这样命名。
6. 需要给普通用户/游客读取时，另加公开接口（见第 4 步），不要把 `/api/option/` 暴露出去。

## 2. 新增数据表

1. 在 `model/xxx.go` 定义 struct + `TableName()`。
2. 在 `model/main.go` 的 `DB.AutoMigrate(...)` 列表里加 `&Xxx{},`。
3. **坑**：MySQL 下 `text` 字段不能直接建唯一索引；要唯一约束时用 `varchar(64)` 存 sha256（`hex.EncodeToString(common.Sha256Raw(...))`）+ `uniqueIndex:idx_name` 组合索引。
4. 额度增减用现成函数：`IncreaseUserQuota` / `DecreaseUserQuota`（都拒绝负数）/ `DeltaUpdateUserQuota(id, delta)`（支持有符号增减）。
   金额→额度换算：`int(math.Round(amount * common.QuotaPerUnit))`（默认 500000 额度 = $1）。

## 3. 后台定时任务（多节点安全的写法）

参考 `service/subscription_reset_task.go`：

```go
var once sync.Once
func StartXxxTask() {
    once.Do(func() {
        if !common.IsMasterNode { return }
        gopool.Go(func() {
            ticker := time.NewTicker(time.Minute)
            defer ticker.Stop()
            runOnce()
            for range ticker.C { runOnce() }
        })
    })
}
```

- 用 `atomic.Bool.CompareAndSwap` 做「同一时刻只跑一次」的守卫（避免上一轮没跑完）。
- 在 `main.go` 靠近 `service.StartSubscriptionQuotaResetTask()` 处调用 `service.StartXxxTask()`。
- 跨天重置类逻辑要幂等：先写标记（如 `settled=true`）再改额度，失败重试不会重复扣。

## 4. 控制器 + 路由

1. `controller/xxx.go`；响应统一用 `common.ApiSuccess(c, data)` / `common.ApiError(c, err)` / `common.ApiErrorMsg(c, msg)`。
2. 分页：`common.GetPageQuery(c)` → `pageInfo.GetStartIdx()/GetPageSize()`，再 `SetTotal/SetItems`。
3. 解析 body：`common.DecodeJson(c.Request.Body, &req)`；当前用户：`c.GetInt("id")`、`c.GetString("username")`。
4. 路由写在 `router/api-router.go`：
   - 用户端：放在 `selfRoute`（`apiRouter.Group("/user")` + `UserAuth`）里，路径如 `selfRoute.GET("/xxx", ...)` → `/api/user/xxx`。
   - 管理端：`apiRouter.Group("/xxx")` + `middleware.AdminAuth()`；改全局配置用 `middleware.RootAuth()` + `PUT /api/option/`。
   - 公开接口：直接 `apiRouter.GET("/xxx", controller.Xxx)`，不要加鉴权中间件。
   - **坑**：Gin 同级静态路由（`/stats`）与参数路由（`/:id`）可以共存，先注册静态再注册 `:id` 更稳。

## 5. 前端功能页

1. `web/src/features/<name>/`：`types.ts` / `api.ts` / `hooks/use-xxx.ts` / `components/*` / `index.tsx`。
2. 请求走 `import { api } from '@/lib/api'`（axios 实例，`api.get('/api/xxx')`，`res.data`）。
   统一用 `requireServerSuccess(result)`（`@/lib/server-error-message`）把 `success:false` 转成异常，
   错误提示用 `handleServerError(error, msg)`（`@/lib/handle-server-error`），toast 用 `sonner` 的 `toast`。
3. 页面壳：`SectionPageLayout` + `.Title/.Actions/.Content`（`@/components/layout`）。
4. 侧边栏入口：`web/src/hooks/use-sidebar-data.ts` 的 `navGroups`（分组 id：`chat` / `general` / `personal` / `admin`）。
5. 路由文件：`web/src/routes/_authenticated/<name>/index.tsx`，内容为
   `createFileRoute('/_authenticated/<name>/')({ component: Xxx })`。
6. **必须手工同步 `web/src/routeTree.gen.ts`**（该文件由 rsbuild 的 tanstackRouter 插件生成，构建时会重写）：
   `src/lib/legacy-route.ts` 之外共需改 13 处，最简单的方式是复制一个同形态的既有路由（如 `wallet`）的全部条目：
   import、`const XxxRoute = XxxRouteImport.update({...})`、`FileRoutesByFullPath`、`FileRoutesByTo`、`FileRoutesById`、
   `FileRouteTypes` 的 `fullPaths/to/id`、`declare module` 的 `FileRoutesByPath`、`XxxRouteChildren` 接口与对象。
7. 角色判断：`const role = useAuthStore(s => s.auth.user?.role ?? 0)`，`role >= ROLE.ADMIN` / `ROLE.SUPER_ADMIN`（`@/lib/roles`）。

## 6. 系统设置里的新配置面板

- 类型 `web/src/features/system-settings/types.ts` 的 `ContentSettings/OperationsSettings/...` 加上 `xxx_setting.field` 键；
- 默认值加到 `features/system-settings/<域>/index.tsx` 的 `defaultXxxSettings`；
- 新面板注册到 `features/system-settings/<域>/section-registry.tsx` 的 `XXX_SECTIONS`（`as const`，`id` 自动进联合类型）；
- 面板组件内部直接用 `useUpdateOption()`（`features/system-settings/hooks/use-update-option.ts`）写单键，
  不必接入页面级表单；`getOptionValue` 会按默认值类型自动把字符串转成 boolean/number。

## 7. i18n

- 前端文案键就是英文原文：组件里 `t('English sentence')`。
- 中文翻译在 `web/src/i18n/locales/zh.json`（结构 `{"translation": {...}}`，约 7000 键）。
  **不要整体重排**，用脚本在 `translation` 对象末尾追加 `,\n` + 新键即可（键内含 `\n`、`{{var}}` 要原样保留）。
- 不要手写漏键：先脚本扫描本次改动文件的 `t('...')`，与 zh.json 取差集，再一次补齐。
- 前端 i18next 会把 `{{count}}` 当作复数变量（会先找 `key_one`/`key_other`，找不到则回退原键），仓库既有代码已这样用，可沿用。

## 8. 并发与幂等（额度类功能必看）

- 额度重算这类"读现状 → 写新值 + 调整用户余额"的逻辑必须防并发：
  - 单进程用 `sync.Mutex`（包级变量）串行化；
  - 跨实例用「发放记录行上的比较并交换」：`UPDATE ... SET quota=? WHERE id=? AND quota=?`，
    `RowsAffected == 0` 说明别的实例已经写过，本次直接放弃；新插入靠唯一索引兜底（插入冲突 = 别人已经发放）。
- 跨天回收要幂等：先 `UPDATE ... SET settled = true WHERE id = ? AND settled = false`，
  只有 `RowsAffected == 1` 时才去扣用户额度，任务重试不会重复扣。

## 8.1 想做「多 Key 轮询 + 失败无痕切换」时

- 不要一个 Key 建一个渠道。用**单个渠道 + 多 Key 模式**：
  `channel.ChannelInfo = ChannelInfo{IsMultiKey: true, MultiKeyMode: constant.MultiKeyModePolling, MultiKeySize: n}`，
  `Channel.Key` 用 `\n` 拼接，并把 `AutoBan` 设为 1。
- 三条硬性前提，缺一个就"能轮询但不能无痕切换"：
  1. `AutoBan=1` —— `service.DisableChannel` 只在 `channelError.AutoBan` 为真时才处理错误；
  2. 多 Key 模式下 `handlerMultiKeyUpdate` 只禁用出错的那个 Key 索引（`MultiKeyStatusList`），
     所以 Key 值必须稳定可控，且**改 Key 列表后必须整体重置索引状态**；
  3. `common.RetryTimes`（默认 **0**）必须 ≥1，否则失败不重试 = 用户直接看到报错。
     它属于请求策略选项，用 `PUT /api/option/` 写 `RetryTimes`，不要在代码里偷偷改全局。
- 改渠道时避免 `Channel.Update` / `UpdateChannelStatus`：会给管理员推送变更通知（号池 Key 进出频繁会刷屏）。
  用 `DB.Model(&Channel{}).Where("id = ?", id).Select("key", ..., "channel_info").Updates(Channel{...})`
  —— `Select` 保证零值写入，`channel_info` 交给 schema 序列化；随后 `UpdateAbilities(nil)` + `CacheUpdateChannel`。
- 渠道/能力变化后立刻 `model.InitChannelCache()`，否则要等 `SyncChannelCache` 周期才生效。

## 8.2 对普通用户隐藏内部信息

- 同一个资源做**两套 payload**：用户端只给掩码值、状态、时间；管理端才给原始报错、模型列表、渠道编号等。
- 需要给用户"失败原因"时，落库一个**分类码**（auth/quota/network/upstream/format/config/unknown），
  前端按码取多语言文案，绝不把上游原始报错或上游地址下发给用户。
- 公网配置类接口（如 `/api/home_landing`）只下发展示字段；上游地址、内部标签留在管理端接口。

## 9. 自检清单

- [ ] Go：新增 import 全部被使用；GORM 链式调用方法名正确（`Updates(map[string]any{...})` 才更新零值）。
- [ ] 前端：没有未使用的 import/变量（`noUnusedLocals`/`noUnusedParameters` 会让 `tsgo -b` 失败）。
- [ ] 路由：`routeTree.gen.ts` 已同步；新页面在侧边栏可见。
- [ ] i18n：新键已补 zh.json。
- [ ] 配置项命名不以 Key/Secret/Token 结尾。
- [ ] 定时任务只在 master 节点跑，且带重入守卫。
- [ ] 提示用户执行 `cd web && bun install && bun run build` 才能生效。
