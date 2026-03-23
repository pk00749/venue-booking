# 场地预订系统

微信小程序 + FastAPI + MongoDB 的场地预订管理平台。

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | 微信小程序 |
| **后端** | Python FastAPI |
| **数据库** | MongoDB |
| **认证** | 微信授权登录 |

## 功能特性

### 用户端
- 🔍 浏览场地、按类型/区域筛选
- 📅 选择日期和时段预订
- 🛒 添加附加服务（租球、租拍等）
- 📋 查看我的预订、取消预订

### 场主端
- 🏟️ 创建和管理场地
- ⏰ 设置开放时段和价格
- ✅ 审核预订（可选）
- 📊 查看预订记录

## 项目结构

```
venue-booking/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── main.py        # 应用入口
│   │   ├── config.py      # 配置
│   │   ├── database.py    # 数据库连接
│   │   ├── models/        # 数据模型
│   │   ├── routers/       # API 路由
│   │   └── services/      # 业务逻辑
│   ├── requirements.txt
│   └── .env.example
├── frontend/          # 微信小程序
│   ├── pages/             # 页面
│   ├── components/        # 组件
│   ├── utils/             # 工具函数
│   └── app.json
├── deploy/            # 部署配置
├── tasks/             # PRD 文档
└── prd.json           # Ralph Loop 进度
```

## 快速开始

### 后端

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入微信 AppID/Secret

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 小程序

1. 使用微信开发者工具打开 `frontend/` 目录
2. 在 `project.config.json` 中填入 AppID
3. 点击编译预览

## API 文档

启动后端后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/wechat` | POST | 微信授权登录 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/venues` | GET | 场地列表 |
| `/api/venues/:id` | GET | 场地详情 |
| `/api/venues/:id/slots` | GET | 可用时段 |
| `/api/bookings` | POST | 创建预订 |
| `/api/bookings` | GET | 我的预订 |
| `/api/bookings/:id/cancel` | PUT | 取消预订 |

## 数据模型

### Users
```javascript
{
  _id: ObjectId,
  openid: String,        // 微信 openid
  nickname: String,
  avatar: String,
  phone: String,
  role: String,          // "user" | "owner" | "admin"
  created_at: Date
}
```

### Venues
```javascript
{
  _id: ObjectId,
  owner_id: ObjectId,
  name: String,
  type: String,          // "badminton" | "basketball" | "football"
  address: String,
  images: [String],
  open_time: { start: "08:00", end: "22:00" },
  slot_duration: 60,     // 分钟
  require_approval: Boolean,
  cancel_hours: 2,       // 开场前可取消小时数
  status: String         // "active" | "inactive"
}
```

### Bookings
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  venue_id: ObjectId,
  slot_id: ObjectId,
  services: [{ name, price, quantity }],
  total_price: Number,
  status: String,        // "pending" | "confirmed" | "cancelled" | "completed"
  contact_name: String,
  contact_phone: String,
  created_at: Date
}
```

## 部署

详见 [deploy/README.md](deploy/)

### 推荐配置

| 配置项 | 推荐值 | 月费用 |
|--------|--------|--------|
| 云服务器 | 2核4G | ~100元 |
| MongoDB | 云数据库/自建 | 0-100元 |
| 域名 | .com | ~60元/年 |
| SSL证书 | Let's Encrypt | 免费 |
| **总计** | - | **~150元/月** |

## 开发进度

- [x] 用户认证（微信登录）- US-001 ✅
- [x] 角色区分 - US-002 ✅
- [x] 场地管理 CRUD - US-003, US-004 ✅
- [x] 附加服务配置 - US-005 ✅
- [x] 时段管理 - US-004 ✅
- [x] 预订流程 - US-007 ✅
- [x] 预订审核 - US-008 ✅
- [x] 取消预订 - US-009 ✅
- [x] 查看预订 - US-010, US-011 ✅
- [ ] 消息通知 - US-012 (P2)

## License

MIT