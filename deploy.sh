#!/bin/bash

# 食堂查询网站部署脚本
# 使用方法: 将此脚本上传到服务器执行，或手动执行以下命令

echo "=== 步骤1: 安装 Node.js 18.x ==="
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 步骤2: 安装 Nginx ==="
sudo apt update
sudo apt install -y nginx

echo "=== 步骤3: 安装 PM2 ==="
sudo npm install -g pm2

echo "=== 步骤4: 验证安装 ==="
node -v
npm -v
nginx -v

echo "=== 步骤5: 创建项目目录 ==="
sudo mkdir -p /var/www/canteen

echo ""
echo "=== 后续操作请手动执行 ==="
echo "1. 上传后端代码到服务器: scp -r canteen_index/server 用户名@服务器IP:/home/用户名/canteen"
echo "2. 上传前端构建文件: scp -r canteen_index/client/dist/* 用户名@服务器IP:/var/www/canteen/"
echo "3. 复制 data.json 到服务器"
echo ""
echo "=== 上传完成后，执行以下命令 ==="