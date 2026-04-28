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

// 管理员统计
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const users = readUsers();
  res.json({ userCount: users.users.length });
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
  const { cafeteria_id, name, floor } = req.body;
  if (!cafeteria_id || !name || !floor) {
    return res.status(400).json({ error: '食堂、窗口名称和楼层不能为空' });
  }
  const newWindow = {
    id: Date.now(),
    cafeteria_id: parseInt(cafeteria_id),
    name,
    window_no: floor
  };
  data.windows.push(newWindow);
  writeData(data);
  res.json(newWindow);
});

// ==================== 菜品接口 ====================

function parseSortParam(raw) {
  if (!raw) return [];
  // URLSearchParams may encode comma as %2C, and pass it as a single string
  const decoded = decodeURIComponent(raw);
  if (decoded.includes(',')) return decoded.split(',').map(s => s.trim()).filter(Boolean);
  return [decoded];
}

function getAverageRating(ratings) {
  if (!ratings) return 0;
  // 从 stars 对象计算（兼容新旧格式）
  if (ratings.stars) {
    let total = 0;
    let cnt = 0;
    for (let s = 1; s <= 5; s++) {
      total += s * (ratings.stars[s] || 0);
      cnt += ratings.stars[s] || 0;
    }
    if (cnt === 0) return 0;
    return total / cnt;
  }
  // 旧格式: love, dislike
  if (ratings.love !== undefined || ratings.dislike !== undefined) {
    const love = ratings.love || 0;
    const dislike = ratings.dislike || 0;
    const total = love + dislike;
    if (total === 0) return 0;
    return (love * 5 + dislike * 1) / total;
  }
  return 0;
}

function normalizeRatings(ratings) {
  if (!ratings) return { stars: {1:0, 2:0, 3:0, 4:0, 5:0}, totalStars: 0, count: 0, incorrect: 0 };
  // 已经是新格式
  if (ratings.count !== undefined) {
    if (ratings.incorrect === undefined) ratings.incorrect = 0;
    if (!ratings.stars) ratings.stars = {1:0, 2:0, 3:0, 4:0, 5:0};
    return ratings;
  }
  // 旧格式转换
  const love = ratings.love || 0;
  const dislike = ratings.dislike || 0;
  const incorrect = ratings.incorrect || 0;
  const stars = {1: dislike, 2: 0, 3: 0, 4: 0, 5: love};
  return {
    stars,
    totalStars: love * 5 + dislike * 1,
    count: love + dislike,
    incorrect
  };
}

function applySort(dishes, sortParams) {
  const sorts = [];
  if (Array.isArray(sortParams)) {
    sortParams.forEach(p => sorts.push(...parseSortParam(p)));
  } else {
    sorts.push(...parseSortParam(sortParams));
  }
  if (!sorts.length) return dishes;
  return [...dishes].sort((a, b) => {
    for (const sort of sorts) {
      let cmp = 0;
      if (sort === 'rating') cmp = getAverageRating(b.ratings) - getAverageRating(a.ratings);
      else if (sort === 'incorrect') cmp = (b.ratings?.incorrect || 0) - (a.ratings?.incorrect || 0);
      else if (sort === 'price') cmp = a.price - b.price;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

// 获取菜品列表（支持多维排序、食堂筛选）
app.get('/api/dishes', (req, res) => {
  const data = readData();
  let dishes = data.dishes;
  const cafeteriaId = parseInt(req.query.cafeteria_id);
  if (cafeteriaId) {
    const windowIds = data.windows.filter(w => w.cafeteria_id === cafeteriaId).map(w => w.id);
    dishes = dishes.filter(d => windowIds.includes(d.window_id));
  }
  // 规范化评分数据
  dishes = dishes.map(d => ({ ...d, ratings: normalizeRatings(d.ratings) }));
  res.json(applySort(dishes, req.query.sort));
});

// 搜索菜品
app.get('/api/dishes/search', (req, res) => {
  const data = readData();
  const q = (req.query.q || '').toLowerCase().trim();
  let results = data.dishes.filter(dish => {
    return dish.name.toLowerCase().includes(q) || dish.ingredients.toLowerCase().includes(q);
  });
  const cafeteriaId = parseInt(req.query.cafeteria_id);
  if (cafeteriaId) {
    const windowIds = data.windows.filter(w => w.cafeteria_id === cafeteriaId).map(w => w.id);
    results = results.filter(d => windowIds.includes(d.window_id));
  }
  // 规范化评分数据
  results = results.map(d => ({ ...d, ratings: normalizeRatings(d.ratings) }));
  res.json(applySort(results, req.query.sort));
});

// 新增菜品（需登录）
app.post('/api/dishes', authMiddleware, (req, res) => {
  const data = readData();
  const { window_id, name, ingredients, price, meal_type } = req.body;
  if (!window_id || !name) {
    return res.status(400).json({ error: 'window_id 和 name 不能为空' });
  }
  const existing = data.dishes.find(d => d.window_id === parseInt(window_id) && d.name === name);
  const newDish = {
    id: Date.now(),
    window_id: parseInt(window_id),
    name,
    ingredients: ingredients || '',
    price: parseFloat(price) || 0,
    meal_type: meal_type || '正餐',
    ratings: { stars: {1:0, 2:0, 3:0, 4:0, 5:0}, totalStars: 0, count: 0, incorrect: 0 }
  };
  if (existing) {
    return res.json({ exists: true, existing, newDish });
  }
  data.dishes.push(newDish);
  writeData(data);
  res.json({ success: true, dish: newDish });
});

// 更新菜品
app.put('/api/dishes/:id', authMiddleware, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const { window_id, name, ingredients, price, meal_type } = req.body;
  const dishIndex = data.dishes.findIndex(d => d.id === id);
  if (dishIndex === -1) {
    return res.status(404).json({ error: '菜品不存在' });
  }
  if (window_id) data.dishes[dishIndex].window_id = parseInt(window_id);
  if (name) data.dishes[dishIndex].name = name;
  if (ingredients !== undefined) data.dishes[dishIndex].ingredients = ingredients;
  if (price !== undefined) data.dishes[dishIndex].price = parseFloat(price);
  if (meal_type !== undefined) data.dishes[dishIndex].meal_type = meal_type;
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

// 提交/更新评价（评分或报错）
app.post('/api/ratings', authMiddleware, (req, res) => {
  const { dish_id, star, incorrect } = req.body;
  if (!dish_id) {
    return res.status(400).json({ error: 'dish_id 不能为空' });
  }
  const data = readData();
  const users = readUsers();
  const dishIndex = data.dishes.findIndex(d => d.id === parseInt(dish_id));
  if (dishIndex === -1) {
    return res.status(404).json({ error: '菜品不存在' });
  }

  // 初始化 ratings
  if (!data.dishes[dishIndex].ratings) {
    data.dishes[dishIndex].ratings = { stars: {1:0, 2:0, 3:0, 4:0, 5:0}, totalStars: 0, count: 0, incorrect: 0 };
  }
  if (!data.dishes[dishIndex].ratings.stars) {
    data.dishes[dishIndex].ratings.stars = {1:0, 2:0, 3:0, 4:0, 5:0};
  }
  if (data.dishes[dishIndex].ratings.incorrect === undefined) {
    data.dishes[dishIndex].ratings.incorrect = 0;
  }

  const userIndex = users.users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (!users.users[userIndex].ratings) {
    users.users[userIndex].ratings = {};
  }

  // 兼容新旧格式：旧格式是数字或'incorrect'字符串，新格式是对象{star, incorrect}
  const rawUserRating = users.users[userIndex].ratings[dish_id];
  let prevStar = null;
  let prevIncorrect = false;
  if (typeof rawUserRating === 'object' && rawUserRating !== null) {
    prevStar = typeof rawUserRating.star === 'number' ? rawUserRating.star : null;
    prevIncorrect = rawUserRating.incorrect === true;
  } else if (typeof rawUserRating === 'number') {
    prevStar = rawUserRating;
  } else if (rawUserRating === 'incorrect') {
    prevIncorrect = true;
  }

  // 处理评分
  if (star !== undefined) {
    const starNum = parseInt(star);
    if (![1, 2, 3, 4, 5].includes(starNum)) {
      return res.status(400).json({ error: 'star 必须是 1-5' });
    }

    // 如果点击的星数与当前评价相同，则取消（toggle）
    if (prevStar === starNum) {
      data.dishes[dishIndex].ratings.stars[starNum] = Math.max(0, data.dishes[dishIndex].ratings.stars[starNum] - 1);
      // 重新计算 totalStars 和 count
      let total = 0, cnt = 0;
      for (let s = 1; s <= 5; s++) {
        total += s * (data.dishes[dishIndex].ratings.stars[s] || 0);
        cnt += data.dishes[dishIndex].ratings.stars[s] || 0;
      }
      data.dishes[dishIndex].ratings.totalStars = total;
      data.dishes[dishIndex].ratings.count = cnt;
      // 清除该用户的星级评分，保留报错状态
      const userRating = users.users[userIndex].ratings[dish_id];
      if (typeof userRating === 'object' && userRating !== null) {
        delete userRating.star;
        if (Object.keys(userRating).length === 0) {
          delete users.users[userIndex].ratings[dish_id];
        }
      } else {
        delete users.users[userIndex].ratings[dish_id];
      }
      writeData(data);
      writeUsers(users);
      return res.json({ success: true, ratings: data.dishes[dishIndex].ratings, removed: true });
    }

    // 换其他评分：先扣掉旧的
    if (prevStar !== null) {
      data.dishes[dishIndex].ratings.stars[prevStar] = Math.max(0, data.dishes[dishIndex].ratings.stars[prevStar] - 1);
    }
    // 再加新的
    data.dishes[dishIndex].ratings.stars[starNum]++;
    // 重新计算 totalStars 和 count
    let total = 0, cnt = 0;
    for (let s = 1; s <= 5; s++) {
      total += s * (data.dishes[dishIndex].ratings.stars[s] || 0);
      cnt += data.dishes[dishIndex].ratings.stars[s] || 0;
    }
    data.dishes[dishIndex].ratings.totalStars = total;
    data.dishes[dishIndex].ratings.count = cnt;
    // 更新该用户的评分，保留报错状态
    const userRatingForStar = users.users[userIndex].ratings[dish_id];
    if (typeof userRatingForStar === 'object' && userRatingForStar !== null) {
      userRatingForStar.star = starNum;
    } else {
      users.users[userIndex].ratings[dish_id] = { star: starNum, incorrect: prevIncorrect };
    }

    writeData(data);
    writeUsers(users);
    return res.json({ success: true, ratings: data.dishes[dishIndex].ratings });
  }

  // 处理报错
  if (incorrect !== undefined) {
    const reportIncorrect = incorrect === true || incorrect === 'true';

    // 如果已经报过错，再次点击则取消
    if (prevIncorrect && !reportIncorrect) {
      data.dishes[dishIndex].ratings.incorrect = Math.max(0, (data.dishes[dishIndex].ratings.incorrect || 0) - 1);
      // 清除该用户的报错状态，保留星级评分
      const userRatingForInc = users.users[userIndex].ratings[dish_id];
      if (typeof userRatingForInc === 'object' && userRatingForInc !== null) {
        delete userRatingForInc.incorrect;
        if (Object.keys(userRatingForInc).length === 0) {
          delete users.users[userIndex].ratings[dish_id];
        }
      } else {
        delete users.users[userIndex].ratings[dish_id];
      }
      writeData(data);
      writeUsers(users);
      return res.json({ success: true, ratings: data.dishes[dishIndex].ratings, removed: true });
    }

    // 添加报错
    data.dishes[dishIndex].ratings.incorrect = (data.dishes[dishIndex].ratings.incorrect || 0) + 1;
    // 更新该用户的报错状态，保留星级评分
    const userRatingForAddInc = users.users[userIndex].ratings[dish_id];
    if (typeof userRatingForAddInc === 'object' && userRatingForAddInc !== null) {
      userRatingForAddInc.incorrect = true;
    } else {
      users.users[userIndex].ratings[dish_id] = { star: prevStar, incorrect: true };
    }

    writeData(data);
    writeUsers(users);
    return res.json({ success: true, ratings: data.dishes[dishIndex].ratings });
  }

  return res.status(400).json({ error: '必须提供 star 或 incorrect' });
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