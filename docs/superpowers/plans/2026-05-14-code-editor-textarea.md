# 代码类型条目编辑器增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当知识库模态框中选择"代码"类型时，将内容 textarea 切换为暗色等宽代码编辑风格并支持 Tab 缩进。

**Architecture:** CSS class toggling 控制视觉样式；keydown 事件处理 Tab 缩进；`updateFormFields` 函数集中管理类型切换逻辑。

**Tech Stack:** 原生 JS + Tailwind CSS + 内联 CSS

---

### Task 1: 修改 updateFormFields 实现代码样式切换

**Files:**
- Modify: `static/js/app.js:399-404`

- [ ] **Step 1: 替换 updateFormFields 实现**

将第 399-404 行的 `updateFormFields` 替换为带代码编辑器样式切换的新版本：

```js
function updateFormFields(type) {
  fieldUrl.style.display = type === 'link' ? '' : 'none';
  fieldLanguage.style.display = type === 'code' ? '' : 'none';

  const isCode = type === 'code';
  contentInput.placeholder = isCode ? '粘贴代码...' :
                             type === 'note' ? '写下你的想法...' : '摘要或描述...';
  contentInput.classList.toggle('code-editor', isCode);
  contentInput.classList.toggle('font-body-sm', !isCode);
  contentInput.classList.toggle('font-code', isCode);
  contentInput.rows = isCode ? 12 : 4;
}
```

改动说明：
- 新增 `code-editor` CSS 类切换（驱动视觉风格）
- `font-body-sm` 和 `font-code` 互斥切换
- 代码模式 rows 从 4 增大到 12

- [ ] **Step 2: 验证修改后文件结构**

确认修改后的 `updateFormFields` 前后代码衔接正确（第 398 行 `function getSelectedTags() {` 不变）。

---

### Task 2: 添加 Tab 键缩进事件处理

**Files:**
- Modify: `static/js/app.js:33`（在 DOM refs 后的合适位置追加事件绑定）

- [ ] **Step 1: 在 setupModal 中添加 Tab 键处理**

在 `setupModal()` 函数体内（第 233 行），在关闭花括号 `}` 之前插入：

```js
// Tab key → insert 2 spaces in code editor
contentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && contentInput.classList.contains('code-editor')) {
    e.preventDefault();
    const start = contentInput.selectionStart;
    const end = contentInput.selectionEnd;
    contentInput.value = contentInput.value.substring(0, start) + '  ' + contentInput.value.substring(end);
    contentInput.selectionStart = contentInput.selectionEnd = start + 2;
  }
});
```

位置说明：插入在第 325 行（`saveBtn.addEventListener` 的关闭花括号）之后，第 326 行（`}` 关闭 `setupModal`）之前。

- [ ] **Step 2: 确认事件绑定在正确的 DOM 就绪时机**

`setupModal()` 仅在 `DOMContentLoaded` 后调用，`contentInput` 引用已存在，无需额外检查。

---

### Task 3: 添加 .code-editor CSS 规则

**Files:**
- Modify: `templates/base.html:74-79`（在已有 `<style>` 块内追加）

- [ ] **Step 1: 在 `<style>` 块中添加 .code-editor 样式**

在第 78 行（`.tag-scroll` 规则之后）插入：

```css
  .code-editor {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 14px;
    line-height: 1.6;
    background-color: #181715;
    color: #faf9f5;
    border-color: #1f1e1b;
    min-height: 280px;
    resize: vertical;
  }
  .code-editor:focus {
    border-color: #ffb59d;
    box-shadow: 0 0 0 4px rgba(255, 181, 157, 0.15);
  }
```

- [ ] **Step 2: 验证 CSS 无冲突**

确认类名 `code-editor` 与项目现有 CSS 无命名冲突（grep 确认当前未使用）。

---

### Task 4: 手动验证

- [ ] **Step 1: 启动应用并打开模态框**

```bash
cd /Users/fly/Desktop/AI/myptoject/design-model/stitch-demo1
source venv/bin/activate && python app.py
```

- [ ] **Step 2: 验证类型切换**

1. 点击"新增项目"，默认选择"链接" → textarea 为白色背景、正常字体
2. 点击"代码"类型按钮 → textarea 变暗色背景、等宽字体、rows=12、placeholder 显示"粘贴代码..."
3. 点击"笔记"类型按钮 → textarea 恢复白色背景、rows=4

- [ ] **Step 3: 验证 Tab 缩进**

1. 选择"代码"类型
2. 在 textarea 中按 Tab → 插入 2 个空格，光标不跳到下一个焦点元素
3. 切换回"链接"类型 → Tab 行为恢复默认（跳到下一个表单元素）

- [ ] **Step 4: 验证编辑模式**

1. 点击一个已有的代码类型卡片打开编辑模态框
2. textarea 正确显示为代码编辑样式
3. 内容正确回填
