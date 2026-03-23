#!/bin/bash
# 部署脚本 - 200 用户规模

set -e

echo "🚀 开始部署场地预订系统..."

# ============ 1. 安装依赖 ============
echo "📦 安装系统依赖..."
sudo apt update
sudo apt install -y python3.11 python3-pip python3.11-venv nginx mongodb

# ============ 2. 配置 MongoDB ============
echo "🗄️ 配置 MongoDB..."
sudo systemctl enable mongodb
sudo systemctl start mongodb

# 创建数据库用户
mongo << 'EOF'
use venue_booking
db.createUser({
  user: "venue",
  pwd: "change_this_password",
  roles: ["readWrite"]
})
EOF

# ============ 3. 部署后端 ============
echo "🐍 部署 Python 后端..."
cd /opt/venue-booking/backend

# 虚拟环境
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
echo "⚠️ 请编辑 /opt/venue-booking/backend/.env 填入微信 AppID/Secret"

# Systemd 服务
sudo cp deploy/venue-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable venue-api
sudo systemctl start venue-api

# ============ 4. 配置 Nginx ============
echo "🌐 配置 Nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/venue-booking
sudo ln -sf /etc/nginx/sites-available/venue-booking /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ============ 5. SSL 证书 ============
echo "🔒 配置 SSL 证书..."
read -p "请输入你的域名: " DOMAIN
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMAIN

# ============ 6. 防火墙 ============
echo "🛡️ 配置防火墙..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# ============ 完成 ============
echo ""
echo "✅ 部署完成！"
echo ""
echo "下一步："
echo "1. 编辑 /opt/venue-booking/backend/.env 填入微信配置"
echo "2. 重启服务: sudo systemctl restart venue-api"
echo "3. 检查状态: sudo systemctl status venue-api"
echo "4. 查看日志: sudo journalctl -u venue-api -f"
echo ""
echo "API 地址: https://$DOMAIN/api"
echo ""