import { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function App() {
  const [cafeterias, setCafeterias] = useState([]);
  const [windows, setWindows] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // 提交表单状态
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    window_id: '',
    name: '',
    ingredients: '',
    price: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [cafeteriasRes, windowsRes, dishesRes] = await Promise.all([
        fetch(`${API_BASE}/cafeterias`),
        fetch(`${API_BASE}/windows`),
        fetch(`${API_BASE}/dishes`)
      ]);
      const [cafeteriasData, windowsData, dishesData] = await Promise.all([
        cafeteriasRes.json(),
        windowsRes.json(),
        dishesRes.json()
      ]);
      setCafeterias(cafeteriasData);
      setWindows(windowsData);
      setDishes(dishesData);
    } catch (err) {
      console.error('获取数据失败:', err);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/dishes/search?q=${encodeURIComponent(searchQuery)}`);
      const results = await res.json();
      setSearchResults(results);
    } catch (err) {
      console.error('搜索失败:', err);
    }
  }

  function getWindowInfo(windowId) {
    return windows.find(w => w.id === windowId) || {};
  }

  function getCafeteriaInfo(cafeteriaId) {
    return cafeterias.find(c => c.id === cafeteriaId) || {};
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.window_id || !formData.name) {
      setSubmitMsg('请选择窗口并输入菜名');
      return;
    }
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch(`${API_BASE}/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSubmitMsg('提交成功！');
        setFormData({ window_id: '', name: '', ingredients: '', price: '' });
        fetchData();
      } else {
        setSubmitMsg('提交失败');
      }
    } catch (err) {
      setSubmitMsg('提交失败: ' + err.message);
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">食堂菜单检索</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {showAddForm ? '关闭' : '我要提交'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 提交表单 */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">提交新菜品</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择窗口</label>
                <select
                  value={formData.window_id}
                  onChange={e => setFormData({ ...formData, window_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择食堂窗口</option>
                  {cafeterias.map(caf => (
                    <optgroup key={caf.id} label={caf.name}>
                      {windows
                        .filter(w => w.cafeteria_id === caf.id)
                        .map(w => (
                          <option key={w.id} value={w.id}>
                            {caf.name} - {w.name} ({w.window_no})
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入菜名"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">主要食材（用逗号分隔）</label>
                <input
                  type="text"
                  value={formData.ingredients}
                  onChange={e => setFormData({ ...formData, ingredients: e.target.value })}
                  placeholder="如：鸡肉, 土豆, 辣椒"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格（元）</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  placeholder="请输入价格"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 transition"
              >
                {submitting ? '提交中...' : '提交'}
              </button>
              {submitMsg && (
                <p className={`text-center ${submitMsg.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
                  {submitMsg}
                </p>
              )}
            </form>
          </div>
        )}

        {/* 搜索框 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="输入菜名或食材进行搜索..."
              className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
            >
              搜索
            </button>
          </form>
        </div>

        {/* 搜索结果 */}
        {isSearching && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">搜索结果 ({searchResults.length} 个)</h2>
            {searchResults.length === 0 ? (
              <p className="text-gray-500">未找到匹配的菜品</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map(dish => {
                  const window = getWindowInfo(dish.window_id);
                  const cafeteria = getCafeteriaInfo(window.cafeteria_id);
                  return (
                    <div key={dish.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-lg">{dish.name}</h3>
                        <p className="text-gray-600 text-sm">
                          {cafeteria.name} - {window.name} ({window.window_no})
                        </p>
                        <p className="text-gray-500 text-sm mt-1">主要食材: {dish.ingredients}</p>
                      </div>
                      <span className="text-blue-600 font-bold text-lg">¥{dish.price}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 全部菜品 */}
        {!isSearching && (
          <div>
            <h2 className="text-lg font-semibold mb-3">全部菜品 ({dishes.length} 个)</h2>
            <div className="space-y-2">
              {dishes.map(dish => {
                const window = getWindowInfo(dish.window_id);
                const cafeteria = getCafeteriaInfo(window.cafeteria_id);
                return (
                  <div key={dish.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{dish.name}</h3>
                      <p className="text-gray-600 text-sm">
                        {cafeteria.name} - {window.name} ({window.window_no})
                      </p>
                      <p className="text-gray-500 text-sm mt-1">主要食材: {dish.ingredients}</p>
                    </div>
                    <span className="text-blue-600 font-bold text-lg">¥{dish.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}