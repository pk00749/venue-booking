# 场地预订系统 PRD（产品需求文档）

| 项目代号 | venue-booking v2 |
| --- | --- |
| 文档版本 | v0.1.0（待评审） |
| 文档日期 | 2026-06-08 |
| 文档作者 | Codex (协作生成) |
| 评审状态 | ⏳ 等待产品/技术确认 |
| 目标 MVP 周期 | 6–8 周（按里程碑 P0–P5 推进） |

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [范围与非目标](#2-范围与非目标)
3. [角色与权限矩阵](#3-角色与权限矩阵)
4. [核心用户故事](#4-核心用户故事)
5. [数据模型（Postgres）](#5-数据模型postgres)
6. [RLS 策略示例](#6-rls-策略示例)
7. [通知与实时](#7-通知与实时)
8. [管理员能力](#8-管理员能力)
9. [敏感词审核](#9-敏感词审核)
10. [非功能需求](#10-非功能需求)
11. [部署与基础设施](#11-部署与基础设施)
12. [里程碑规划](#12-里程碑规划)
13. [风险与开放问题](#13-风险与开放问题)
14. [附录：术语表](#14-附录术语表)

---

## 1. 背景与目标

### 1.1 背景

仓库 `venue-booking` 原为 v1：微信小程序 + FastAPI + MongoDB。v1 已完成登录、角色区分、场地 CRUD、时段、预订、取消、查看等基本链路，但仍停留在小程序生态、依赖微信授权、缺少通知与审核闭环。

### 1.2 重写目标（v2）

将整套系统重写为**Web 优先、Supabase 全托管**的现代栈：

- 用 **Supabase（Postgres + Auth + Realtime + Storage + Edge Functions）** 作为唯一后端，免自建服务器
- 前端迁移到 **React 19 + Vite + TypeScript**，便于在 Vercel 上 CI/CD
- 引入**管理员审核**与**敏感词审核**机制，让平台具备内容与资质把关能力
- 引入**邮件 + 站内实时**通知，让用户/场主/管理员都不漏单
- 全量支持 **zh-CN / en-US** 切换

### 1.3 业务目标（北极星指标）

| 指标 | 目标 | 衡量方式 |
| --- | --- | --- |
| 完成预订数 | MVP 上线 30 天内 ≥ 100 单 | bookings.status = 'completed' |
| 场主入驻 | ≥ 5 个审核通过的 owner | owner_applications.status = 'approved' |
| 预订审核中位时延 | < 2 小时 | bookings.created_at → confirmed_at |
| 取消率 | < 20% | cancelled / total |

### 1.4 假设

- v2 不迁移 v1 的 MongoDB 数据（v1 数据将归档，不再维护）
- v2 走**纯免费**起步（Supabase Free + Vercel Free + Resend Free + Cloudflare R2 Free），付费在用户量过阈值时再议
- v2 **不涉及支付与退款**，预订仅做"占位"语义

---

## 2. 范围与非目标

### 2.1 In Scope（MVP 必须有）

- 邮箱 + 密码注册/登录、密码重置、邮箱验证
- 三类角色：普通用户（user）、场主（owner）、平台管理员（admin）
- 用户：浏览场地、筛选、查看时段、创建预订、取消预订、查看我的预订、收件箱
- 场主：提交入驻申请、创建/编辑场地、配置附加服务、配置时段模板、审核预订（可选）、查看本场地预订
- 管理员：审核场主入驻申请、敏感词词库管理、数据看板、内容审核
- 通知：邮件（预订状态变更、入驻申请结果）+ 站内实时（收件箱）
- 平台通用：i18n、敏感词校验、审计日志

### 2.2 Out of Scope（明确不做，避免范围蔓延）

- ❌ **支付/收款**（保留 `total_price` 字段占位，但不接 Stripe/微信支付/支付宝）
- ❌ **退款流程**（v1 → v2 都不做）
- ❌ **微信小程序**（仅 Web 端）
- ❌ **微信/Google/GitHub OAuth 登录**（仅邮箱+密码）
- ❌ **SAML / 企业 SSO**（需付费且当前规模不需要）
- ❌ **地图集成**（不嵌高德/Google Maps，仅显示文字地址）
- ❌ **短信通知**（仅邮件 + 站内）
- ❌ **聊天/IM**（仅结构化通知）
- ❌ **多租户/分平台**（单一平台运营）
- ❌ **数据导入/导出**（管理员后台除外）
- ❌ **多币种/多时区**（默认 Asia/Shanghai + CNY 显示）
- ❌ **PC 后台**（管理员后台 v1 用同一 Web 应用适配，复杂后台后议）

> 任何新需求请先更新本文档 §2.2 与 §4，确认后再进入里程碑。

---

## 3. 角色与权限矩阵

| 能力 | 游客（未登录） | user | owner | admin |
| --- | --- | --- | --- | --- |
| 浏览场地列表/详情 | ✅ | ✅ | ✅ | ✅ |
| 注册/登录 | ✅ | — | — | — |
| 提交入驻申请（成为 owner） | — | ✅ | — | — |
| 创建预订 | — | ✅ | ✅（给自己） | ✅ |
| 取消自己的预订 | — | ✅ | ✅ | ✅ |
| 审核本场地预订 | — | — | ✅（owner） | ✅ |
| 创建/编辑自己的场地 | — | — | ✅ | ✅ |
| 收件箱（站内通知） | — | ✅ | ✅ | ✅ |
| 审核场主入驻申请 | — | — | — | ✅ |
| 敏感词词库 CRUD | — | — | — | ✅ |
| 数据看板 | — | — | ✅（仅自己场地） | ✅（全平台） |
| 审计日志查看 | — | — | — | ✅ |

权限实现原则：

1. **RLS 优先**：所有表强制开启 RLS，业务逻辑不绕开 RLS
2. **角色升级必须走审核**：`user → owner` 必须管理员通过 `owner_applications`
3. **admin 角色手动授予**：不开放自助申请，由现有 admin 在数据库层面 `UPDATE profiles.role = 'admin'`
4. **service_role 永不下发到前端**：仅 Edge Function 与 migrations 使用

---

## 4. 核心用户故事

> 编号沿用 v1 风格（US-001 起），便于历史对照。**P0 = MVP 必须**，**P1 = MVP 之后 1 个迭代**，**P2 = 视情况**。

### 4.1 认证模块

#### US-001 邮箱+密码注册（P0）
- 入口：Web 端 `/signup`
- 流程：填邮箱、密码（≥ 8 位，含字母+数字）→ 发送验证邮件 → 点击链接激活 → 自动登录
- 落库：`auth.users`（Supabase Auth）+ `profiles` 记录昵称/头像/语言
- 异常：邮箱已注册、邮件 60s 内重复发送限流

#### US-002 邮箱+密码登录（P0）
- 入口：`/login`
- 支持"记住我"（默认 7 天会话）
- 失败 5 次后滑窗限流 15 分钟

#### US-003 密码重置（P0）
- 入口：`/forgot-password` → 输入邮箱 → 收邮件 → `/reset-password?token=...` 重置
- 邮件模板双语，主题：`[venue-booking] 重置您的密码` / `Reset your password`

#### US-004 选择界面语言（P0）
- 注册时选择 zh-CN / en-US，写入 `profiles.locale`
- 全局语言切换器（顶栏右侧），切换后立刻刷新所有文案

### 4.2 用户端

#### US-101 浏览场地列表（P0）
- 字段：名称、运动类型、地址、起价、首图、营业时间
- 筛选：运动类型（多选）、关键字搜索（名称/地址）
- 排序：最新发布、起价升/降
- 分页：cursor-based，每页 20 条

#### US-102 场地详情（P0）
- 展示：图片轮播（≤ 6 张）、详细地址（**纯文本，不嵌地图**）、营业时间、附加服务列表、预订须知
- CTA：「选择时段预订」→ 跳 `/venues/:id/booking`

#### US-103 选择时段并下单（P0）
- 选日期（不可选过去日期，不可超 30 天）
- 选 1 个或多个连续/非连续时段（每个场地按 `slot_duration` 切分）
- 选附加服务（可改数量）
- 填联系人姓名、手机号（仅当次预订使用，不入用户 profile）
- 提交后状态机：`pending`（如 `require_approval`）或 `confirmed`

#### US-104 我的预订（P0）
- 列表：未来/历史两 tab
- 行内操作：取消（依据 `cancel_hours` 判断是否在可取消窗口）
- 详情：联系人、附加服务、合计（仅显示金额，不收款）

#### US-105 收件箱（P0）
- 站内通知列表，未读小红点
- 实时推送：预订状态变更、入驻申请结果、系统公告
- 全部已读 / 单条已读

#### US-106 取消预订（P0）
- 在 `cancel_hours` 之外：禁止取消，提示联系场主
- 之后：状态置 `cancelled`，释放时段，触发邮件

### 4.3 场主端

#### US-201 提交入驻申请（P0）
- 入口：`/become-owner`
- 字段：真实姓名、身份证号（仅作资质审核，不展示）、联系电话、营业执照图片（可选，存 Storage）
- 提交后状态：`pending`，等待管理员审核

#### US-202 入驻申请结果通知（P0）
- 邮件 + 站内通知
- 通过：`profiles.role` 升级为 `owner`，可进入场主控制台
- 拒绝：附拒绝原因，可重新提交

#### US-203 创建场地（P0）
- 字段：名称、运动类型、详细地址（文字）、图片（≤ 6 张）、营业时间、时段长度（30/60/90/120 分钟）、是否需审核、取消窗口小时数、起价
- 提交后 `status = 'active'`，立即对外可见

#### US-204 维护附加服务（P1）
- 单个场地下挂多个服务项（名称、单价、是否必选）
- 预订时与场地一起被勾选

#### US-205 维护时段模板（P1）
- 简化方案：仅配置"开/闭时段 + 时段长度"，系统按日自动展开
- 不做节假日/特殊日历（P2 议）

#### US-206 审核预订（P0，当 `require_approval = true`）
- 待审列表：显示用户、时段、联系方式
- 操作：通过 / 拒绝（附原因）

#### US-207 场主看板（P1）
- 仅看本场地数据：今日预订数、近 7 日完成率、取消率
- 复用平台看板组件，传 `venue_id` 过滤

### 4.4 管理员端

#### US-301 审核场主入驻申请（P0）
- 列表：待审 / 已通过 / 已拒绝三 tab
- 通过：`profiles.role = 'owner'`，触发邮件
- 拒绝：必须填原因，触发邮件

#### US-302 敏感词词库管理（P0）
- 列表 + 新增/编辑/删除 + 批量导入（CSV）
- 字段：词、严重等级（block / review）、备注、生效时间
- 生效即写入 Edge Function 缓存层（TTL 5 min）

#### US-303 数据看板（P0）
- 详见 §8

#### US-304 审计日志查看（P1）
- 列表：操作人、动作、对象、时间、IP
- 关键事件：审核、敏感词 CRUD、admin 角色变更

#### US-305 场地下架（P1）
- 将 `venues.status` 置 `'inactive'`，隐藏公共列表
- 不删除历史预订

### 4.5 平台通用

#### US-401 i18n（P0）
- zh-CN / en-US 全量对齐
- 文案抽离至 `frontend/src/i18n/{zh-CN,en-US}.json`
- 字段、枚举、错误消息均需双语

#### US-402 敏感词校验（P0）
- 提交入口：场地名/地址/描述、附加服务名、联系人姓名/手机号
- 命中 `block` 等级：直接 422 拒绝
- 命中 `review` 等级：进入人工审核队列（v2 暂不实现队列 UI，v2 暂全部 `block`，P2 加 review 流）

#### US-403 审计日志（P1）
- 关键操作写入 `audit_logs`
- 不记录密码/手机号明文

---

## 5. 数据模型（Postgres）

> 命名约定：表名小写复数下划线（`owner_applications`），主键 `id uuid default gen_random_uuid()`，时间戳 `timestamptz`，枚举用 `text + check` 或真 `enum`，软删字段 `deleted_at`。

### 5.1 ER 概览

```
auth.users (Supabase 自带)
   │ 1:1
   ▼
profiles ──────────┐
   │              │ 1:N
   │ N:1          ▼
   │       owner_applications
   │ N:1
   ▼
venues ── 1:N ── venue_services
   │ 1:N
   ▼
slots (按 venue + date_range 预生成)
   │ 1:N
   ▼
bookings ── N:M ── booking_services (join with venue_services)
   │
   └─ 1:N ── notifications (per recipient)

sensitive_words  (无 FK，独立词库)
audit_logs       (无 FK，记录所有 admin/owner 关键动作)
```

### 5.2 详细表结构

#### `profiles`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | = `auth.users.id` |
| email | citext unique | 冗余存一份便于查询 |
| nickname | text | 显示名 |
| avatar_url | text | 头像 Storage 路径 |
| phone | text nullable | 可选，**不强制** |
| role | text check in ('user','owner','admin') default 'user' | |
| locale | text check in ('zh-CN','en-US') default 'zh-CN' | |
| is_email_verified | boolean default false | 与 Supabase Auth 同步 |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | trigger 维护 |

#### `owner_applications`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles.id | 申请人 |
| real_name | text | 资质审核用 |
| id_card_no | text | **加密**存储，pgcrypto |
| contact_phone | text | |
| license_url | text nullable | 营业执照图 Storage 路径 |
| status | text check in ('pending','approved','rejected') default 'pending' | |
| reject_reason | text nullable | |
| reviewed_by | uuid FK → profiles.id nullable | |
| reviewed_at | timestamptz nullable | |
| created_at | timestamptz default now() | |

#### `venues`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| owner_id | uuid FK → profiles.id | |
| name | text | 场地名 |
| sport_type | text check in ('badminton','basketball','football','tennis','table_tennis','volleyball','other') | |
| address | text | 文字地址 |
| description | text | 详细描述 |
| images | text[] | Storage 路径数组，≤ 6 |
| open_time_start | time | 每日开 |
| open_time_end | time | 每日闭 |
| slot_duration_minutes | int check in (30,60,90,120) | |
| require_approval | boolean default false | |
| cancel_hours | int default 2 check (0–168) | |
| base_price_cents | int default 0 | 以分为单位 |
| status | text check in ('active','inactive') default 'active' | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

#### `venue_services`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| venue_id | uuid FK → venues.id on delete cascade | |
| name | text | 例：球拍租赁 |
| price_cents | int default 0 | |
| required | boolean default false | 是否必选 |
| created_at | timestamptz default now() | |

#### `slots`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| venue_id | uuid FK → venues.id on delete cascade | |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| status | text check in ('available','held','booked','blocked') default 'available' | |
| unique(venue_id, starts_at) | | 防重复 |

> 预生成策略：每次预订前实时按 `venue.slot_duration_minutes` 切分；不再做"slot 模板"表。
> 锁定：用户进入下单页时对所选 slot `status = 'held'`（10 分钟超时），支付/确认后改 `booked`。

#### `bookings`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles.id | 下单用户 |
| venue_id | uuid FK → venues.id | |
| status | text check in ('pending','confirmed','cancelled','completed','rejected') default 'pending' | |
| contact_name | text | |
| contact_phone | text | |
| total_price_cents | int default 0 | 占位，v2 不收款 |
| notes | text nullable | 用户备注 |
| cancel_reason | text nullable | |
| confirmed_at | timestamptz nullable | |
| cancelled_at | timestamptz nullable | |
| completed_at | timestamptz nullable | |
| created_at | timestamptz default now() | |

#### `booking_services`（join）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| booking_id | uuid FK → bookings.id on delete cascade | |
| service_id | uuid FK → venue_services.id | |
| quantity | int default 1 | |
| price_cents_snapshot | int | 下单时快照价 |
| PK(booking_id, service_id) | | |

#### `notifications`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles.id | 收件人 |
| type | text | 例：`booking.confirmed` |
| title | text | |
| body | text | |
| payload | jsonb | 关联对象 ID |
| read_at | timestamptz nullable | |
| created_at | timestamptz default now() | |

#### `sensitive_words`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| word | text unique | 大小写不敏感 |
| severity | text check in ('block','review') default 'block' | |
| note | text nullable | |
| is_active | boolean default true | |
| created_by | uuid FK → profiles.id | |
| created_at | timestamptz default now() | |

#### `audit_logs`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| actor_id | uuid FK → profiles.id nullable | |
| action | text | 例：`owner.approve` |
| target_type | text | 例：`owner_applications` |
| target_id | uuid | |
| metadata | jsonb | |
| ip | inet nullable | |
| created_at | timestamptz default now() | |

### 5.3 索引建议

- `venues(status, sport_type)` — 列表筛选
- `venues(owner_id)` — 场主看自己场地
- `slots(venue_id, starts_at)` — 时段查询主路径
- `slots(status, starts_at)` partial where status = 'available' — 找可用时段
- `bookings(user_id, created_at desc)` — 我的预订
- `bookings(venue_id, created_at desc)` — 场主看板
- `owner_applications(status, created_at)` — 审核队列
- `notifications(user_id, read_at, created_at desc)` — 收件箱
- `sensitive_words(is_active)` partial where is_active

---

## 6. RLS 策略示例

> 完整策略在 migrations 中实现；此处只展示关键表的 policy 形态。

### 6.1 `profiles`
- `SELECT`：所有人（含游客）可看 `nickname/avatar_url`（公开字段视图或列权限）
- `UPDATE`：仅自己可改 `nickname/avatar_url/locale`；`role` 字段只允许 DB trigger 改
- `INSERT`：仅在 `auth.users` 创建时由 trigger 写

### 6.2 `venues`
- `SELECT`：所有人可看 `status = 'active'`；owner 可看自己的全部；admin 可看全部
- `INSERT`：仅 `role = 'owner' or 'admin'`
- `UPDATE`：仅 `owner_id = auth.uid()` 或 admin
- `DELETE`：仅 admin（实际用 `status = 'inactive'` 软删）

### 6.3 `slots`
- `SELECT`：所有人
- `UPDATE`：仅 Edge Function 用 service_role；普通用户不直改
- `INSERT/DELETE`：仅 service_role 或 owner（自己场地）

### 6.4 `bookings`
- `SELECT`：`user_id = auth.uid()` 或 `venue.owner_id = auth.uid()` 或 admin
- `INSERT`：`auth.uid() = user_id` 且 `auth.uid()` role in ('user','owner','admin')
- `UPDATE`：user 可改 `status` 当 `pending → cancelled` 且满足 `cancel_hours`；owner 可改 `pending → confirmed/rejected`；admin 全权
- `DELETE`：禁止

### 6.5 `owner_applications`
- `SELECT`：申请人自己或 admin
- `INSERT`：仅自己
- `UPDATE`：仅 admin 改 status
- `DELETE`：禁止

### 6.6 `notifications`
- `SELECT/UPDATE`（read_at）：仅 `user_id = auth.uid()`
- `INSERT`：仅 service_role

### 6.7 `sensitive_words`
- `SELECT/INSERT/UPDATE/DELETE`：仅 admin

### 6.8 `audit_logs`
- `SELECT`：仅 admin
- `INSERT`：仅 service_role

---

## 7. 通知与实时

### 7.1 邮件触发点（Resend via Edge Function）

| 事件 | 收件人 | 模板 key | 触发位置 |
| --- | --- | --- | --- |
| 注册邮箱验证 | 注册人 | `auth.verify_email` | Supabase Auth Hook |
| 密码重置 | 申请人 | `auth.reset_password` | Supabase Auth Hook |
| 预订创建（无需审核） | user | `booking.confirmed` | Edge Function `on-booking-create` |
| 预订创建（需审核） | user | `booking.pending` | Edge Function |
| 预订待审 | venue owner | `booking.review_required` | Edge Function |
| 预订通过 | user | `booking.approved` | Edge Function |
| 预订拒绝 | user | `booking.rejected` | Edge Function |
| 预订取消（用户取消） | venue owner | `booking.user_cancelled` | Edge Function |
| 预订完成（开场后自动） | user + owner | `booking.completed` | 定时任务 |
| 入驻申请通过 | 申请人 | `owner.approved` | Edge Function `on-owner-review` |
| 入驻申请拒绝 | 申请人 | `owner.rejected` | Edge Function |

实现要点：

- **模板**：`supabase/functions/_templates/{key}.html` 与 `.txt` 双语版本，按收件人 `profiles.locale` 选
- **发件域名**：Resend 需绑定自有域名，DNS 记录 DKIM/SPF/DMARC
- **失败重试**：Resend API 失败由 Function 写 `email_outbox` 表，后台 job 重试 3 次
- **去重**：同一 `notification.type + payload.hash` 5 分钟内不重发

### 7.2 站内实时（Supabase Realtime）

订阅路径：

- `notifications:user_id=eq.<auth.uid>` → 用户收件箱
- `bookings:user_id=eq.<auth.uid>` → 我的预订状态
- `bookings:venue_id=in.<owner.venue_ids>` → 场主看自己场地的预订变化

前端实现：`useRealtimeChannel(channel, onChange)` 封装，断线重连 + 心跳。

### 7.3 通知对象与邮件/站内映射

| 对象 | 邮件 | 站内 |
| --- | --- | --- |
| 状态变更（user/owner 都关心） | ✅ | ✅ |
| 系统公告 | 可选（admin 开关） | ✅ |
| 营销/推广 | ❌（v2 不做） | ❌ |

---

## 8. 管理员能力

### 8.1 数据看板

> 看板为单一页面 `/admin/dashboard`，组件可复用于场主端（仅传 `venue_id`）。

#### 指标卡（首屏）

| 指标 | 周期 | 来源 |
| --- | --- | --- |
| DAU / WAU / MAU | 当日 / 当周 / 当月 | `auth.users` 登录日志（Supabase Auth 记录） |
| 新增用户数 | 今日 / 7 日 / 30 日 | `profiles.created_at` |
| 新增场主申请数 | 今日 / 7 日 / 30 日 | `owner_applications.created_at` |
| 新增预订数 | 今日 / 7 日 / 30 日 | `bookings.created_at` |
| 完成预订数 | 今日 / 7 日 / 30 日 | `bookings.status = 'completed'` |
| 取消率 | 7 日 / 30 日 | cancelled / total |
| 审核中位时延 | 7 日 | median(`confirmed_at - created_at`) |
| 待审申请数 | 实时 | `owner_applications.status = 'pending'` |
| 待审预订数 | 实时 | `bookings.status = 'pending'` |

#### 图表区

- 趋势：30 日用户/预订双轴折线
- Top N：预订量 Top 10 场地（条形）
- 类型分布：按 `sport_type` 饼图
- 审核吞吐：每日审核通过/拒绝堆积柱

#### 实现

- 数据通过 `supabase functions/dashboard-stats` Edge Function 聚合（避免在前端做 9 个查询）
- 缓存 60 秒（Cloudflare CDN 或 Edge Function 自带 cache）
- 图表库：见 §13 开放问题

### 8.2 审核工作流

- 入驻申请：列表 → 详情（看证件图） → 通过/拒绝
- 预订审核：列表 → 通过/拒绝
- 所有审核动作入 `audit_logs`

### 8.3 敏感词词库管理

- 列表 + CRUD + CSV 批量导入
- 增删即失效（Edge Function 5 分钟缓存）
- 严重等级：v2 仅实现 `block`；`review` 字段保留供 P2 扩展

---

## 9. 敏感词审核

### 9.1 命中位置

- 场地：name / description / address
- 附加服务：name
- 预订：contact_name / contact_phone（手机号格式白名单）
- 用户：nickname

### 9.2 校验流程

```
client.submit(...)
  └─ supabase.functions/sensitive-check  (Edge Function)
       ├─ 读 cache：内存 LRU(5 min) ← sensitive_words(is_active=true)
       ├─ 大小写不敏感、Aho-Corasick 多模式匹配
       ├─ 命中 severity=block → 422 + 命中词（脱敏）回给前端
       └─ 通过 → 透传到原 insert/update RPC
```

### 9.3 词库运营

- 增删：管理员后台
- 批量导入：CSV（`word,severity,note`），上限 5000 行/次
- 命中日志：暂不落库（P2 议）

### 9.4 边界

- v2 **不**做语义分析（ML 模型），仅字符串匹配
- 不做图片 OCR
- 不做语音/视频

---

## 10. 非功能需求

### 10.1 性能

| 指标 | 目标 |
| --- | --- |
| 列表页首屏 TTFB | < 400 ms（Vercel 边缘） |
| 接口 P95 | < 600 ms（含 DB） |
| 看板聚合接口 P95 | < 1.2 s |
| Realtime 推送时延 | < 2 s |
| LCP | < 2.5 s（4G 模拟） |

### 10.2 i18n

- 全部 UI 文案走 `i18n.json`
- 错误信息双语（前后端）
- 日期/货币按 locale 格式化（`Intl.DateTimeFormat` / `Intl.NumberFormat`）
- 邮件双语

### 10.3 可观测

- 前端：Vercel Web Analytics（基础流量 + Web Vitals）
- 后端：Supabase Logs（pg + functions）
- 邮件：Resend Dashboard
- 是否引入 Sentry：见 §13 开放问题

### 10.4 安全

- 密码：Supabase Auth 默认 bcrypt
- 凭据：`VITE_SUPABASE_ANON_KEY` 公开；`SUPABASE_SERVICE_ROLE_KEY` 仅 Edge Function / migrations
- CSP：Vercel Headers 强制 `default-src 'self'`，允许 Supabase/Realtime/Resend 域名
- 速率限制：Edge Function 简单 token-bucket（IP 维度）
- PII：`id_card_no` 用 pgcrypto 加密字段；其他不存明文敏感数据

### 10.5 浏览器兼容

- 目标：最近 2 个版本的 Chrome / Edge / Safari / Firefox
- 不支持 IE；不强制移动端 Webkit

### 10.6 可访问性

- 表单字段必须 `<label>` 关联
- 颜色对比度 ≥ 4.5:1
- 键盘可达：弹层 Esc 关闭、Tab 顺序合理
- 不做完整 WCAG AA 审计（MVP 不要求）

---

## 11. 部署与基础设施

### 11.1 环境

| 环境 | 用途 | 前端 | 后端 |
| --- | --- | --- | --- |
| local | 本地开发 | Vite dev | `supabase start`（Docker） |
| preview | PR 预览 | Vercel Preview | 共享 dev project（命名空间隔离） |
| staging | 上线前验证 | Vercel staging 分支 | Supabase 独立 project |
| production | 正式 | Vercel main 分支 | Supabase 独立 project |

### 11.2 必备服务

| 服务 | 用途 | 免费额度 | 备注 |
| --- | --- | --- | --- |
| Supabase | DB / Auth / Realtime / Storage / Edge Functions | 500MB DB / 1GB 存储 / 50k MAU | Free tier |
| Vercel | 前端部署 | 100GB 流量 / 无限 Preview | Hobby |
| Resend | 邮件 | 100 封/日，3000/月 | Free；需绑域名 |
| Cloudflare R2 | 图片备份（可选） | 10GB / 1k 万次读 | Free |

### 11.3 域名与 DNS

- 主域：`venue-booking.example.com`（待定）
- 邮件 SPF/DKIM/DMARC 指向 Resend

### 11.4 CI/CD

- 前端：PR → Vercel Preview；merge main → production
- 数据库：`supabase/migrations/*` 文件化，CI 中跑 `supabase db lint`；生产用 `supabase db push --include-all`（仅在 main 分支）
- Edge Function：随 migrations 一起走，PR 中跑 `supabase functions deploy --no-verify-jwt`（仅 staging）

### 11.5 监控告警

- Supabase：DB 容量 > 80% 邮件告警
- Vercel：4xx/5xx 率 > 5% 告警
- Resend：发送失败率 > 5% 告警

---

## 12. 里程碑规划

| 阶段 | 周期 | 范围 | 验收 |
| --- | --- | --- | --- |
| **P0 — 基建** | W1 | 仓库脚手架、Supabase 项目、RLS 骨架、CI、首个 migration | `supabase db reset` 通过；Vercel Preview 可访问 |
| **P1 — 认证 + 入驻** | W2 | US-001/002/003/004、owner_applications、US-201/202 | 注册→验证→登录→提交申请→审核→成为 owner 全链路 |
| **P2 — 场地 + 时段** | W3 | US-203、venues/venue_services/slots、Edge Function 时段生成 | 场主创建场地 + 用户看到可订时段 |
| **P3 — 预订 + 通知** | W4 | US-103/104/106、bookings 状态机、邮件 + 实时 | 用户下单→确认→邮件→收件箱；取消链路 |
| **P4 — 管理员 + 看板 + 敏感词** | W5 | US-301/302/303、看板聚合 Edge Function、敏感词 Edge Function | 看板数据可见；敏感词命中即拒绝 |
| **P5 — 收尾 + 审计** | W6 | US-304/305/402/403、Edge Function 模板、审计日志、i18n 全量对齐 | 全部 P0 用户故事验收通过；无 P0/P1 bug |

> 实际周期按团队节奏 ±1 周浮动。

---

## 13. 风险与开放问题

### 13.1 风险

| 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- |
| Supabase Free 500MB 不够 | 中 | 中 | 早期清理 `audit_logs`；半年后视情况升级 |
| Resend 100 封/日不足 | 中 | 中 | 改用 SES 或自建 SMTP（需要时再议） |
| RLS 配置错误导致越权 | 中 | 高 | Code review + 集成测试 + 定期 `supabase test db` |
| 旧用户数据无迁移 | 低 | 低 | v1 数据归档 CSV 备查；v2 重新注册 |
| 邮件进垃圾箱 | 中 | 中 | 严格 SPF/DKIM/DMARC；提供退订链接 |

### 13.2 开放问题（需用户/产品拍板）

> 这些项 PRD 中**已给建议默认值**，等 P0 启动前最终拍板。

| # | 问题 | 建议默认 | 备选 |
| --- | --- | --- | --- |
| OQ-1 | UI 库 | shadcn/ui + Tailwind CSS | MUI / Ant Design |
| OQ-2 | 表单库 | react-hook-form + zod | Formik |
| OQ-3 | 状态管理 | TanStack Query（服务端状态）+ Zustand（少量客户端） | Redux Toolkit |
| OQ-4 | 路由 | React Router v6 | TanStack Router |
| OQ-5 | 图表库 | Recharts | ECharts / Visx |
| OQ-6 | 错误监控 | 暂不接 Sentry（MVP 靠日志） | Sentry Free |
| OQ-7 | 测试 | Vitest（单测）+ Playwright（E2E 关键路径） | Cypress |
| OQ-8 | 包管理 | pnpm | npm / bun |
| OQ-9 | 部署分支 | main = production，staging 分支 | tag 发布 |
| OQ-10 | 域名 | 待用户提供 | — |

---

## 14. 附录：术语表

| 术语 | 含义 |
| --- | --- |
| RLS | Row Level Security，Postgres 行级权限 |
| Edge Function | Supabase 的 Deno Serverless 函数 |
| Realtime | Supabase 基于 Postgres logical replication 的实时推送 |
| Slot | 一个可被预订的最小时间单元（如 60 分钟） |
| Booking | 用户的一次预订，可包含多个 slot 和多个 service |
| Hold | slot 在下单页被临时锁定的中间态，10 分钟自动释放 |
| 入驻申请 | 用户从 user 升级为 owner 的审核流程 |

---

**变更记录**

| 日期 | 版本 | 变更人 | 变更内容 |
| --- | --- | --- | --- |
| 2026-06-08 | v0.1.0 | Codex | 初稿，覆盖 10 条已确认决策；待用户评审 |
