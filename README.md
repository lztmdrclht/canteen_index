# 交我吃

一个校园食堂菜品搜索平台，支持按菜名和主要食材检索餐厅菜品，提供用户评价和收藏功能。

## 功能特性

- **菜品搜索**：输入菜名或食材关键词，实时模糊匹配搜索对应菜品及所在窗口
- **用户账号**：支持注册、登录，管理员账号可管理菜品
- **菜品评价**：登录用户可对菜品进行「豪吃」「不喜欢」「有误」三种评价，所有人可查看评价数据
- **食堂筛选**：支持按食堂筛选菜品列表
- **按评价排序**：支持按豪吃数、不喜欢数、价格等维度对菜品排序，点击可切换/取消
- **收藏功能**：登录用户可收藏喜欢的菜品，方便快速查找
- **提交菜品**：注册用户可提交新菜品到指定窗口

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS |
| 后端 | Express.js（Node.js） |
| 数据存储 | JSON 文件（本地存储） |

## 本地运行

### 1. 启动后端

```bash
cd server
npm install
npm start
```

后端服务启动于 `http://localhost:3001`

### 2. 启动前端

```bash
cd client
npm install
npm run dev
```

前端访问 `http://localhost:5173`，API 请求自动代理到后端。

## 默认管理员账号

- 用户名：`walnut42`
- 密码：`Keywords314`

## API 概览

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/auth/register | 注册账号 | 公开 |
| POST | /api/auth/login | 登录 | 公开 |
| GET | /api/auth/me | 获取当前用户 | 需登录 |
| GET | /api/cafeterias | 获取食堂列表 | 公开 |
| GET | /api/windows | 获取窗口列表 | 公开 |
| GET | /api/dishes | 获取菜品列表 | 公开 |
| GET | /api/dishes/search?q= | 搜索菜品 | 公开 |
| GET | /api/dishes?sort= | 获取菜品（支持排序） | 公开 |
| POST | /api/dishes | 新增菜品 | 需登录 |
| DELETE | /api/dishes/:id | 删除菜品 | 管理员 |
| POST | /api/ratings | 提交评价 | 需登录 |
| GET | /api/ratings/me | 获取我的评价 | 需登录 |
| GET | /api/favorites | 获取我的收藏 | 需登录 |
| POST | /api/favorites | 添加收藏 | 需登录 |
| DELETE | /api/favorites/:dishId | 取消收藏 | 需登录 |

### 排序参数

`GET /api/dishes?sort=` 及 `GET /api/dishes/search?q=&sort=` 支持以下排序值：

- `love` — 按豪吃数降序
- `dislike` — 按不喜欢数降序
- `price` — 按价格升序