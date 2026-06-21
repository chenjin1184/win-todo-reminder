// 全局状态
let todos = [];
let settings = {
  autoLaunch: false,
  categories: ['工作', '生活', '学习', '其他']
};
let editingId = null;

// DOM 元素
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');
const filterPriority = document.getElementById('filterPriority');
const todoForm = document.getElementById('todoForm');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const formTitle = document.getElementById('formTitle');
const editIdInput = document.getElementById('editId');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const prioritySelect = document.getElementById('priority');
const remindAtInput = document.getElementById('remindAt');
const repeatSelect = document.getElementById('repeat');
const cancelEditBtn = document.getElementById('cancelEdit');
const totalCount = document.getElementById('totalCount');
const activeCount = document.getElementById('activeCount');
const autoLaunchCheckbox = document.getElementById('autoLaunch');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');

// 生成 UUID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// 初始化
async function init() {
  const data = await window.electronAPI.loadData();
  todos = data.todos || [];
  settings = { ...settings, ...data.settings };

  // 初始化 UI
  updateCategoryOptions();
  autoLaunchCheckbox.checked = settings.autoLaunch;

  // 渲染列表
  renderTodos();

  // 绑定事件
  bindEvents();

  // 监听通知
  window.electronAPI.onTriggerNotification(handleNotification);
}

// 绑定事件
function bindEvents() {
  // 搜索和筛选
  searchInput.addEventListener('input', renderTodos);
  filterStatus.addEventListener('change', renderTodos);
  filterCategory.addEventListener('change', renderTodos);
  filterPriority.addEventListener('change', renderTodos);

  // 表单提交
  todoForm.addEventListener('submit', handleSubmit);

  // 取消编辑
  cancelEditBtn.addEventListener('click', cancelEdit);

  // 开机自启
  autoLaunchCheckbox.addEventListener('change', async (e) => {
    await window.electronAPI.setAutoLaunch(e.target.checked);
    settings.autoLaunch = e.target.checked;
  });

  // 导出
  exportBtn.addEventListener('click', handleExport);

  // 导入
  importBtn.addEventListener('click', handleImport);
}

// 更新分类选项
function updateCategoryOptions() {
  // 表单分类
  categorySelect.innerHTML = settings.categories
    .map(c => `<option value="${c}">${c}</option>`)
    .join('');

  // 筛选分类
  filterCategory.innerHTML = '<option value="all">全部分类</option>' +
    settings.categories
      .map(c => `<option value="${c}">${c}</option>`)
      .join('');
}

// 渲染待办列表
function renderTodos() {
  const filtered = getFilteredTodos();

  // 更新统计（基于全部待办，不是筛选后的）
  totalCount.textContent = `共 ${todos.length} 项`;
  activeCount.textContent = `未完成 ${todos.filter(t => !t.completed).length} 项`;

  // 清空列表
  todoList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // 排序：未完成优先，高优先级优先，提醒时间近的优先
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(a.remindAt) - new Date(b.remindAt);
  });

  // 渲染每一项
  filtered.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });
}

// 获取筛选后的待办
function getFilteredTodos() {
  const keyword = searchInput.value.toLowerCase().trim();
  const status = filterStatus.value;
  const category = filterCategory.value;
  const priority = filterPriority.value;

  return todos.filter(todo => {
    // 关键词搜索
    if (keyword) {
      const matchTitle = todo.title.toLowerCase().includes(keyword);
      const matchDesc = (todo.description || '').toLowerCase().includes(keyword);
      if (!matchTitle && !matchDesc) return false;
    }

    // 状态筛选
    if (status === 'active' && todo.completed) return false;
    if (status === 'completed' && !todo.completed) return false;

    // 分类筛选
    if (category !== 'all' && todo.category !== category) return false;

    // 优先级筛选
    if (priority !== 'all' && todo.priority !== priority) return false;

    return true;
  });
}

// 创建待办元素
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
  li.dataset.id = todo.id;

  const priorityLabels = { high: '高', medium: '中', low: '低' };
  const repeatLabels = { none: '', daily: '每天', weekly: '每周', monthly: '每月' };

  let remindText = '';
  if (todo.remindAt) {
    const remindDate = new Date(todo.remindAt);
    remindText = formatDateTime(remindDate);
  }

  li.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
    <div class="todo-content">
      <div class="todo-header">
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        <span class="tag tag-priority-${todo.priority}">${priorityLabels[todo.priority]}</span>
      </div>
      <div class="todo-meta">
        <span class="tag tag-category">${todo.category}</span>
        ${todo.repeat !== 'none' ? `<span class="tag tag-repeat">${repeatLabels[todo.repeat]}</span>` : ''}
      </div>
      ${todo.description ? `<div class="todo-remind">${escapeHtml(todo.description)}</div>` : ''}
      ${remindText ? `<div class="todo-remind">提醒: ${remindText}</div>` : ''}
    </div>
    <div class="todo-actions">
      <button class="btn-icon btn-edit" title="编辑">✏️</button>
      <button class="btn-icon btn-delete" title="删除">🗑️</button>
    </div>
  `;

  // 绑定事件
  const checkbox = li.querySelector('.todo-checkbox');
  checkbox.addEventListener('change', () => toggleTodo(todo.id));

  const editBtn = li.querySelector('.btn-edit');
  editBtn.addEventListener('click', () => startEdit(todo.id));

  const deleteBtn = li.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

  return li;
}

// 提交表单
async function handleSubmit(e) {
  e.preventDefault();

  const title = titleInput.value.trim();
  if (!title) return;

  const todoData = {
    title,
    description: descInput.value.trim(),
    category: categorySelect.value,
    priority: prioritySelect.value,
    remindAt: remindAtInput.value ? new Date(remindAtInput.value).toISOString() : null,
    repeat: repeatSelect.value
  };

  if (editingId) {
    // 编辑模式
    const index = todos.findIndex(t => t.id === editingId);
    if (index !== -1) {
      todos[index] = { ...todos[index], ...todoData };
    }
    cancelEdit();
  } else {
    // 新增模式
    todos.push({
      id: generateId(),
      ...todoData,
      completed: false,
      notified: false,
      createdAt: new Date().toISOString()
    });
  }

  await saveTodos();
  renderTodos();
  todoForm.reset();
}

// 切换完成状态
async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    if (!todo.completed) {
      todo.notified = false;
    }
    await saveTodos();
    renderTodos();
  }
}

// 开始编辑
function startEdit(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  editingId = id;
  formTitle.textContent = '编辑待办';
  editIdInput.value = id;
  titleInput.value = todo.title;
  descInput.value = todo.description || '';
  categorySelect.value = todo.category;
  prioritySelect.value = todo.priority;
  repeatSelect.value = todo.repeat || 'none';

  if (todo.remindAt) {
    const date = new Date(todo.remindAt);
    remindAtInput.value = date.toISOString().slice(0, 16);
  } else {
    remindAtInput.value = '';
  }

  cancelEditBtn.style.display = 'block';
  titleInput.focus();
}

// 取消编辑
function cancelEdit() {
  editingId = null;
  formTitle.textContent = '添加待办';
  todoForm.reset();
  cancelEditBtn.style.display = 'none';
}

// 删除待办
async function deleteTodo(id) {
  if (confirm('确定删除这条待办吗？')) {
    todos = todos.filter(t => t.id !== id);
    await saveTodos();
    renderTodos();
  }
}

// 保存数据
async function saveTodos() {
  await window.electronAPI.saveData({
    todos,
    settings
  });
}

// 处理通知
function handleNotification(data) {
  const todo = todos.find(t => t.id === data.id);
  if (!todo) return;

  // 使用系统通知
  if (Notification.permission === 'granted') {
    new Notification(data.title, {
      body: data.body,
      icon: '../assets/icon.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(data.title, {
          body: data.body,
          icon: '../assets/icon.png'
        });
      }
    });
  }

  // 更新重复提醒
  if (todo.repeat && todo.repeat !== 'none') {
    const nextTime = calculateNextRemindTime(new Date(todo.remindAt), todo.repeat);
    todo.remindAt = nextTime.toISOString();
    todo.notified = false;
  } else {
    todo.notified = true;
  }
  saveTodos();
}

// 计算下次提醒时间
function calculateNextRemindTime(currentTime, repeatType) {
  const next = new Date(currentTime);
  switch (repeatType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

// 导出数据
async function handleExport() {
  const result = await window.electronAPI.exportData({ todos, settings });
  if (result.success) {
    showNotification(`数据已导出到: ${result.path}`);
  } else if (result.error !== '已取消') {
    showNotification(`导出失败: ${result.error}`);
  }
}

// 导入数据
async function handleImport() {
  const result = await window.electronAPI.importData();
  if (result.success) {
    const data = result.data;
    if (data.todos) {
      todos = data.todos;
    }
    if (data.settings) {
      settings = { ...settings, ...data.settings };
      autoLaunchCheckbox.checked = settings.autoLaunch;
      updateCategoryOptions();
    }
    await saveTodos();
    renderTodos();
    showNotification('数据导入成功');
  } else if (result.error !== '已取消') {
    showNotification(`导入失败: ${result.error}`);
  }
}

// 显示通知
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// 格式化日期时间
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 启动应用
init();
