# 场地预订系统 PRD

## 概述

一个基于微信的运动场馆预订系统，支持场主管理场地、用户预订场地，无需支付功能，适合小型场馆运营。

## 背景

运动场馆预订需求：
- 羽毛球场、篮球场、足球场等
- 场主需要管理多个场地和时段
- 用户需要方便地预订和取消
- 初期无需支付，线下结算
- 预计用户规模 200 人

## 目标用户

- **场主** - 拥有一个或多个场地的经营者
- **普通用户** - 预订场地打球的用户
- **管理员** - 系统管理员（可选）

---

## 用户故事

### US-001: 微信授权登录

**描述：** 作为用户，我想要通过微信授权登录，以便快速使用系统

**验收标准：**
- [ ] 点击按钮跳转微信授权
- [ ] 授权后自动创建用户账号
- [ ] 获取用户昵称和头像
- [ ] 后续访问自动登录
- [ ] 支持退出登录

**优先级：** P0

---

### US-002: 角色区分

**描述：** 作为系统，我需要区分场主和普通用户角色，以便提供不同功能

**验收标准：**
- [ ] 用户表包含 role 字段（owner/user/admin）
- [ ] 场主需要申请或被管理员设置为场主
- [ ] 不同角色看到不同的菜单和功能
- [ ] 支持一个用户同时是场主和普通用户

**优先级：** P0

---

### US-003: 场主创建场地

**描述：** 作为场主，我想要创建我的场地信息，以便用户可以预订

**验收标准：**
- [ ] 场地名称、地址、描述
- [ ] 场地类型（羽毛球/篮球/足球等）
- [ ] 场地照片上传
- [ ] 开放时间段设置
- [ ] 时段价格设置
- [ ] 可用状态开关

**优先级：** P0

---

### US-004: 场主管理时段

**描述：** 作为场主，我想要设置场地的可预订时段，以便用户选择

**验收标准：**
- [ ] 设置营业时间（如 8:00-22:00）
- [ ] 设置时段长度（如 1 小时/2 小时）
- [ ] 批量生成时段
- [ ] 特殊日期设置（节假日价格不同）
- [ ] 暂停/开放特定时段

**优先级：** P0

---

### US-005: 场主配置附加服务

**描述：** 作为场主，我想要配置租球租装备等附加服务，以便提供更多服务

**验收标准：**
- [ ] 添加附加服务项目（租球、租拍、租鞋等）
- [ ] 设置服务价格
- [ ] 设置库存数量
- [ ] 开启/关闭服务

**优先级：** P1

---

### US-006: 用户浏览场地

**描述：** 作为用户，我想要浏览附近或指定的场地，以便选择预订

**验收标准：**
- [ ] 场地列表展示
- [ ] 按类型筛选
- [ ] 按区域筛选
- [ ] 搜索场地名称
- [ ] 查看场地详情

**优先级：** P0

---

### US-007: 用户预订场地

**描述：** 作为用户，我想要预订特定时段的场地，以便打球

**验收标准：**
- [ ] 选择日期
- [ ] 查看可选时段
- [ ] 选择时段
- [ ] 选择附加服务（可选）
- [ ] 填写联系方式
- [ ] 提交预订申请
- [ ] 显示预订成功信息

**优先级：** P0

---

### US-008: 预订审核（可选）

**描述：** 作为场主，我可以选择开启预订审核，以便控制预订

**验收标准：**
- [ ] 场主可设置是否需要审核
- [ ] 无需审核时预订直接成功
- [ ] 需要审核时显示待审核状态
- [ ] 场主可批准或拒绝预订
- [ ] 用户收到审核结果通知

**优先级：** P1

---

### US-009: 取消预订

**描述：** 作为用户，我想要取消预订，以便重新安排时间

**验收标准：**
- [ ] 场主设置取消时限（开场前 N 小时）
- [ ] 在时限内可取消
- [ ] 超过时限不可取消
- [ ] 取消后时段释放
- [ ] 取消记录保留

**优先级：** P0

---

### US-010: 场主查看预订

**描述：** 作为场主，我想要查看所有预订记录，以便管理场地

**验收标准：**
- [ ] 按日期查看预订
- [ ] 按场地查看预订
- [ ] 查看预订详情
- [ ] 导出预订记录

**优先级：** P1

---

### US-011: 用户查看我的预订

**描述：** 作为用户，我想要查看我的预订记录，以便管理预订

**验收标准：**
- [ ] 显示所有预订记录
- [ ] 按状态筛选（待审核/已确认/已取消/已完成）
- [ ] 查看预订详情
- [ ] 快速取消预订

**优先级：** P0

---

### US-012: 微信消息通知

**描述：** 作为用户，我想要收到预订相关的微信通知，以便及时了解状态

**验收标准：**
- [ ] 预订成功通知
- [ ] 审核结果通知
- [ ] 预订提醒（开场前 N 小时）
- [ ] 取消确认通知

**优先级：** P2

---

## 技术方案

### 技术栈

- **前端**：微信小程序
- **后端**：Python (FastAPI)
- **数据库**：MongoDB
- **部署**：云服务器（阿里云/腾讯云）

### 数据模型

```
users
├── _id
├── openid (微信 openid)
├── nickname
├── avatar
├── role: ["owner", "user", "admin"]
├── phone
└── created_at

venues
├── _id
├── owner_id
├── name
├── type: ["badminton", "basketball", "football", ...]
├── address
├── description
├── images[]
├── open_time: {start: "08:00", end: "22:00"}
├── slot_duration: 60 (分钟)
├── require_approval: false
├── cancel_hours: 2 (开场前多少小时可取消)
└── status: ["active", "inactive"]

services (附加服务)
├── _id
├── venue_id
├── name
├── price
├── stock
└── enabled

slots (时段)
├── _id
├── venue_id
├── date
├── start_time
├── end_time
├── price
└── status: ["available", "booked", "blocked"]

bookings
├── _id
├── user_id
├── venue_id
├── slot_id
├── services[]: [{name, price, quantity}]
├── total_price
├── status: ["pending", "confirmed", "cancelled", "completed"]
├── contact_name
├── contact_phone
├── cancel_reason
├── created_at
└── cancelled_at
```

### API 设计

```
认证
POST /api/auth/wechat - 微信授权登录
GET  /api/auth/me - 获取当前用户

场地（场主）
POST /api/venues - 创建场地
PUT  /api/venues/:id - 更新场地
GET  /api/owner/venues - 我的场地

场地（用户）
GET  /api/venues - 场地列表
GET  /api/venues/:id - 场地详情

时段
GET  /api/venues/:id/slots - 获取时段
POST /api/owner/venues/:id/slots/generate - 生成时段

预订
POST /api/bookings - 创建预订
GET  /api/bookings - 我的预订
PUT  /api/bookings/:id/cancel - 取消预订

审核（场主）
GET  /api/owner/bookings - 待审核预订
PUT  /api/owner/bookings/:id/approve - 批准
PUT  /api/owner/bookings/:id/reject - 拒绝
```

---

## 部署方案（200 用户）

### 服务器配置

| 配置项 | 推荐值 | 月费用 |
|--------|--------|--------|
| 云服务器 | 2核4G | ~100元 |
| MongoDB | 云数据库或自建 | 0-100元 |
| 域名 | .com | ~60元/年 |
| SSL证书 | 免费（Let's Encrypt） | 0元 |
| **总计** | - | **~150元/月** |

### 部署步骤

1. **购买服务器**
   - 阿里云/腾讯云 2核4G
   - Ubuntu 22.04
   - 开放端口 80, 443, 22

2. **安装环境**
   ```bash
   # Python
   sudo apt update
   sudo apt install python3.11 python3-pip
   
   # MongoDB
   sudo apt install mongodb
   
   # Nginx
   sudo apt install nginx
   
   # SSL
   sudo apt install certbot python3-certbot-nginx
   ```

3. **部署后端**
   ```bash
   # 克隆代码
   git clone <repo> /opt/venue-booking
   cd /opt/venue-booking
   
   # 虚拟环境
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # 配置环境变量
   cp .env.example .env
   # 编辑 .env 填入微信 AppID/AppSecret
   
   # 启动服务（使用 systemd）
   sudo cp deploy/venue-api.service /etc/systemd/system/
   sudo systemctl enable venue-api
   sudo systemctl start venue-api
   ```

4. **配置 Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location /api {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
       }
       
       location / {
           root /opt/venue-booking/frontend;
           try_files $uri $uri/ /index.html;
       }
   }
   ```

5. **配置 SSL**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

6. **MongoDB 安全**
   ```bash
   # 启用认证
   sudo vim /etc/mongodb.conf
   # security:
   #   authorization: enabled
   
   # 创建用户
   mongo
   > use venue_booking
   > db.createUser({
       user: "venue",
       pwd: "strong_password",
       roles: ["readWrite"]
   })
   ```

---

## 风险和依赖

### 风险
- 微信小程序审核周期（1-7 天）
- 用户隐私政策合规
- 服务器稳定性

### 依赖
- 微信开放平台账号
- 已备案域名
- 云服务器

---

## 里程碑

- [ ] M1: 完成后端核心 API（登录、场地、预订）
- [ ] M2: 完成小程序页面（首页、预订、我的）
- [ ] M3: 场主端功能（场地管理、预订审核）
- [ ] M4: 测试和修复
- [ ] M5: 部署上线
- [ ] M6: 微信小程序审核发布