### 一、问题描述
**根据问题描述修复，并且填充该文档中以下几点的内容**
1. 右上角的新增项目按钮只在知识库页面时才点击生效，在其他页面点击也应该生效，并且在其他页面点击新增，新增完后需要跳转到知识库页面
2. 右上角的统计按钮现在是无效的，可以去掉
3. 目前点击相关知识卡片是不会显示知识内容的，需要新增该功能，点击卡片弹出编辑框，类似于新增时的编辑框

### 二、修复过程
1. **新增按钮跨页面生效**：
   - 将 `{% include 'modal.html' %}` 从 `templates/index.html` 移到 `templates/base.html` 的 `<head>` 之前，使模态框在所有页面可用
   - 新增 `openAddModal()` 函数处理新建入口，`openEditModal(itemId)` 函数处理编辑入口
   - 保存逻辑增加页面判断：在知识库页面（`/`）保存后刷新列表和标签；在其他页面保存后跳转到 `/`
2. **移除无效的统计按钮**：删除了 `base.html` 顶栏中的 `btn-stats` 按钮代码（统计功能可通过侧边栏访问）
3. **知识卡片点击编辑**：
   - 新增 `GET /api/items/<id>` API 端点获取单条知识的完整数据（含标签）
   - 通过事件代理在 `#card-grid` 上监听点击，根据 `data-id` 获取知识 ID
   - `openEditModal()` 函数通过 API 获取知识数据，打开模态框并预填所有字段（标题、内容、类型、网址、语言、标签）
   - 保存时根据 `editingItemId` 状态判断使用 POST（新建）或 PUT（编辑），保存后刷新列表
   - 编辑态下模态框标题显示"编辑条目"，保存按钮显示"保存修改"

### 三、修复范围
- `templates/base.html`：移除了 `btn-stats` 按钮；添加了 `{% include 'modal.html' %}`
- `templates/index.html`：移除了 `{% include 'modal.html' %}`
- `templates/modal.html`：标题 `h2` 添加了 `id="modal-title"` 以便 JS 动态切换文本
- `app.py`：新增 `GET /api/items/<id>` 接口
- `static/js/app.js`：新增 `editingItemId` 状态、`setupCardClicks()`、`openAddModal()`、`openEditModal()` 函数；改造保存逻辑支持新建和编辑双模式；保存后根据当前页面决定刷新或跳转

### 四、修复结果
- 顶部新增按钮在所有页面均可点击使用，非知识库页面保存后自动跳转到知识库
- 顶部无效的统计按钮已移除
- 点击知识卡片弹出编辑对话框，预填所有字段，支持修改保存
