import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(cors());
app.use(express.json());

// 读取数据
function readData() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

// 保存数据
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 获取食堂列表
app.get('/api/cafeterias', (req, res) => {
  const data = readData();
  res.json(data.cafeterias);
});

// 获取窗口列表（可选食堂筛选）
app.get('/api/windows', (req, res) => {
  const data = readData();
  const cafeteriaId = parseInt(req.query.cafeteria_id);
  let windows = data.windows;
  if (cafeteriaId) {
    windows = windows.filter(w => w.cafeteria_id === cafeteriaId);
  }
  res.json(windows);
});

// 获取菜品列表
app.get('/api/dishes', (req, res) => {
  const data = readData();
  res.json(data.dishes);
});

// 搜索菜品（按菜名/食材模糊搜索）
app.get('/api/dishes/search', (req, res) => {
  const data = readData();
  const q = (req.query.q || '').toLowerCase().trim();

  if (!q) {
    return res.json(data.dishes);
  }

  const results = data.dishes.filter(dish => {
    const nameMatch = dish.name.toLowerCase().includes(q);
    const ingredientsMatch = dish.ingredients.toLowerCase().includes(q);
    return nameMatch || ingredientsMatch;
  });

  res.json(results);
});

// 新增菜品
app.post('/api/dishes', (req, res) => {
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
    price: parseFloat(price) || 0
  };

  data.dishes.push(newDish);
  writeData(data);

  res.json(newDish);
});

// 更新菜品
app.put('/api/dishes/:id', (req, res) => {
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

// 删除菜品
app.delete('/api/dishes/:id', (req, res) => {
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});