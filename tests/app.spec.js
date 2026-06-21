const { test, expect, _electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

let electronApp;
let window;
let userDataPath;

test.beforeAll(async () => {
  // 启动 Electron 应用
  electronApp = await _electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // 获取第一个窗口
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // 获取用户数据路径
  userDataPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath('userData');
  });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.beforeEach(async () => {
  // 清空数据文件
  const dataPath = path.join(userDataPath, 'data.json');
  if (fs.existsSync(dataPath)) {
    fs.unlinkSync(dataPath);
  }

  // 重新加载应用
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(500);
});

// 辅助函数：添加待办
async function addTodo(window, { title, description, category, priority, remindAt, repeat }) {
  await window.fill('#title', title);
  if (description) await window.fill('#description', description);
  if (category) await window.selectOption('#category', category);
  if (priority) await window.selectOption('#priority', priority);
  if (remindAt) await window.fill('#remindAt', remindAt);
  if (repeat) await window.selectOption('#repeat', repeat);
  await window.click('button[type="submit"]');
  await window.waitForTimeout(300);
}

// 辅助函数：获取待办数量
async function getTodoCount(window) {
  return await window.locator('.todo-item').count();
}

test.describe('添加待办', () => {
  test('应该成功添加一个基本待办', async () => {
    await addTodo(window, { title: '买菜' });

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('买菜');
  });

  test('应该添加带描述的待办', async () => {
    await addTodo(window, {
      title: '写报告',
      description: '整理本周工作进度'
    });

    const desc = await window.locator('.todo-remind').first().textContent();
    expect(desc).toContain('整理本周工作进度');
  });

  test('应该添加带分类和优先级的待办', async () => {
    await addTodo(window, {
      title: '开会',
      category: '工作',
      priority: 'high'
    });

    const categoryTag = await window.locator('.tag-category').first().textContent();
    expect(categoryTag).toBe('工作');

    const priorityTag = await window.locator('.tag-priority-high').first().textContent();
    expect(priorityTag).toBe('高');
  });

  test('应该添加带重复提醒的待办', async () => {
    await addTodo(window, {
      title: '每日站会',
      repeat: 'daily'
    });

    const repeatTag = await window.locator('.tag-repeat').first().textContent();
    expect(repeatTag).toBe('每天');
  });

  test('标题为空时不应提交', async () => {
    const countBefore = await getTodoCount(window);
    await window.click('button[type="submit"]');
    await window.waitForTimeout(300);
    const countAfter = await getTodoCount(window);
    expect(countAfter).toBe(countBefore);
  });
});

test.describe('完成待办', () => {
  test('应该标记待办为已完成', async () => {
    await addTodo(window, { title: '待完成任务' });

    await window.locator('.todo-checkbox').first().check();
    await window.waitForTimeout(300);

    const item = window.locator('.todo-item').first();
    await expect(item).toHaveClass(/completed/);
  });

  test('应该取消完成状态', async () => {
    await addTodo(window, { title: '可取消任务' });

    // 先标记完成
    await window.locator('.todo-checkbox').first().check();
    await window.waitForTimeout(300);

    // 再取消
    await window.locator('.todo-checkbox').first().uncheck();
    await window.waitForTimeout(300);

    const item = window.locator('.todo-item').first();
    await expect(item).not.toHaveClass(/completed/);
  });
});

test.describe('删除待办', () => {
  test('应该删除待办', async () => {
    await addTodo(window, { title: '要删除的任务' });

    // 设置 dialog 处理
    window.once('dialog', dialog => dialog.accept());

    // 点击删除按钮
    await window.locator('.todo-item').first().hover();
    await window.waitForTimeout(200);
    await window.locator('.btn-delete').first().click();
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(0);
  });
});

test.describe('编辑待办', () => {
  test('应该编辑待办标题', async () => {
    await addTodo(window, { title: '原始标题' });

    // 点击编辑按钮
    await window.locator('.todo-item').first().hover();
    await window.waitForTimeout(200);
    await window.locator('.btn-edit').first().click();
    await window.waitForTimeout(300);

    // 修改标题
    await window.fill('#title', '修改后的标题');
    await window.click('button[type="submit"]');
    await window.waitForTimeout(300);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('修改后的标题');
  });
});

test.describe('分类筛选', () => {
  test('应该按分类筛选待办', async () => {
    await addTodo(window, { title: '工作事项', category: '工作' });
    await addTodo(window, { title: '生活事项', category: '生活' });

    // 筛选工作
    await window.selectOption('#filterCategory', '工作');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('工作事项');
  });

  test('选择全部分类应显示所有待办', async () => {
    await addTodo(window, { title: '工作事项', category: '工作' });
    await addTodo(window, { title: '生活事项', category: '生活' });

    // 先筛选工作
    await window.selectOption('#filterCategory', '工作');
    await window.waitForTimeout(300);

    // 再选择全部
    await window.selectOption('#filterCategory', 'all');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(2);
  });
});

test.describe('优先级筛选', () => {
  test('应该按优先级筛选待办', async () => {
    await addTodo(window, { title: '高优先级', priority: 'high' });
    await addTodo(window, { title: '低优先级', priority: 'low' });

    await window.selectOption('#filterPriority', 'high');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('高优先级');
  });
});

test.describe('状态筛选', () => {
  test('应该按完成状态筛选', async () => {
    await addTodo(window, { title: '未完成任务' });
    await addTodo(window, { title: '已完成任务' });

    // 标记第二个为完成
    await window.locator('.todo-checkbox').nth(1).check();
    await window.waitForTimeout(300);

    // 筛选未完成
    await window.selectOption('#filterStatus', 'active');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('未完成任务');
  });

  test('应该筛选已完成待办', async () => {
    await addTodo(window, { title: '未完成任务' });
    await addTodo(window, { title: '已完成任务' });

    // 标记第二个为完成
    await window.locator('.todo-checkbox').nth(1).check();
    await window.waitForTimeout(300);

    // 筛选已完成
    await window.selectOption('#filterStatus', 'completed');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('已完成任务');
  });
});

test.describe('搜索功能', () => {
  test('应该按关键词搜索待办', async () => {
    await addTodo(window, { title: '买苹果' });
    await addTodo(window, { title: '买牛奶' });
    await addTodo(window, { title: '写代码' });

    await window.fill('#searchInput', '买');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(2);
  });

  test('应该搜索描述内容', async () => {
    await addTodo(window, { title: '任务1', description: '重要工作' });
    await addTodo(window, { title: '任务2', description: '普通事项' });

    await window.fill('#searchInput', '重要');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(1);

    const title = await window.locator('.todo-title').first().textContent();
    expect(title).toBe('任务1');
  });

  test('清空搜索应显示所有待办', async () => {
    await addTodo(window, { title: '任务A' });
    await addTodo(window, { title: '任务B' });

    await window.fill('#searchInput', 'A');
    await window.waitForTimeout(300);

    await window.fill('#searchInput', '');
    await window.waitForTimeout(500);

    const count = await getTodoCount(window);
    expect(count).toBe(2);
  });
});

test.describe('统计信息', () => {
  test('应该显示正确的总数', async () => {
    // 确保筛选器为全部状态
    await window.selectOption('#filterStatus', 'all');
    await window.waitForTimeout(500);

    await addTodo(window, { title: '统计任务1' });
    await addTodo(window, { title: '统计任务2' });
    await addTodo(window, { title: '统计任务3' });

    // 等待所有待办添加完成
    await window.waitForTimeout(500);

    // 验证总数统计
    const total = await window.locator('#totalCount').textContent();
    expect(total).toContain('3');
  });

  test('应该正确显示未完成数量', async () => {
    // 确保筛选器为全部状态
    await window.selectOption('#filterStatus', 'all');
    await window.waitForTimeout(500);

    await addTodo(window, { title: '未完成任务A' });
    await addTodo(window, { title: '未完成任务B' });

    // 等待添加完成
    await window.waitForTimeout(500);

    // 验证未完成数量
    const active = await window.locator('#activeCount').textContent();
    expect(active).toContain('2');
  });
});

test.describe('界面交互', () => {
  test('编辑模式应显示取消按钮', async () => {
    await addTodo(window, { title: '测试编辑' });

    await window.locator('.todo-item').first().hover();
    await window.waitForTimeout(200);
    await window.locator('.btn-edit').first().click();
    await window.waitForTimeout(300);

    const cancelBtn = window.locator('#cancelEdit');
    await expect(cancelBtn).toBeVisible();
  });

  test('点击取消应退出编辑模式', async () => {
    await addTodo(window, { title: '测试取消' });

    await window.locator('.todo-item').first().hover();
    await window.waitForTimeout(200);
    await window.locator('.btn-edit').first().click();
    await window.waitForTimeout(300);

    await window.click('#cancelEdit');
    await window.waitForTimeout(300);

    const cancelBtn = window.locator('#cancelEdit');
    await expect(cancelBtn).toBeHidden();

    const formTitle = await window.locator('#formTitle').textContent();
    expect(formTitle).toBe('添加待办');
  });
});

test.describe('提醒通知', () => {
  test('应该有提醒时间显示', async () => {
    // 设置未来时间
    const futureTime = new Date(Date.now() + 3600000);
    const timeStr = futureTime.toISOString().slice(0, 16);

    await addTodo(window, {
      title: '有提醒的任务',
      remindAt: timeStr
    });

    const remindText = await window.locator('.todo-remind').first().textContent();
    expect(remindText).toContain('提醒');
  });
});
