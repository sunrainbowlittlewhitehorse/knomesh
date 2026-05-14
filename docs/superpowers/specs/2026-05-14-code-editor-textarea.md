# 代码类型条目内容编辑器改造

## 概述

在 KnoMesh 知识库的"新增项目"模态框中，当条目类型选择为"代码"时，将内容编辑文本框（textarea）改造为代码编辑风格，提升代码编写体验。

## 改动范围

涉及 2 个文件：
- `static/js/app.js` — 样式切换逻辑 + Tab 缩进
- `templates/base.html` — 新增 `.code-editor` CSS 规则

## 视觉设计

### 代码模式样式（选中"代码"类型时）

| 属性 | 值 |
|------|-----|
| 字体 | `font-code` → `'JetBrains Mono', ui-monospace, monospace` |
| 背景色 | `bg-surface-dark` → `#181715` |
| 文字色 | `text-on-dark` → `#faf9f5` |
| 行数 | `rows="12"`（非代码模式为 `rows="4"`） |
| 边框 | `border-surface-dark-soft` → `#1f1e1b` |
| Focus ring | `ring-primary-fixed-dim/15` → 暗色主题下的 focus 指示 |

### 非代码模式

恢复原有样式（`bg-canvas`、`font-body-sm`、`rows="4"`）。

## 交互设计

### 类型切换联动

`updateFormFields(type)` 增加代码模式检测：

```
if type === 'code':
    添加 .code-editor 类
    placeholder = '粘贴代码...'
    rows = 12
else:
    移除 .code-editor 类
    placeholder = (根据类型)
    rows = 4
```

### Tab 键缩进

在代码模式下，按 Tab 键插入 2 个空格，阻止默认焦点跳转：

```
textarea.keydown:
    if key === 'Tab' AND textarea has .code-editor:
        preventDefault()
        insert '  ' at cursor position
```

## CSS 规则

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

## 状态管理

- 新增状态：无。使用 CSS class toggling 而非独立状态变量。
- 编辑模式：`openEditModal` 中已有 `updateFormFields(item.type)` 调用，自动兼容。

## 测试要点

1. 类型选择"代码" → textarea 变为暗色等宽样式
2. 切换回"链接"/"笔记" → textarea 恢复原有样式
3. 代码模式下按 Tab → 插入 2 空格，不跳转焦点
4. 编辑已有代码条目 → 模态框打开时正确显示代码样式
5. 编辑非代码条目 → 不触发代码样式

## 非目标

- 不引入 CodeMirror/Monaco 等第三方编辑器库
- 不实现语法高亮、行号、括号匹配、自动补全
- 不影响保存逻辑和后端
