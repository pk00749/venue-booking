# venue-booking · frontend

> React 19 + Vite 5 + TypeScript 实现的场地预订系统前端。MVP 阶段数据走内存 mock，接口形态对齐 `../PRD.md` §5，可逐函数替换为 Supabase 调用。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 留空也能跑（mock 模式不需要 Supabase）
npm run dev                  # http://localhost:5173
```

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite dev server（默认 5173） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | 仅 `tsc --noEmit` |

## 演示账号 / 角色切换

- 演示模式：邮箱 + 密码任意非空即可登录（`src/features/auth/api.ts`）
- 登录后在顶部"切换角色"条可在 `user` / `owner` / `admin` 间即时切换（仅 mock，真实环境会按 RBAC 走）
- 三个角色对应不同入口：
  - `user`：浏览场地 → 下单 → 我的预订 → 申请成为场主
  - `owner`：场主控制台（待审预订、新建场地）
  - `admin`：数据看板 / 场主审核 / 敏感词 / 待审预订

## 目录约定

```
src/
├── components/       通用 UI（Layout、LocaleSwitcher、ui 原子）
├── features/         按业务域分：auth / venues / bookings / owner / admin
│   └── <domain>/
│       └── api.ts    数据访问层（mock 实现，Promise 形态可平滑换 supabase）
├── i18n/             zh-CN.json / en-US.json / index.ts
├── lib/              types / store(zustand) / mock-data / sensitive / format
├── pages/            路由级页面
├── App.tsx           路由表 + 角色守卫
└── main.tsx          挂载 React + QueryClient + Router + i18n
```

## i18n

- 双语：`zh-CN`（默认）、`en-US`
- 切换后写进 localStorage（`vb_ui` key），下次打开自动恢复
- 新增文案务必**同时**修改两份 JSON
- 日期/金额用 `lib/format.ts` 的 `Intl.*` 封装，禁止 `toLocaleString` 硬编码

## 当前状态

- ✅ MVP 全流程可走通（注册→登录→浏览→下单→审核→看板）
- ✅ 管理员能力：看板、敏感词词库、场主审核、待审预订
- ✅ i18n 中英切换
- ⏳ Supabase / Resend / 真支付**未接入**（见 `../PRD.md` §2.2 非目标）
- ⏳ 真实数据持久化（当前 HMR / 刷新会重置 mock 数据）

## 下一步

- 把 `src/features/*/api.ts` 的 mock 函数替换为 `supabase.from(...)` 调用
- 加 RLS 策略（`../PRD.md` §6）
- 接 Resend Edge Function 实现邮件通知
- 引入 shadcn/ui 替换 inline Tailwind（AGENTS §13 OQ-1）
