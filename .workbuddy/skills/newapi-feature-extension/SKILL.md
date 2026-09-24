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
7. **改「代码里的默认值」不一定生效**：`model/option.go` 的 `InitOptionMap` 先执行
   `config.GlobalConfig.ExportAllConfigs()`（把注册的默认值灌进 `common.OptionMap`），
   紧接着 `loadOptionsFromDatabase()` 用数据库里的值**覆盖**它。所以：
   - 后台从没保存过该项 → 代码默认值生效（改代码 + 重新构建即可）；
   - 后台保存过 → 数据库优先，**必须让用户在后台界面改**（改完立即生效，不用重建镜像）。
   改配置默认值时要同时告诉用户这两条路径，别只说"改了代码"。
   `GET /api/option/` 下发的是 `common.OptionMap`（已合并默认值），所以前端表单读得到默认值，不会读到空。

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
- **每次动完前端就要重跑一次全量扫描**，不要只在"第一轮写完"时扫一次：
  分多轮加文案时，后加的那批极容易漏（本项目就出现过管理员界面混出 9 条英文）。
  扫描范围要覆盖所有本次涉及的特性目录 + `hooks/` + `system-settings/content/`：

  ```bash
  cd web/src && "C:/Users/15828/.workbuddy/binaries/python/envs/default/Scripts/python.exe" - <<'PY'
  import json, re, glob, os
  pats = ["features/<你的特性>/**/*.ts", "features/<你的特性>/**/*.tsx",
          "hooks/use-top-nav-links.ts", "features/system-settings/content/*.tsx"]
  files = sorted({f for p in pats for f in glob.glob(p, recursive=True) if os.path.isfile(f)})
  rx = re.compile(r"\bt\(\s*'((?:[^'\\]|\\.)*)'", re.DOTALL)
  found = {}
  for f in files:
      for m in rx.finditer(open(f, encoding="utf-8").read()):
          s = m.group(1).replace("\\n","\n").replace("\\'","'")
          found.setdefault(s, set()).add(f)
  zh = json.load(open("i18n/locales/zh.json", encoding="utf-8"))["translation"]
  miss = sorted(k for k in found if k not in zh)
  print("缺失", len(miss))
  for k in miss: print("  ", repr(k), "<-", sorted(found[k]))
  PY
  ```

- 也要扫**非 `t()` 的文案**：`titleKey: '...'`、`label: '...'`、数组里的命令行字符串等，
  这些同样会以英文露出。
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
- **文案也属于"内部信息"**（本项目用户明确要求）：用户端不要出现
  「系统会定期检查 Key」「失效后额度会被自动回收」「提交即表示同意…被用于本站调用」这类
  后台机制说明与免责声明 —— 用户只需要知道"我能做什么、我能得到什么"。
  这类解释放到管理端页面（和代码注释）里。写用户端文案时先问：这行字是给用户看的，还是给运维看的？

## 9. 自检清单

- [ ] Go：新增 import 全部被使用；GORM 链式调用方法名正确（`Updates(map[string]any{...})` 才更新零值）。
- [ ] 前端：没有未使用的 import/变量（`noUnusedLocals`/`noUnusedParameters` 会让 `tsgo -b` 失败）。
- [ ] 路由：`routeTree.gen.ts` 已同步；新页面在侧边栏可见。
- [ ] i18n：**本轮全部**改动文件的 `t('...')` 都已扫过并与 zh.json 取差集补齐（多轮改动要重扫）。
- [ ] 用户端没有出现后台机制说明 / 免责声明类文案。
- [ ] 配置项命名不以 Key/Secret/Token 结尾。
- [ ] 定时任务只在 master 节点跑，且带重入守卫。
- [ ] 提示用户执行 `cd web && bun install && bun run build` 才能生效。

## 10. 落地页与公开页面（二次开发最常改的地方）

### 首页渲染优先级 —— 排查「改了首页没生效」的第一个嫌疑

`features/home/index.tsx` 的顺序是：

1. `HomePageContent`（后台「系统设置 → 内容」里的自定义首页内容）非空 → **直接渲染它**
   （值是 URL 走 iframe、HTML 走 `RichContent`、Markdown 走富文本），**内置落地页组件完全不参与渲染**；
2. 否则渲染落地页区块：`Hero → Stats → ModelGallery → HowItWorks → Features → Faq → Community → CTA → Footer`。

每个区块还能被 `home_landing_setting.*` 的开关单独关掉（`stats_enabled`、`models_enabled`…），
关掉了同样不渲染。用户说「我改了 `features/home/...` 但页面没变」时，先问这两件事。

### 落地页装修是表驱动的，加字段只改三处

1. `setting/operation_setting/home_landing_setting.go` —— struct 加字段（`json:"snake_case"`）；
2. `web/src/features/home/types.ts` —— 前端类型同步；
3. `web/src/features/system-settings/content/home-landing-section.tsx` —— `FIELD_GROUPS` 里加一行。

表单的初始值读取、脏检查、保存都按 `FIELD_GROUPS` 统一处理，不需要手写 state。

### 上游自留标识（二次开发站点通常要删）

- **页头版本号**：`<SystemUpdateAction presentation='version' />`，出现在
  `components/layout/components/public-header.tsx`（公开页）与 `app-header.tsx`（后台）。
  组件内部 `if (!isAdmin) return null` —— **只有管理员看得见**，用户报「我的页面上有个版本号」基本就是它。
  删掉后必须清 import。注意后台「系统设置 → 维护」的更新检查是同一组件的另一个入口（`compact={false}`），别一起删。
- 页脚署名：`components/layout/components/footer.tsx` 的 `ProjectAttribution`（© … New API），同类清理项。

### 对齐参考站点时的取舍

- **只改截图里能看到的区块**，没露出的部分不要擅自重排 —— 否则很容易来回返工。
- 「像不像大厂官网」的差异点往往不在颜色，而在这些装饰件：眉标（`uppercase tracking-widest` 小标签）、
  徽章、演示性组件（终端动画等）。参考站点没有的就删。
- 数据条这类展示块的结构很讲究方向：本项目的参考站点是「指标名在上、数值在中、说明在下」，
  而常见默认实现是「数值在上、标签在下」，照抄前先看清截图。
- 展示的指标必须来自真实接口。真拿不到（例如全站用量聚合）就换成本站真实可得的口径，
  **不要为了像而造假数字**；需要新数据时优先新增带缓存的公开接口，绝不每次请求都去聚合 `logs` 表。

### 从截图推断数据口径（很有用的一招）

拿到参考站点截图时，**对比两张不同时间截图的同一个数字**就能判断口径：

- 数字在小幅增长（例如 20 分钟内 26,231 → 26,345）→ 是**当日**维度，只需 `WHERE created_at >= 今日0点`，
  能走 `idx_created_at_type` 索引，性能安全；
- 数字几乎不变且量级巨大 → 是**累计**维度，必须缓存 + 低频刷新，绝不能放在请求路径上。

本项目一开始按「累计」设计，靠这个对比纠正成了「当日」，省掉了全表聚合。多张截图是宝贵线索。

### 公开统计接口的标准写法

1. 聚合放在 `service/xxx_stats.go`：内存快照 + `sync.RWMutex` + 后台 tick（本项目用 `StartXxxTask` 挂 `main.go`）；
2. 首次调用同步刷新一次（否则首屏全是 0），并用一把额外的 `Mutex` 串行化，避免并发请求重复打库；
3. 高频写入（如页面访问量）先在内存累加，定时批量落库；落库用
   `UpdateColumns(map[string]any{"cnt": gorm.Expr("cnt + ?", delta)})` 先试累加，`RowsAffected == 0` 再 INSERT；
4. 接口只返回快照，且**只下发聚合数字**（不含用户、渠道、Key 维度）；
5. 前端一定要有降级：接口不可用时退回另一套真实数据，别让区块空掉。
   本项目数据条就在统计接口 404 时自动退回「可用模型 / 供应商 / 分组 / 接口」。

### 用日志库聚合时的注意点

- 计费用日志要用 `type = 2`（`LogTypeConsume`）过滤，否则会把充值、管理操作也算进去。
- 模型名的**两套写法**：日志里的 `model_name` 与定价目录的 `model_name`/`key` 可能不一致，
  前端查用量时两个键都试一次。
- `model.LOG_DB` 可能与 `model.DB` 不是同一个库，聚合要走 `LOG_DB`。
