# AGENT.md - 场地预订系统

微信小程序 + FastAPI + MongoDB

## 项目结构

```
venue-booking/
├── backend/           # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── routers/
│   │   └── services/
│   ├── requirements.txt
│   └── .env
├── frontend/          # 微信小程序
│   ├── pages/
│   ├── components/
│   └── app.json
├── tasks/             # PRD 文档
└── prd.json           # Ralph Loop 用
```

## 后端命令

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 开发运行
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 运行测试
pytest

# 类型检查
mypy app
```

## 小程序命令

```bash
cd frontend

# 使用微信开发者工具打开此目录
# 或使用 miniprogram-ci 上传
```

## 环境变量

```bash
# backend/.env
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB=venue_booking
```

## 数据库

MongoDB 数据库，集合：
- users
- venues
- services
- slots
- bookings