# Google Stitch 设计 Prompt

> 视觉样式（颜色、字体、圆角、阴影、间距等）已在 DESIGN.md 中定义。以下 prompt 仅描述产品功能、页面结构和交互行为，Stitch 生成时请遵循 DESIGN.md 的设计 token。

## 用法

将以下内容复制粘贴到 Google Stitch 的提示框。分三个页面依次生成。

---

## Page 1: 主列表页（首页）

```
Design the main list page for "KnoMesh" — a personal knowledge base / bookmark manager. Follow the design tokens from the Anthropic Claude design system (DESIGN.md): cream canvas background, coral primary accent, serif display typography for headings, sans-serif for body.

### Layout
- Top full-width search bar, with a search icon inside the input
- Below search: horizontal tab bar — "All" | "Links" | "Notes" | "Code" — active tab highlighted
- Far right of tab bar: a primary "＋" button
- Below tabs: a horizontal scrolling tag filter row — clickable tags, selected = filled state, unselected = outline state
- Main area: a vertically scrolling list of cards
- Far right sidebar (optional): a compact stats widget showing total items and breakdown by type

### Each card contains:
- Left icon or badge representing type (link / note / code)
- Title, truncated to one line
- URL or preview line: smaller text, one line
- Bottom row: tag pills + date aligned right

### Card states:
- Default card
- Hover card
- Empty state: centered illustration + text "Your collection is empty" + a "Save your first item" CTA button

### Responsive:
- 3 columns on desktop, 2 on tablet, 1 on mobile
- Cards fill the column width
```

---

## Page 2: 新增/编辑弹窗

```
Design a modal dialog for adding a new item to the knowledge base.

### Trigger
Clicking the "＋" button on the main page.

### Modal layout:
- Centered overlay with backdrop
- Header: "Add to Library" title + close button
- Type selector at top: 3 icon+label buttons side by side for Link | Note | Code
  - Selected type: active state, unselected: default state

### Form fields (change based on selected type):
- Link mode: URL input + Title input
- Note mode: Title input + large textarea
- Code mode: Title input + Language dropdown (Python, JavaScript, HTML, CSS, etc.) + Code textarea

### Common to all:
- Tags input area: existing tags shown as deletable pills, with a text input that shows autocomplete suggestions
- Bottom: Cancel button + "Save" button (primary CTA)

### States:
- Empty form with placeholder text
- Tag autocomplete: small dropdown when typing
- Save success feedback
- Validation error: highlight on empty required fields + error message
```

---

## Page 3: 统计数据面板

```
Design a stats / insights panel for the knowledge base.

### Position
Sidebar on the main page, or a slide-out panel triggered by a chart icon in the top bar.

### Content blocks (top to bottom):

1. **Total count** — large number + "items saved" label

2. **Type breakdown** — 3 horizontal bars (one per type: links, notes, code)
   - Each bar: label + proportional width + count

3. **Recent activity** — small timeline:
   - "Today" — number of items added
   - "Yesterday" — number of items added
   - "This week" — number of items added

4. **Top tags** — ranked list with relative frequency indicator

### Empty state:
- "Add items to see your stats" with a placeholder illustration
```
