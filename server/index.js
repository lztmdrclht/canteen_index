import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

const app = express();
app.use(cors());
app.use(express.json());

// 读取数据
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// 保存数据
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 读取用户数据
function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// 保存用户数据
function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 生成 Token（base64 编码）
function generateToken(user) {
  const payload = { id: user.id, username: user.username, role: user.role };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// 验证 Token
function verifyToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

// 简单哈希密码
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 验证 Token 中间件
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  const token = auth.slice(7);
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Token 无效' });
  }
  req.user = user;
  next();
}

// 管理员中间件
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 初始化用户的收藏列表
function initUserFavorites(userId) {
  const users = readUsers();
  const user = users.users.find(u => u.id === userId);
  if (user && !user.favorites) {
    user.favorites = [];
    writeUsers(users);
  }
}

// ==================== 认证接口 ====================

// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const users = readUsers();
  if (users.users.find(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const newUser = {
    id: Date.now(),
    username,
    password: hashPassword(password),
    role: 'user',
    created_at: new Date().toISOString(),
    favorites: []
  };
  users.users.push(newUser);
  writeUsers(users);
  const token = generateToken(newUser);
  res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role }, token });
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.users.find(u => u.username === username && u.password === hashPassword(password));
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = generateToken(user);
  res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
});

// 获取当前用户
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ==================== 食堂/窗口接口 ====================

// 获取食堂列表
app.get('/api/cafeterias', (req, res) => {
  const data = readData();
  res.json(data.cafeterias);
});

// 获取窗口列表
app.get('/api/windows', (req, res) => {
  const data = readData();
  const cafeteriaId = parseInt(req.query.cafeteria_id);
  let windows = data.windows;
  if (cafeteriaId) {
    windows = windows.filter(w => w.cafeteria_id === cafeteriaId);
  }
  res.json(windows);
});

// 创建窗口
app.post('/api/windows', (req, res) => {
  const data = readData();
  const { cafeteria_id, name, window_no } = req.body;
  if (!cafeteria_id || !name || !window_no) {
    return res.status(400).json({ error: '食堂、窗口名称和编号不能为空' });
  }
  const newWindow = {
    id: Date.now(),
    cafeteria_id: parseInt(cafeteria_id),
    name,
    window_no
  };
  data.windows.push(newWindow);
  writeData(data);
  res.json(newWindow);
});

// ==================== 菜品接口 ====================

// 获取菜品列表（支持排序）
app.get('/api/dishes', (req, res) => {
  const data = readData();
  let dishes = data.dishes;
  const sort = req.query.sort;
  if (sort === 'love') {
    dishes = [...dishes].sort((a, b) => (b.ratings?.love || 0) - (a.ratings?.love || 0));
  } else if (sort === 'dislike') {
    dishes = [...dishes].sort((a, b) => (b.ratings?.dislike || 0) - (a.ratings?.dislike || 0));
  } else if (sort === 'incorrect') {
    dishes = [...dishes].sort((a, b) => (b.ratings?.incorrect || 0) - (a.ratings?.incorrect || 0));
  } else if (sort === 'price') {
    dishes = [...dishes].sort((a, b) => a.price - b.price);
  }
  res.json(dishes);
});

// 搜索菜品
app.get('/api/dishes/search', (req, res) => {
  const data = readData();
  const q = (req.query.q || '').toLowerCase().trim();
  const sort = req.query.sort;
  let results = data.dishes.filter(dish => {
    const nameMatch = dish.name.toLowerCase().includes(q);
    const ingredientsMatch = dish.ingredients.toLowerCase().includes(q);
    return nameMatch || ingredientsMatch;
  });
  if (sort === 'love') {
    results = results.sort((a, b) => (b.ratings?.love || 0) - (a.ratings?.love || 0));
  } else if (sort === 'dislike') {
    results = results.sort((a, b) => (b.ratings?.dislike || 0) - (a.ratings?.dislike || 0));
  } else if (sort === 'incorrect') {
    results = results.sort((a, b) => (b.ratings?.incorrect || 0) - (a.ratings?.incorrect || 0));
  } else if (sort === 'price') {
    results = results.sort((a, b) => a.price - b.price);
  }
  res.json(results);
});

// 新增菜品（需登录）
app.post('/api/dishes', authMiddleware, (req, res) => {
  const data = readData();
  const { window_id, name, ingredients, price } = req.body;
  if (!window_id || !name) {
    return res.status(400).json({ error: 'window_id 和 name 不能为空' });
  }
  const newDish = {
    id: Date.now(),
    window_id: parseInt(window_id),
    name,
    ingredients: ingredients || '',
    price: parseFloat(price) || 0,
    ratings: { love: 0, dislike: 0, incorrect: 0 }
  };
  data.dishes.push(newDish);
  writeData(data);
  res.json(newDish);
});

// 更新菜品
app.put('/api/dishes/:id', authMiddleware, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const { window_id, name, ingredients, price } = req.body;
  const dishIndex = data.dishes.findIndex(d => d.id === id);
  if (dishIndex === -1) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  if (window_id) data.dishes[dishIndex].window_id = parseInt(window_id);
  if (name) data.dishes[dishIndex].name = name;
  if (ingredients !== undefined) data.dishes[dishIndex].ingredients = ingredients;
  if (price !== undefined) data.dishes[dishIndex].price = parseFloat(price);
  writeData(data);
  res.json(data.dishes[dishIndex]);
});

// 删除菜品（仅管理员）
app.delete('/api/dishes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const dishIndex = data.dishes.findIndex(d => d.id === id);
  if (dishIndex === -1) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  data.dishes.splice(dishIndex, 1);
  writeData(data);
  res.json({ success: true });
});

// ==================== 评价接口 ====================

// 提交/更新评价
app.post('/api/ratings', authMiddleware, (req, res) => {
  const { dish_id, type } = req.body;
  if (!dish_id || !type) {
    return res.status(400).json({ error: 'dish_id 和 type 不能为空' });
  }
  if (!['love', 'dislike', 'incorrect'].includes(type)) {
    return res.status(400).json({ error: 'type 必须是 love、dislike 或 incorrect' });
  }
  const data = readData();
  const users = readUsers();
  const dishIndex = data.dishes.findIndex(d => d.id === parseInt(dish_id));
  if (dishIndex === -1) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  if (!data.dishes[dishIndex].ratings) {
    data.dishes[dishIndex].ratings = { love: 0, dislike: 0, incorrect: 0 };
  }

  const userIndex = users.users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (!users.users[userIndex].ratings) {
    users.users[userIndex].ratings = {};
  }

  const prevType = users.users[userIndex].ratings[dish_id];
  if (prevType) {
    data.dishes[dishIndex].ratings[prevType] = Math.max(0, data.dishes[dishIndex].ratings[prevType] - 1);
  }
  data.dishes[dishIndex].ratings[type] = (data.dishes[dishIndex].ratings[type] || 0) + 1;
  users.users[userIndex].ratings[dish_id] = type;

  writeData(data);
  writeUsers(users);
  res.json({ success: true, ratings: data.dishes[dishIndex].ratings });
});

// 获取当前用户的评价
app.get('/api/ratings/me', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.users.find(u => u.id === req.user.id);
  res.json(user?.ratings || {});
});

// ==================== 收藏接口 ====================

// 获取收藏列表
app.get('/api/favorites', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.users.find(u => u.id === req.user.id);
  const favoriteIds = user?.favorites || [];
  const data = readData();
  const favorites = data.dishes.filter(d => favoriteIds.includes(d.id));
  res.json(favorites);
});

// 添加收藏
app.post('/api/favorites', authMiddleware, (req, res) => {
  const { dish_id } = req.body;
  if (!dish_id) {
    return res.status(400).json({ error: 'dish_id 不能为空' });
  }
  const data = readData();
  const dish = data.dishes.find(d => d.id === parseInt(dish_id));
  if (!dish) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  const users = readUsers();
  const userIndex = users.users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (!users.users[userIndex].favorites) {
    users.users[userIndex].favorites = [];
  }
  if (!users.users[userIndex].favorites.includes(parseInt(dish_id))) {
    users.users[userIndex].favorites.push(parseInt(dish_id));
    writeUsers(users);
  }
  res.json({ success: true });
});

// 取消收藏
app.delete('/api/favorites/:dishId', authMiddleware, (req, res) => {
  const dishId = parseInt(req.params.dishId);
  const users = readUsers();
  const userIndex = users.users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (!users.users[userIndex].favorites) {
    users.users[userIndex].favorites = [];
  }
  users.users[userIndex].favorites = users.users[userIndex].favorites.filter(id => id !== dishId);
  writeUsers(users);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});