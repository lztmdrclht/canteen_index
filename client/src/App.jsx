import { useState, useEffect } from 'react';

const API_BASE = '/api';

function DishCard({ dish, window, cafeteria, user, token, myRating, myIncorrect, isFavorited, onRate, onReportIncorrect, onToggleFavorite, onDelete, highlight }) {
  const canAct = !!token;
  const canDelete = user?.role === 'admin';

  // 计算平均评分（从 stars 对象计算）
  const calcAvg = (ratings) => {
    if (!ratings || !ratings.stars) return '暂无';
    let total = 0, cnt = 0;
    for (let s = 1; s <= 5; s++) {
      total += s * (ratings.stars[s] || 0);
      cnt += ratings.stars[s] || 0;
    }
    return cnt > 0 ? (total / cnt).toFixed(1) : '暂无';
  };
  const avgRating = calcAvg(dish.ratings);
  // 评分人数
  const ratingCount = dish.ratings?.stars ? Object.values(dish.ratings.stars).reduce((a, b) => a + b, 0) : 0;
  // 获取报错数
  const incorrectCount = dish.ratings?.incorrect || 0;

  return (
    <div id={`dish-${dish.id}`} className={`bg-white rounded-lg shadow p-4 ${highlight ? 'ring-4 ring-yellow-400' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{dish.name}</h3>
          <p className="text-gray-600 text-sm">
            {cafeteria?.name} - {window?.name} ({window?.window_no})
          </p>
          <p className="text-gray-500 text-sm mt-1">主要食材: {dish.ingredients}</p>
          <p className="text-sm mt-1">
            <span className={`px-2 py-0.5 rounded text-xs ${dish.meal_type === '早餐' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
              {dish.meal_type || '正餐'}
            </span>
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-sm items-center">
            <span className="text-yellow-500 font-bold">{avgRating !== '暂无' ? `${avgRating} ★` : '暂无评分'}</span>
            <span className="text-gray-400 text-xs">({ratingCount} 人评分)</span>
            {incorrectCount > 0 && (
              <span className="text-red-400 text-xs">&#9888; 报错 {incorrectCount}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 ml-4">
          <span className="text-blue-600 font-bold text-lg">¥{dish.price}</span>
          {canAct && (
            <button
              onClick={() => onToggleFavorite(dish.id)}
              className={`text-2xl ${isFavorited ? 'text-red-500' : 'text-gray-300'}`}
              title={isFavorited ? '取消收藏' : '收藏'}
            >
              &#9829;
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(dish.id)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              删除
            </button>
          )}
        </div>
      </div>
      {canAct && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 justify-center items-center">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => onRate(dish.id, star)}
                className={`text-2xl transition ${myRating >= star ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                title={`${star}星`}
              >
                ★
              </button>
            ))}
          </div>
          <button
            onClick={() => onReportIncorrect(dish.id)}
            className={`px-2 py-1 rounded text-xs transition ${myIncorrect ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
            title="报错"
          >
            &#9888; 有误
          </button>
        </div>
      )}
      {!canAct && (
        <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">登录后可评价和收藏</p>
      )}
    </div>
  );
}

export default function App() {
  const [cafeterias, setCafeterias] = useState([]);
  const [windows, setWindows] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortRating, setSortRating] = useState(''); // rating 二选一
  const [filterCafeteria, setFilterCafeteria] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ window_id: '', name: '', ingredients: '', price: '', meal_type: '正餐' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [pendingOverride, setPendingOverride] = useState(false);
  const [pendingFavDelete, setPendingFavDelete] = useState(null);
  const [isCreatingWindow, setIsCreatingWindow] = useState(false);
  const [newWindowData, setNewWindowData] = useState({ cafeteria_id: '', name: '', floor: '' });

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authMsg, setAuthMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [myRatings, setMyRatings] = useState({});
  const [myIncorrects, setMyIncorrects] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [userCount, setUserCount] = useState(null);
  const [randomDishId, setRandomDishId] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      fetchMyRatings(savedToken);
      fetchMyIncorrects(savedToken);
      fetchFavorites(savedToken);
      if (JSON.parse(savedUser).role === 'admin') fetchStats(savedToken);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      fetchSearchResults();
    } else {
      setIsSearching(false);
      fetchData();
    }
  }, [searchQuery, sortRating, filterCafeteria]);

  async function fetchData() {
    try {
      const params = new URLSearchParams();
      if (sortRating) params.set('sort', sortRating);
      if (filterCafeteria) params.set('cafeteria_id', filterCafeteria);
      const [cafeteriasRes, windowsRes, dishesRes] = await Promise.all([
        fetch(`${API_BASE}/cafeterias`),
        fetch(`${API_BASE}/windows`),
        fetch(`${API_BASE}/dishes?${params.toString()}`)
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

  async function fetchSearchResults() {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (sortRating) params.set('sort', sortRating);
      if (filterCafeteria) params.set('cafeteria_id', filterCafeteria);
      const res = await fetch(`${API_BASE}/dishes/search?${params.toString()}`);
      const results = await res.json();
      setSearchResults(results);
    } catch (err) {
      console.error('搜索失败:', err);
    }
  }

  async function fetchMyRatings(t) {
    try {
      const res = await fetch(`${API_BASE}/ratings/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      const ratings = await res.json();
      // 分离评分和报错 - 支持新格式 {star: X, incorrect: true} 和旧格式 X
      const newRatings = {};
      const newIncorrects = {};
      for (const [dishId, value] of Object.entries(ratings)) {
        if (typeof value === 'object' && value !== null) {
          if (value.star) newRatings[dishId] = value.star;
          if (value.incorrect) newIncorrects[dishId] = true;
        } else if (value === 'incorrect') {
          newIncorrects[dishId] = true;
        } else if (typeof value === 'number') {
          newRatings[dishId] = value;
        }
      }
      setMyRatings(newRatings);
      setMyIncorrects(newIncorrects);
    } catch (err) {
      console.error('获取评价失败:', err);
    }
  }

  async function fetchMyIncorrects(t) {
    try {
      const res = await fetch(`${API_BASE}/ratings/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      const ratings = await res.json();
      const newIncorrects = {};
      for (const [dishId, value] of Object.entries(ratings)) {
        if (value === 'incorrect') {
          newIncorrects[dishId] = true;
        }
      }
      setMyIncorrects(newIncorrects);
    } catch (err) {
      console.error('获取报错失败:', err);
    }
  }

  async function fetchStats(t) {
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      const data = await res.json();
      setUserCount(data.userCount);
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  }

  async function fetchFavorites(t) {
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      const favs = await res.json();
      setFavorites(favs);
    } catch (err) {
      console.error('获取收藏失败:', err);
    }
  }

  async function handleAuth(endpoint) {
    if (!authForm.username || !authForm.password) {
      setAuthMsg('请填写用户名和密码');
      return;
    }
    setAuthLoading(true);
    setAuthMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setAuthForm({ username: '', password: '' });
        setShowLogin(false);
        setShowRegister(false);
        fetchMyRatings(data.token);
        fetchFavorites(data.token);
      } else {
        setAuthMsg(data.error || '操作失败');
      }
    } catch (err) {
      setAuthMsg('请求失败: ' + err.message);
    }
    setAuthLoading(false);
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
    setMyRatings({});
    setMyIncorrects({});
    setFavorites([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function handleRate(dishId, star) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dish_id: dishId, star })
      });
      if (res.ok) {
        const data = await res.json();
        setDishes(prev => prev.map(d => d.id === dishId ? { ...d, ratings: data.ratings } : d));
        setSearchResults(prev => prev.map(d => d.id === dishId ? { ...d, ratings: data.ratings } : d));
        // 更新我的评分状态
        fetchMyRatings(token);
      }
    } catch (err) {
      console.error('评价失败:', err);
    }
  }

  async function handleReportIncorrect(dishId) {
    if (!token) return;
    const isReported = myIncorrects[dishId];
    try {
      const res = await fetch(`${API_BASE}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dish_id: dishId, incorrect: !isReported })
      });
      if (res.ok) {
        const data = await res.json();
        setDishes(prev => prev.map(d => d.id === dishId ? { ...d, ratings: data.ratings } : d));
        setSearchResults(prev => prev.map(d => d.id === dishId ? { ...d, ratings: data.ratings } : d));
        fetchMyRatings(token);
      }
    } catch (err) {
      console.error('报错失败:', err);
    }
  }

  async function handleToggleFavorite(dishId) {
    if (!token) return;
    const isFav = favorites.some(f => f.id === dishId);
    if (isFav) {
      setPendingFavDelete(dishId);
    } else {
      try {
        await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dish_id: dishId })
        });
        const dish = dishes.find(d => d.id === dishId);
        if (dish) setFavorites(prev => [...prev, dish]);
      } catch (err) {
        console.error('收藏操作失败:', err);
      }
    }
  }

  async function confirmFavDelete() {
    if (!pendingFavDelete || !token) return;
    try {
      await fetch(`${API_BASE}/favorites/${pendingFavDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(prev => prev.filter(f => f.id !== pendingFavDelete));
      setPendingFavDelete(null);
    } catch (err) {
      console.error('取消收藏失败:', err);
    }
  }

  async function handleDelete(dishId) {
    if (!confirm('确定要删除这个菜品吗？')) return;
    try {
      const res = await fetch(`${API_BASE}/dishes/${dishId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDishes(prev => prev.filter(d => d.id !== dishId));
        setSearchResults(prev => prev.filter(d => d.id !== dishId));
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.window_id || !formData.name) {
      setSubmitMsg('请选择窗口并输入菜名');
      return;
    }
    // 表单验证：禁止空格和英文字母，价格上限100
    const nameVal = formData.name.trim();
    const ingVal = (formData.ingredients || '').trim();
    if (/[a-zA-Z\s]/.test(nameVal)) {
      setSubmitMsg('菜名不能包含空格或英文字母');
      return;
    }
    if (ingVal && /[a-zA-Z]/.test(ingVal)) {
      setSubmitMsg('主要食材不能包含英文字母');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (formData.price && (isNaN(priceNum) || priceNum <= 0 || priceNum > 100)) {
      setSubmitMsg('价格必须为 0.01~100 的正数');
      return;
    }

    setSubmitting(true);
    setSubmitMsg('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      // 清理食材：只保留汉字，去掉空格和英文
      const cleanedForm = {
        ...formData,
        ingredients: ingVal ? ingVal.match(/[一-龥]+/g)?.join(',') || '' : ''
      };
      const res = await fetch(`${API_BASE}/dishes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanedForm)
      });
      const data = await res.json();

      if (data.exists) {
        setSubmitMsg(`"${data.existing.name}" 已存在于该窗口，是否覆盖？`);
        setPendingOverride(data.existing);
        setSubmitting(false);
        return;
      }
      if (res.ok) {
        setSubmitMsg('提交成功！');
        setFormData({ window_id: '', name: '', ingredients: '', price: '', meal_type: '正餐' });
        fetchData();
      } else {
        setSubmitMsg(data.error || '提交失败，请先登录');
      }
    } catch (err) {
      setSubmitMsg('提交失败: ' + err.message);
    }
    setSubmitting(false);
  }

  async function handleOverrideConfirm() {
    if (!pendingOverride) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const ingVal2 = (formData.ingredients || '').trim();
      const cleanedForm2 = {
        ...formData,
        ingredients: ingVal2 ? ingVal2.match(/[一-龥]+/g)?.join(',') || '' : ''
      };
      const res = await fetch(`${API_BASE}/dishes/${pendingOverride.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ...cleanedForm2, ratings: pendingOverride.ratings })
      });
      if (res.ok) {
        setSubmitMsg('覆盖成功！');
        setFormData({ window_id: '', name: '', ingredients: '', price: '', meal_type: '正餐' });
        setPendingOverride(false);
        fetchData();
      } else {
        setSubmitMsg('覆盖失败');
      }
    } catch (err) {
      setSubmitMsg('覆盖失败: ' + err.message);
    }
    setSubmitting(false);
  }

  async function handleCreateWindow(e) {
    e.preventDefault();
    if (!newWindowData.cafeteria_id || !newWindowData.name || !newWindowData.floor) return;
    try {
      const res = await fetch(`${API_BASE}/windows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWindowData)
      });
      if (res.ok) {
        const newWindow = await res.json();
        setWindows(prev => [...prev, newWindow]);
        setFormData(prev => ({ ...prev, window_id: String(newWindow.id) }));
        setNewWindowData({ cafeteria_id: '', name: '', floor: '' });
        setIsCreatingWindow(false);
        setSubmitMsg('窗口创建成功！');
      } else {
        setSubmitMsg('创建窗口失败');
      }
    } catch (err) {
      setSubmitMsg('创建窗口失败: ' + err.message);
    }
  }

  function getWindowInfo(windowId) {
    return windows.find(w => w.id === windowId) || {};
  }

  function getCafeteriaInfo(cafeteriaId) {
    return cafeterias.find(c => c.id === cafeteriaId) || {};
  }

  function getFavoriteIds() {
    return favorites.map(f => f.id);
  }

  const displayDishes = showFavoritesOnly ? favorites : (isSearching ? searchResults : dishes);
  const favoriteIds = getFavoriteIds();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">交我吃</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-600">
                  {user.username}
                  {user.role === 'admin' && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1 rounded">管理员</span>}
                  {user.role === 'admin' && userCount !== null && (
                    <button
                      onClick={() => token && fetchStats(token)}
                      className="ml-1 text-xs bg-blue-100 text-blue-600 px-1 rounded hover:bg-blue-200 cursor-pointer"
                      title="点击刷新用户数"
                    >
                      用户: {userCount}
                    </button>
                  )}
                </span>
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`text-sm px-3 py-1 rounded transition ${showFavoritesOnly ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {showFavoritesOnly ? '全部菜品' : '我的收藏'}
                </button>
                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">退出</button>
              </>
            ) : (
              <>
                <button onClick={() => { setShowLogin(true); setShowRegister(false); }} className="text-sm text-blue-500 hover:text-blue-700">登录</button>
                <button onClick={() => { setShowRegister(true); setShowLogin(false); }} className="text-sm text-gray-500 hover:text-gray-700">注册</button>
              </>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
            >
              {showAddForm ? '关闭' : '我要提交'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 登录/注册弹窗 */}
        {(showLogin || showRegister) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{showLogin ? '登录' : '注册'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {authMsg && <p className="text-red-600 text-sm">{authMsg}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAuth(showLogin ? 'login' : 'register')}
                  disabled={authLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {authLoading ? '处理中...' : (showLogin ? '登录' : '注册')}
                </button>
                <button
                  onClick={() => { setShowLogin(false); setShowRegister(false); setAuthMsg(''); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {showLogin ? '还没有账号？' : '已有账号？'}
                <button
                  onClick={() => { setShowLogin(!showLogin); setShowRegister(!showRegister); setAuthMsg(''); }}
                  className="text-blue-500 ml-1"
                >
                  {showLogin ? '去注册' : '去登录'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* 提交表单 */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">提交新菜品</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择窗口</label>
                {!isCreatingWindow ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.window_id}
                      onChange={e => setFormData({ ...formData, window_id: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">请选择食堂窗口</option>
                      {cafeterias.map(caf => (
                        <optgroup key={caf.id} label={caf.name}>
                          {windows.filter(w => w.cafeteria_id === caf.id).map(w => (
                            <option key={w.id} value={w.id}>
                              {caf.name} - {w.name} ({w.window_no})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingWindow(true)}
                      className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      + 新增窗口
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateWindow} className="space-y-2 p-3 bg-gray-50 rounded">
                    <div className="flex gap-2">
                      <select
                        value={newWindowData.cafeteria_id}
                        onChange={e => setNewWindowData({ ...newWindowData, cafeteria_id: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">选择食堂</option>
                        {cafeterias.map(caf => (
                          <option key={caf.id} value={caf.id}>{caf.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsCreatingWindow(false)}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        取消
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newWindowData.name}
                      onChange={e => setNewWindowData({ ...newWindowData, name: e.target.value })}
                      placeholder="窗口名称，如：川菜窗口"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      value={newWindowData.floor}
                      onChange={e => setNewWindowData({ ...newWindowData, floor: e.target.value })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">选择楼层</option>
                      <option value="1F">1F</option>
                      <option value="2F">2F</option>
                      <option value="3F">3F</option>
                    </select>
                    <button
                      type="submit"
                      className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      创建窗口
                    </button>
                  </form>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜名</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="请输入菜名" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">主要食材（用逗号分隔）</label>
                <input type="text" value={formData.ingredients} onChange={e => setFormData({ ...formData, ingredients: e.target.value })} placeholder="如：鸡肉, 土豆, 辣椒" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格（元）</label>
                <input type="number" min="0.01" max="100" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="请输入价格" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">餐类</label>
                <select
                  value={formData.meal_type}
                  onChange={e => setFormData({ ...formData, meal_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="正餐">正餐</option>
                  <option value="早餐">早餐</option>
                </select>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 transition">
                {submitting ? '提交中...' : '提交'}
              </button>
              {submitMsg && <p className={`text-center ${submitMsg.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>{submitMsg}</p>}
              {pendingOverride && !submitting && (
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={handleOverrideConfirm} className="flex-1 py-2 bg-red-500 text-white rounded hover:bg-red-600">确认覆盖</button>
                  <button type="button" onClick={() => { setPendingOverride(false); setSubmitMsg(''); }} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* 收藏删除确认 */}
        {pendingFavDelete && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-red-300">
            <h2 className="text-lg font-semibold text-red-600 mb-3">确认取消收藏</h2>
            <p className="text-gray-600 mb-4">确定要取消收藏这个菜品吗？</p>
            <div className="flex gap-2">
              <button onClick={confirmFavDelete} className="flex-1 py-2 bg-red-500 text-white rounded hover:bg-red-600">确认</button>
              <button onClick={() => setPendingFavDelete(null)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
            </div>
          </div>
        )}

        {/* 搜索框 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={e => { e.preventDefault(); fetchSearchResults(); }} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="输入菜名或食材进行搜索..."
              className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button type="submit" className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium">搜索</button>
          </form>
          {/* 排序与食堂筛选 */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-sm text-gray-500">排序：</span>
            <button
              onClick={() => setSortRating(prev => prev === 'rating' ? '' : 'rating')}
              className={`px-3 py-1 rounded text-sm transition ${sortRating === 'rating' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
            >
              评分最高
            </button>
            <button
              onClick={() => setSortRating(prev => prev === 'incorrect' ? '' : 'incorrect')}
              className={`px-3 py-1 rounded text-sm transition ${sortRating === 'incorrect' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
            >
              报错最多
            </button>
            <span className="text-sm text-gray-500 ml-2">食堂：</span>
            <button
              onClick={() => setFilterCafeteria('')}
              className={`px-3 py-1 rounded text-sm transition ${filterCafeteria === '' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              全部
            </button>
            {cafeterias.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCafeteria(prev => prev === c.id ? '' : String(c.id))}
                className={`px-3 py-1 rounded text-sm transition ${filterCafeteria === String(c.id) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={() => {
                if (displayDishes.length === 0) return;
                const randomDish = displayDishes[Math.floor(Math.random() * displayDishes.length)];
                setRandomDishId(randomDish.id);
                setTimeout(() => {
                  document.getElementById(`dish-${randomDish.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
              className="px-3 py-1 rounded text-sm transition bg-purple-500 text-white hover:bg-purple-600"
            >
              随机菜品
            </button>
          </div>
        </div>

        {/* 菜品列表 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            {showFavoritesOnly ? '我的收藏' : (isSearching ? '搜索结果' : '全部菜品')} ({displayDishes.length} 个)
          </h2>
          {displayDishes.length === 0 ? (
            <p className="text-gray-500">
              {showFavoritesOnly ? '暂无收藏菜品' : (isSearching ? '未找到匹配的菜品' : '暂无菜品')}
            </p>
          ) : (
            <div className="space-y-2">
              {displayDishes.map(dish => {
                const w = getWindowInfo(dish.window_id);
                const c = getCafeteriaInfo(w.cafeteria_id);
                return (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    window={w}
                    cafeteria={c}
                    user={user}
                    token={token}
                    myRating={myRatings[dish.id]}
                    myIncorrect={myIncorrects[dish.id]}
                    isFavorited={favoriteIds.includes(dish.id)}
                    onRate={handleRate}
                    onReportIncorrect={handleReportIncorrect}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDelete}
                    highlight={randomDishId === dish.id}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}