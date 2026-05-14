### 一、问题描述
**根据问题描述修复，并且填充该文档中以下几点的内容**
1. 删除标签目前是用的浏览器的弹窗，可以实现一个自己的确认弹窗吗，风格保持一致。
2. 没有删除知识删除功能和页面，需要实现删除知识删除功能和页面。

### 二、修复过程
1. **自定义确认弹窗**：
   - 在 `templates/base.html` 中新增确认对话框 HTML（`#confirm-dialog`），使用与系统一致的配色和字体——警告图标 + 错误色、圆角卡片、毛玻璃背景遮罩
   - 新增两个全局函数 `window.showConfirm(message)` 和 `window.showAlert(message)`，均返回 Promise，便于在异步流程中使用
   - `showConfirm` 返回 `true/false` 供调用方判断确认或取消
   - `showAlert` 仅展示信息，点击"确定"关闭
   - 替换 `static/js/tags.js` 中所有 `confirm()` 和 `alert()` 调用为 `window.showConfirm()` 和 `window.showAlert()`
2. **知识条目删除**：
   - 在编辑模态框 `templates/modal.html` 的底部栏左侧新增"删除"按钮（`#btn-delete-item`），默认隐藏
   - 在 `static/js/app.js` 中：
     - 新增 `deleteBtn` DOM 引用
     - `openAddModal()` 时隐藏删除按钮，`openEditModal()` 时显示
     - 删除按钮点击后调用 `window.showConfirm()` 确认，确认后调用 `DELETE /api/items/<id>` 接口
     - 删除成功后关闭模态框，在知识库页面刷新列表，在其他页面跳转到知识库

### 三、修复范围
- `templates/base.html`：新增确认对话框 HTML 结构和 `window.showConfirm()` / `window.showAlert()` 全局函数
- `templates/modal.html`：底部栏改为 flex-between 布局，左侧新增"删除"按钮
- `static/js/tags.js`：删除和错误提示改用自定义弹窗，事件监听改为 async 支持 await
- `static/js/app.js`：新增删除按钮逻辑（显示/隐藏、点击确认、API 调用）

### 四、修复结果
- 所有弹窗使用统一的 KnoMesh 设计风格，不再出现浏览器原生弹窗
- 标签管理页面的删除标签使用自定义确认弹窗
- 知识条目编辑框底部新增删除按钮，支持确认后删除
- 删除后自动刷新或跳转
