# AGENTS.md — AI Agent 工作宪法

> 本文件是 AI Agent（Codex、Claude Code 等）在 `venue-booking` 仓库内工作的**唯一行为约定**。优先级仅次于用户/系统明确指令；当 `PRD.md` / 用户指令与本文件冲突时，**先确认再行动**。

---

## 1. 项目定位

- **项目名**：venue-booking（场地预订系统 v2）
- **PRD**：`./PRD.md`（必读，**所有功能范围以 PRD 为准**）
- **技术栈速查**：

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite + TypeScript |
| 后端 | Supabase（Postgres + Auth + Realtime + Storage + Edge Functions / Deno） |
| 部署 | Vercel（前端）+ Supabase Cloud（后端） |
| 邮件 | Resend（经 Edge Function） |
| 包管理 | pnpm（建议默认，待 OQ-8 拍板） |

---

## 2. 目录约定

```
venue-booking/
├── PRD.md                      # 产品需求（真理之源）
├── AGENTS.md                   # 本文件
├── README.md                   # 仓库说明（保留 v1 历史）
├── frontend/                   # Vite + React 应用
│   ├── src/
│   │   ├── features/           # 按业务域分：auth / venues / bookings / owner / admin
│   │   ├── components/         # 通用 UI（shadcn/ui 风格，待 OQ-1 拍板）
│   │   ├── pages/              # 路由级页面
│   │   ├── lib/                # supabase client、utils
│   │   ├── i18n/               # zh-CN.json / en-US.json
│   │   └── types/              # 由 supabase gen types 生成的 DB 类型
│   └── package.json
├── supabase/
│   ├── migrations/             # 唯一可信的 schema 变更来源
│   ├── functions/              # Edge Functions（敏感词、邮件、看板聚合等）
│   ├── seed.sql                # 本地种子数据
│   └── config.toml
└── docs/                       # 架构图、决策记录（ADR）
```

- `frontend/src/features/<domain>/` 内标准结构：`components/`、`hooks/`、`api.ts`（数据访问）、`schema.ts`（zod）、`types.ts`
- **禁止**跨 feature 互相 import 内部文件；通过 `components/` 或 `lib/` 暴露

---

## 3. 常用命令

> 实际命令以 `package.json` `scripts` 为准；以下为推荐形态。

```bash
# 前端
pnpm install
pnpm dev                # Vite dev
pnpm build              # 生产构建
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest
pnpm test:e2e           # playwright

# Supabase
supabase start                              # 本地栈（Docker）
supabase db reset                           # 重置 + 应用 migrations + seed
supabase migration new <name>               # 新建 migration
supabase db push                            # 推送远端（**仅 staging/main**）
supabase gen types typescript --local > frontend/src/types/db.ts
supabase functions serve <fn-name>          # 本地调试 Edge Function
supabase functions deploy <fn-name>
```

---

## 4. 环境变量

- 前端变量**必须**以 `VITE_` 前缀，构建期会内联；不要把 `SERVICE_ROLE` 放前端
- 所有 `.env*` 入 `.gitignore`；仓库只放 `.env.example`
- CI 变量在 Vercel / Supabase Dashboard 维护

| 变量 | 用途 | 可见范围 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 前端 |
| `VITE_SUPABASE_ANON_KEY` | anon 密钥 | 前端 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务密钥 | **仅** Edge Function / migrations |
| `RESEND_API_KEY` | Resend 邮件 | **仅** Edge Function |
| `MAIL_FROM` | 发件邮箱 | **仅** Edge Function |
| `APP_BASE_URL` | 重置密码等链接的根域 | Edge Function + 前端 |

---

## 5. 编码约定

### 5.1 TypeScript

- `tsconfig` 必须 `strict: true`、`noUncheckedIndexedAccess: true`
- 公共函数必须有显式返回类型
- **禁用** `any`；必要时用 `unknown` + zod 收口
- 优先用 `interface` 描述对象，`type` 用于联合/工具

### 5.2 React

- 函数组件 + Hooks；不写 class
- Hooks 顶部声明，禁止条件调用
- 列表 key 用稳定 ID，**不用 index**
- 数据获取优先 TanStack Query（OQ-3 待拍板）
- 表单用 react-hook-form + zod schema（OQ-2 待拍板）

### 5.3 Supabase / 数据访问

- **所有**业务表 RLS 必须开启；新表必须在 migration 中加 policy
- 客户端调用走 `lib/supabase.ts` 单例；不要在组件内 `createClient`
- 复杂查询封装在 `features/<domain>/api.ts`，组件层不直接写 `.from().select()`
- 类型来源：`pnpm db:types` 生成；禁止手写 DB 类型

### 5.4 i18n

- 文案**一律**走 `frontend/src/i18n/{zh-CN,en-US}.json`
- 错误信息、枚举名、状态名全部双语
- 新增文案需同时改两份 key，并加 `pnpm i18n:check`（lint 检查）
- 日期/金额用 `Intl.*`，禁止 `toLocaleString` 硬编码

### 5.5 安全

- 前端**永不**持有 `SUPABASE_SERVICE_ROLE_KEY`
- 提交至 Edge Function 的内容，**默认不可信**；用 zod 二次校验
- PII（身份证号）经 pgcrypto 加密字段；不入日志、不入前端 props
- 错误回显**脱敏**（"操作失败"而非 raw error stack）

### 5.6 性能

- 列表分页（cursor 优于 offset）
- 大列表 `virtualize`（react-virtuoso / @tanstack/react-virtual）
- 图片用 `<img loading="lazy" decoding="async">`，外加 `srcset`
- 打包体积：定期 `pnpm build` 看 bundle 报告；gzip 后单 chunk ≤ 250KB

---

## 6. 数据库约定

- **唯一**的 schema 变更路径：`supabase db migration new <name>` → 写 SQL → 提交
- 严禁直接 `db push` 到 production；CI 走 migration 文件
- 命名：表名复数下划线，列名单数；枚举用 `text + check` 或真 `enum`，团队内统一一种
- 软删：通用 `deleted_at timestamptz`；非必要不用（PRD 中明确要软删的表才加）
- 时间一律 `timestamptz`，存 UTC
- 钱一律存**分**（`int` 字段，单位 cents），前端按 locale 格式化
- 关键状态机（`bookings.status`）必须有 DB 层 CHECK 约束

---

## 7. Edge Function 约定

- Deno + TypeScript，路径 `supabase/functions/<name>/index.ts`
- 入口导 `Deno.serve(async (req) => ...)`，返回 `Response`
- 鉴权：读 `Authorization: Bearer <jwt>` 头，调 `supabase.auth.getUser()`
- 邮件/敏感词等共享逻辑放 `supabase/functions/_shared/`
- 模板：HTML + TXT 双语，文件名 `_<key>.{html,txt}`
- 失败可重试 3 次；最终失败写 `email_outbox` 表

---

## 8. Agent 行为边界（红线）

> 以下行为必须**先问再动**。

1. **PRD 范围**：PRD §2.2 列出的"非目标"一律不做；如需新增，**先更新 PRD** 再编码
2. **RLS 优先**：业务逻辑**不**允许绕开 RLS（不要给前端 service_role）
3. **Service Role 不得下发到前端**：仅 Edge Function / migrations
4. **Schema 改动**：所有表结构、RLS、index 改动走 migration；不直接 `ALTER TABLE` 在 production
5. **破坏性改动**：删列、删表、改枚举值前必须确认无下游依赖
6. **PII 处理**：不打印明文身份证/手机号/邮箱到日志或 console
7. **依赖**：新增 npm / Deno 依赖前，先确认体积/许可/维护活跃度
8. **配置变更**：Vercel / Supabase / Resend 的环境变量、域名、DNS 改动**先问**
9. **删除/覆盖文件**：删除前确认 git 历史可恢复；批量重命名先列清单
10. **金额/价格**：任何与钱相关的字段（`price_cents`、`total_price_cents`）改动需 double-check
11. **i18n 新增/删除 key**：必须同时改 `zh-CN.json` 和 `en-US.json`
12. **不要 `git commit` / 不要 `git push` / 不要建分支**——除非用户明确要求
13. **不要主动安装系统级包**（如全局 `supabase`、`vercel` CLI）——让用户决定

---

## 9. 决策记录（ADR）

重大技术选型/破坏性决策时，新增 `docs/adr/NNNN-<slug>.md`：

```markdown
# NNNN. <标题>
- 状态：提议 / 已采纳 / 已弃用
- 日期：YYYY-MM-DD
- 背景：…
- 决策：…
- 后果：…
```

---

## 10. 协作流程

- **新需求**：先看 PRD §2.2 / §4 是否已覆盖；未覆盖则更新 PRD 后再编码
- **Bug**：先复现（单测/手动）→ 定位根因 → 修根因；不堆 surface-level patch
- **Review**：自己写完先看 diff；CI 通过后再交付用户
- **汇报**：完成阶段性任务后给用户一个"做了什么 + 下一步建议"的简明汇报
- **不要自顾自往下做**：每个里程碑结束等用户确认再进入下一阶段

---

## 11. 自检清单（提交前过一遍）

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过（如有新增测试）
- [ ] i18n 双语 key 同步
- [ ] 新表有 RLS policy
- [ ] 没新增明文密钥到仓库
- [ ] 没动 PRD §2.2 非目标
- [ ] 没动 production DB 直连
- [ ] 报用户：变更点 + 验证步骤

---

**版本**：v0.1.0（2026-06-08，与 PRD 同日建立）
