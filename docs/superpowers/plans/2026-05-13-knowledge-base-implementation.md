# KnoMesh 个人知识库 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个本地运行的轻量级知识碎片管理工具，支持链接/笔记/代码的增删改查、标签筛选、全文搜索和统计面板。

**Architecture:** Flask 提供 REST API + Jinja2 服务端渲染，前端用 Vanilla JS 处理交互（弹窗、搜索、筛选），数据存储在本地 SQLite。CSS 直接复用 Stitch 生成的 Tailwind CDN 方案。

**Tech Stack:** Python 3.10+, Flask, Jinja2, SQLite, Tailwind CSS (CDN), Vanilla JS, Material Symbols

---

## File Structure

```
stitch-demo1/
├── app.py                         # Flask 应用入口（路由 + 视图）
├── requirements.txt               # 依赖
├── data/                          # SQLite 数据文件目录
├── static/js/
│   └── app.js                     # 前端交互逻辑
├── templates/
│   ├── base.html                  # 布局模板（导航栏 + 侧边栏）
│   ├── index.html                 # 主列表页
│   ├── modal.html                 # 新增/编辑弹窗
│   ├── stats.html                 # 统计面板页
│   └── components/
│       ├── card.html              # 单个条目卡片
│       └── tag_pills.html         # 标签 pill 渲染片段
├── services/
│   ├── __init__.py
│   ├── database.py                # 数据库初始化与连接
│   ├── item_service.py            # 条目 CRUD
│   ├── tag_service.py             # 标签 CRUD + 条目-标签关联
│   └── search_service.py          # 搜索逻辑 + 统计查询
```

**注意：** CSS 样式由 Tailwind CDN 在运行时生成，Tailwind 配置（design token）内嵌在 base.html 中，无需 `static/css/` 目录。

---

### Task 1: 项目脚手架

**Files:**
- Create: `requirements.txt`
- Create: `data/.gitkeep`
- Create: `services/__init__.py`

- [ ] **Step 1: 创建 requirements.txt**

```
flask>=3.0
```

- [ ] **Step 2: 创建 data/.gitkeep 和 services/__init__.py**

```bash
touch data/.gitkeep
```

```python
# services/__init__.py
```

---

### Task 2: 数据库层 (database.py)

**Files:**
- Create: `services/database.py`

- [ ] **Step 1: 创建 database.py**

```python
import sqlite3
import os

DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'knowledge.db')


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS items (
            id          TEXT PRIMARY KEY,
            type        TEXT NOT NULL CHECK(type IN ('link', 'note', 'code')),
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            url         TEXT,
            language    TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
            id    TEXT PRIMARY KEY,
            name  TEXT UNIQUE NOT NULL,
            color TEXT NOT NULL DEFAULT '#8f482f'
        );

        CREATE TABLE IF NOT EXISTS item_tags (
            item_id TEXT NOT NULL,
            tag_id  TEXT NOT NULL,
            PRIMARY KEY (item_id, tag_id),
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id)  REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
        CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
        CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);
    """)
    conn.commit()
    conn.close()
```

---

### Task 3: 条目服务 (item_service.py)

**Files:**
- Create: `services/item_service.py`

- [ ] **Step 1: 创建 item_service.py**

```python
import uuid
from datetime import datetime, timezone
from services.database import get_db


def list_items(type_filter=None, tags=None, q=None, offset=0, limit=24):
    conn = get_db()
    params = []
    conditions = []

    if type_filter and type_filter != 'all':
        conditions.append("i.type = ?")
        params.append(type_filter)

    if q:
        conditions.append("(i.title LIKE ? OR i.content LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    where = " AND ".join(conditions) if conditions else "1=1"

    # Get total count
    count_sql = f"SELECT COUNT(*) FROM items i WHERE {where}"
    total = conn.execute(count_sql, params).fetchone()[0]

    # Get items
    items_sql = f"""
        SELECT i.* FROM items i
        WHERE {where}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
    """
    items = conn.execute(items_sql, params + [limit, offset]).fetchall()

    # Filter by tags (post-query since tags is many-to-many)
    result = []
    for row in items:
        item = dict(row)
        item['tags'] = _get_tags_for_item(conn, item['id'])
        item['tag_names'] = [t['name'] for t in item['tags']]
        if tags:
            if not all(tag in item['tag_names'] for tag in tags):
                continue
        result.append(item)

    conn.close()
    return result, total


def get_item(item_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row:
        item = dict(row)
        item['tags'] = _get_tags_for_item(conn, item['id'])
        conn.close()
        return item
    conn.close()
    return None


def create_item(data):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    item_id = str(uuid.uuid4())

    conn.execute(
        """INSERT INTO items (id, type, title, content, url, language, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (item_id, data['type'], data['title'], data.get('content', ''),
         data.get('url'), data.get('language'), now, now)
    )

    # Attach tags
    tag_ids = _resolve_tags(conn, data.get('tags', []))
    for tag_id in tag_ids:
        conn.execute("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
                     (item_id, tag_id))

    conn.commit()
    conn.close()
    return get_item(item_id)


def update_item(item_id, data):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()

    fields = []
    params = []
    for key in ('type', 'title', 'content', 'url', 'language'):
        if key in data:
            fields.append(f"{key} = ?")
            params.append(data[key])

    if fields:
        fields.append("updated_at = ?")
        params.append(now)
        params.append(item_id)
        conn.execute(f"UPDATE items SET {', '.join(fields)} WHERE id = ?", params)

    if 'tags' in data:
        conn.execute("DELETE FROM item_tags WHERE item_id = ?", (item_id,))
        tag_ids = _resolve_tags(conn, data['tags'])
        for tag_id in tag_ids:
            conn.execute("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
                         (item_id, tag_id))

    conn.commit()
    conn.close()
    return get_item(item_id)


def delete_item(item_id):
    conn = get_db()
    conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()


def _get_tags_for_item(conn, item_id):
    rows = conn.execute(
        """SELECT t.* FROM tags t
           JOIN item_tags it ON t.id = it.tag_id
           WHERE it.item_id = ?
           ORDER BY t.name""",
        (item_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def _resolve_tags(conn, tag_names):
    tag_ids = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        existing = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
        if existing:
            tag_ids.append(existing['id'])
        else:
            tag_id = str(uuid.uuid4())
            conn.execute("INSERT INTO tags (id, name) VALUES (?, ?)", (tag_id, name))
            tag_ids.append(tag_id)
    return tag_ids
```

---

### Task 4: 标签服务 (tag_service.py)

**Files:**
- Create: `services/tag_service.py`

- [ ] **Step 1: 创建 tag_service.py**

```python
import uuid
from services.database import get_db


def list_tags():
    conn = get_db()
    rows = conn.execute(
        """SELECT t.*, COUNT(it.item_id) as item_count
           FROM tags t
           LEFT JOIN item_tags it ON t.id = it.tag_id
           GROUP BY t.id
           ORDER BY item_count DESC, t.name"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_tag(name, color='#8f482f'):
    conn = get_db()
    tag_id = str(uuid.uuid4())
    try:
        conn.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)",
                     (tag_id, name, color))
        conn.commit()
        tag = dict(conn.execute("SELECT * FROM tags WHERE id = ?", (tag_id,)).fetchone())
        conn.close()
        return tag
    except Exception:
        conn.close()
        return None


def delete_tag(tag_id):
    conn = get_db()
    conn.execute("DELETE FROM item_tags WHERE tag_id = ?", (tag_id,))
    conn.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    conn.commit()
    conn.close()


def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    by_type = conn.execute(
        "SELECT type, COUNT(*) as count FROM items GROUP BY type"
    ).fetchall()
    by_type = {r['type']: r['count'] for r in by_type}

    recent_days = conn.execute(
        """SELECT DATE(created_at) as day, COUNT(*) as count
           FROM items WHERE created_at >= DATE('now', '-7 days')
           GROUP BY day ORDER BY day DESC"""
    ).fetchall()
    recent_days = [dict(r) for r in recent_days]

    top_tags = conn.execute(
        """SELECT t.name, COUNT(it.item_id) as count
           FROM tags t
           JOIN item_tags it ON t.id = it.tag_id
           GROUP BY t.id
           ORDER BY count DESC
           LIMIT 10"""
    ).fetchall()
    top_tags = [dict(r) for r in top_tags]

    conn.close()
    return {
        'total': total,
        'by_type': by_type,
        'recent': recent_days,
        'top_tags': top_tags,
    }
```

---

### Task 5: 搜索服务 (search_service.py)

**Files:**
- Create: `services/search_service.py`

- [ ] **Step 1: 创建 search_service.py**

```python
# 搜索逻辑已整合在 item_service.list_items() 的 q 参数中。
# 此文件保留为后续 FTS5 全文搜索扩展预留。

def highlight(text, query, max_len=200):
    """截断文本并高亮匹配关键词（返回截断后的字符串，高亮由前端处理）"""
    if not query or not text:
        return text[:max_len] if text else ''
    lower = text.lower()
    idx = lower.find(query.lower())
    if idx == -1:
        return text[:max_len]
    start = max(0, idx - 60)
    end = min(len(text), idx + len(query) + 60)
    snippet = text[start:end]
    if start > 0:
        snippet = '...' + snippet
    if end < len(text):
        snippet = snippet + '...'
    return snippet[:max_len]
```

---

### Task 6: Flask 应用入口 + API 路由 (app.py)

**Files:**
- Create: `app.py`

- [ ] **Step 1: 创建 app.py**

```python
import json
from flask import Flask, request, jsonify, render_template
from services.database import init_db
from services.item_service import list_items, get_item, create_item, update_item, delete_item
from services.tag_service import list_tags, create_tag, delete_tag, get_stats
from services.search_service import highlight

app = Flask(__name__)


def api_ok(data=None, status=200):
    return jsonify({'ok': True, 'data': data}), status


def api_error(message, status=400):
    return jsonify({'ok': False, 'error': message}), status


# ---- HTML Pages ----

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/stats')
def stats():
    return render_template('stats.html')


# ---- Items API ----

@app.route('/api/items')
def api_list_items():
    type_filter = request.args.get('type')
    tags = request.args.getlist('tag')
    q = request.args.get('q')
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 24, type=int)
    items, total = list_items(type_filter=type_filter, tags=tags, q=q, offset=offset, limit=limit)
    has_more = (offset + limit) < total
    return api_ok({
        'items': items,
        'total': total,
        'offset': offset,
        'limit': limit,
        'has_more': has_more,
    })


@app.route('/api/items', methods=['POST'])
def api_create_item():
    data = request.get_json()
    if not data or not data.get('title') or not data.get('type'):
        return api_error('title and type are required')
    if data['type'] not in ('link', 'note', 'code'):
        return api_error('type must be link, note, or code')
    item = create_item(data)
    return api_ok(item, 201)


@app.route('/api/items/<item_id>', methods=['PUT'])
def api_update_item(item_id):
    existing = get_item(item_id)
    if not existing:
        return api_error('item not found', 404)
    data = request.get_json()
    item = update_item(item_id, data)
    return api_ok(item)


@app.route('/api/items/<item_id>', methods=['DELETE'])
def api_delete_item(item_id):
    existing = get_item(item_id)
    if not existing:
        return api_error('item not found', 404)
    delete_item(item_id)
    return api_ok({'deleted': True})


# ---- Tags API ----

@app.route('/api/tags')
def api_list_tags():
    tags = list_tags()
    return api_ok(tags)


@app.route('/api/tags', methods=['POST'])
def api_create_tag():
    data = request.get_json()
    if not data or not data.get('name'):
        return api_error('name is required')
    tag = create_tag(data['name'], data.get('color', '#8f482f'))
    if tag is None:
        return api_error('tag already exists')
    return api_ok(tag, 201)


@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def api_delete_tag(tag_id):
    delete_tag(tag_id)
    return api_ok({'deleted': True})


# ---- Stats API ----

@app.route('/api/stats')
def api_stats():
    return api_ok(get_stats())


# ---- Export / Import ----

@app.route('/api/export')
def api_export():
    from services.database import get_db
    conn = get_db()
    items = conn.execute(
        "SELECT id, type, title, content, url, language, created_at, updated_at FROM items ORDER BY created_at"
    ).fetchall()
    tags = conn.execute("SELECT * FROM tags").fetchall()
    item_tags = conn.execute("SELECT * FROM item_tags").fetchall()
    conn.close()
    return api_ok({
        'version': '1.0',
        'exported_at': __import__('datetime').datetime.now().isoformat(),
        'items': [dict(i) for i in items],
        'tags': [dict(t) for t in tags],
        'item_tags': [dict(it) for it in item_tags],
    })


@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.get_json()
    if not data or 'items' not in data:
        return api_error('invalid import format')
    from services.database import get_db
    conn = get_db()
    imported = 0
    for item in data.get('items', []):
        conn.execute(
            """INSERT OR REPLACE INTO items (id, type, title, content, url, language, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (item['id'], item['type'], item['title'], item.get('content', ''),
             item.get('url'), item.get('language'), item['created_at'], item['updated_at'])
        )
        imported += 1
    conn.commit()
    conn.close()
    return api_ok({'imported': imported})


# ---- Startup ----

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
```

---

### Task 7: Base 模板 (base.html)

**Files:**
- Create: `templates/base.html`

从 `knomesh_1/code.html` 提取布局骨架，包含 Tailwind 配置、导航栏、侧边栏，留出 `{% block content %}` 区域。

- [ ] **Step 1: 创建 base.html**

```html
<!DOCTYPE html>
<html class="light" lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "error": "#c64545", "on-primary": "#ffffff", "primary": "#8f482f",
        "primary-active": "#a9583e", "primary-disabled": "#e6dfd8",
        "success": "#5db872", "warning": "#d4a017",
        "on-dark-soft": "#a09d96", "on-dark": "#faf9f5",
        "body-strong": "#252523", "body": "#3d3d3a",
        "muted-soft": "#8e8b82", "muted": "#6c6a64",
        "ink": "#141413",
        "hairline-soft": "#ebe6df", "hairline": "#e6dfd8",
        "surface-dark-elevated": "#252320", "surface-dark-soft": "#1f1e1b",
        "surface-dark": "#181715",
        "surface-cream-strong": "#e8e0d2",
        "surface-card": "#efe9de", "surface-soft": "#f5f0e8",
        "surface-container": "#faebe6",
        "canvas": "#faf9f5",
        "accent-teal": "#5db8a6", "accent-amber": "#e8a55a",
        "primary-fixed-dim": "#ffb59d", "primary-container": "#ad5f45"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"
      },
      "spacing": {
        "xxs": "4px", "xs": "8px", "sm": "12px", "md": "16px",
        "lg": "24px", "xl": "32px", "xxl": "48px", "section": "96px"
      },
      "fontFamily": {
        "display-xl": ["Copernicus, Tiempos Headline, serif"],
        "display-lg": ["Copernicus, Tiempos Headline, serif"],
        "display-md": ["Copernicus, Tiempos Headline, serif"],
        "display-sm": ["Copernicus, Tiempos Headline, serif"],
        "title-lg": ["StyreneB, Inter, sans-serif"],
        "title-md": ["StyreneB, Inter, sans-serif"],
        "title-sm": ["StyreneB, Inter, sans-serif"],
        "body-md": ["StyreneB, Inter, sans-serif"],
        "body-sm": ["StyreneB, Inter, sans-serif"],
        "button": ["StyreneB, Inter, sans-serif"],
        "nav-link": ["StyreneB, Inter, sans-serif"],
        "caption": ["StyreneB, Inter, sans-serif"],
        "caption-uppercase": ["StyreneB, Inter, sans-serif"],
        "code": ["JetBrains Mono, ui-monospace, monospace"]
      },
      "fontSize": {
        "display-xl": ["64px", {"lineHeight": "1.05", "letterSpacing": "-1.5px", "fontWeight": "400"}],
        "display-lg": ["48px", {"lineHeight": "1.1", "letterSpacing": "-1px", "fontWeight": "400"}],
        "display-md": ["36px", {"lineHeight": "1.15", "letterSpacing": "-0.5px", "fontWeight": "400"}],
        "display-sm": ["28px", {"lineHeight": "1.2", "letterSpacing": "-0.3px", "fontWeight": "400"}],
        "title-lg": ["22px", {"lineHeight": "1.3", "fontWeight": "500"}],
        "title-md": ["18px", {"lineHeight": "1.4", "fontWeight": "500"}],
        "title-sm": ["16px", {"lineHeight": "1.4", "fontWeight": "500"}],
        "body-md": ["16px", {"lineHeight": "1.55", "fontWeight": "400"}],
        "body-sm": ["14px", {"lineHeight": "1.55", "fontWeight": "400"}],
        "code": ["14px", {"lineHeight": "1.6", "fontWeight": "400"}],
        "button": ["14px", {"lineHeight": "1", "fontWeight": "500"}],
        "nav-link": ["14px", {"lineHeight": "1.4", "fontWeight": "500"}],
        "caption": ["13px", {"lineHeight": "1.4", "fontWeight": "500"}],
        "caption-uppercase": ["12px", {"lineHeight": "1.4", "letterSpacing": "1.5px", "fontWeight": "500"}]
      }
    },
  },
}
</script>
<style>
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; display: inline-block; line-height: 1; }
  body { background-color: #faf9f5; color: #141413; -webkit-font-smoothing: antialiased; }
  .tag-scroll::-webkit-scrollbar { display: none; }
  .tag-scroll { -ms-overflow-style: none; scrollbar-width: none; }
</style>
{% block head %}{% endblock %}
</head>
<body class="bg-canvas">
<!-- Top Nav -->
<header class="fixed top-0 w-full z-50 h-16 flex items-center px-lg bg-canvas border-b border-hairline">
  <div class="max-w-[1200px] mx-auto w-full flex items-center justify-between">
    <div class="flex items-center gap-xl">
      <a href="/" class="font-display-sm text-display-sm font-bold text-primary">KnoMesh</a>
      <div class="hidden md:flex relative items-center">
        <span class="material-symbols-outlined absolute left-3 text-muted">search</span>
        <input id="search-input"
          class="h-10 pl-10 pr-4 w-64 bg-surface-soft border border-hairline rounded-lg text-body-sm focus:ring-3 focus:ring-primary/15 focus:border-primary outline-none transition-all"
          placeholder="搜索知识..." type="text">
      </div>
    </div>
    <div class="flex items-center gap-md">
      <div class="hidden lg:flex items-center gap-lg">
        <a href="/" class="font-nav-link text-nav-link text-primary border-b-2 border-primary pb-2">全部</a>
        <span class="font-nav-link text-nav-link text-secondary pb-2">链接</span>
        <span class="font-nav-link text-nav-link text-secondary pb-2">笔记</span>
        <span class="font-nav-link text-nav-link text-secondary pb-2">代码</span>
      </div>
      <div class="h-6 w-[1px] bg-hairline mx-2 hidden lg:block"></div>
      <button id="btn-add"
        class="flex items-center gap-xs px-md h-10 bg-primary text-on-primary rounded-full hover:bg-primary-active transition-colors font-button text-button">
        <span class="material-symbols-outlined">add</span>
        <span>新增项目</span>
      </button>
      <div class="flex items-center gap-sm">
        <button id="btn-stats" class="p-2 text-secondary hover:bg-hairline-soft rounded-full transition-colors" title="统计">
          <span class="material-symbols-outlined">query_stats</span>
        </button>
      </div>
    </div>
  </div>
</header>

<!-- Sidebar -->
<aside class="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-surface-soft border-r border-hairline hidden lg:flex flex-col p-md gap-xs">
  <div class="mb-lg px-xs">
    <h4 class="font-caption-uppercase text-caption-uppercase text-muted-soft mb-sm">导航</h4>
    <nav class="flex flex-col gap-xxs">
      <a href="/" class="flex items-center gap-md px-md py-sm bg-surface-container text-primary font-bold rounded-lg transition-all">
        <span class="material-symbols-outlined">inventory_2</span>
        <span class="font-body-sm text-body-sm">库</span>
      </a>
      <span class="flex items-center gap-md px-md py-sm text-secondary rounded-lg transition-all">
        <span class="material-symbols-outlined">sell</span>
        <span class="font-body-sm">标签</span>
      </span>
      <a href="/stats" class="flex items-center gap-md px-md py-sm text-secondary hover:bg-hairline-soft rounded-lg transition-all group">
        <span class="material-symbols-outlined group-hover:text-primary transition-colors">query_stats</span>
        <span class="font-body-sm group-hover:text-primary transition-colors">统计</span>
      </a>
    </nav>
  </div>
  <div class="mt-auto px-xs pt-xl border-t border-hairline">
    <p class="font-caption text-caption text-muted-soft">KnoMesh v1.0</p>
  </div>
</aside>

<!-- Main Content -->
<main class="pt-24 pb-section max-w-[1200px] mx-auto px-lg lg:ml-64">
  {% block content %}{% endblock %}
</main>

<script src="{{ url_for('static', filename='js/app.js') }}"></script>
</body>
</html>
```

---

### Task 8: Index 模板 (index.html)

**Files:**
- Create: `templates/index.html`
- Create: `templates/components/card.html`
- Create: `templates/components/tag_pills.html`

- [ ] **Step 1: 创建 tag_pills.html**

```html
{% if tags %}
{% for tag in tags %}
<span class="px-xs py-[2px] bg-hairline-soft rounded text-[11px] font-medium text-muted uppercase tracking-wider">#{{ tag.name }}</span>
{% endfor %}
{% endif %}
```

- [ ] **Step 2: 创建 card.html**

```html
{% set icon_map = {'link': 'link', 'note': 'description', 'code': 'code'} %}
{% set is_dark = item.type == 'code' %}
<div class="group {% if is_dark %}bg-surface-dark{% else %}bg-surface-card{% endif %} p-lg rounded-xl border border-transparent hover:border-hairline hover:shadow-sm transition-all duration-300 cursor-pointer" data-id="{{ item.id }}">
  <div class="flex items-start justify-between mb-md">
    <div class="w-10 h-10 rounded-lg {% if is_dark %}bg-surface-dark-soft{% else %}bg-surface-container{% endif %} flex items-center justify-center {% if is_dark %}text-primary-fixed-dim{% else %}text-primary{% endif %}">
      <span class="material-symbols-outlined">{{ icon_map[item.type] }}</span>
    </div>
    <span class="font-caption text-caption {% if is_dark %}text-on-dark-soft{% else %}text-muted-soft{% endif %}">{{ item.created_at[:10] }}</span>
  </div>
  <h3 class="font-title-md text-title-md {% if is_dark %}text-on-dark{% else %}text-body-strong{% endif %} mb-xs line-clamp-1 {% if not is_dark %}group-hover:text-primary{% endif %} transition-colors">{{ item.title }}</h3>
  <p class="font-body-sm {% if is_dark %}text-on-dark-soft{% else %}text-muted{% endif %} mb-lg line-clamp-1 {% if is_dark %}font-code{% endif %}">
    {%- if item.type == 'code' -%}
      {{ item.content[:80] }}{% if item.content|length > 80 %}...{% endif %}
    {%- elif item.type == 'link' -%}
      {{ item.url or item.content[:80] }}
    {%- else -%}
      {{ item.content[:80] }}
    {%- endif -%}
  </p>
  <div class="flex items-center justify-between">
    <div class="flex gap-xxs">
      {% include 'components/tag_pills.html' %}
    </div>
    {% if is_dark %}
    <span class="material-symbols-outlined text-on-dark-soft text-[18px]">terminal</span>
    {% else %}
    <span class="material-symbols-outlined text-muted-soft text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
    {% endif %}
  </div>
</div>
```

- [ ] **Step 3: 创建 index.html**

```html
{% extends "base.html" %}
{% block content %}

<section class="mb-xl">
  <h1 class="font-display-lg text-display-lg text-ink mb-xs">我的知识</h1>
  <p class="font-body-md text-muted max-w-xl">精心策划的智力资产集合，按背景和相关性组织。</p>
</section>

<!-- Type Tabs -->
<div class="flex items-center gap-md mb-lg" id="type-tabs">
  {% set types = [('all', '全部'), ('link', '链接'), ('note', '笔记'), ('code', '代码')] %}
  {% for key, label in types %}
  <span class="font-nav-link text-nav-link pb-2 cursor-pointer transition-colors {% if loop.first %}text-primary border-b-2 border-primary{% else %}text-secondary hover:text-primary-active{% endif %}"
        data-type="{{ key }}">{{ label }}</span>
  {% endfor %}
</div>

<!-- Tag Filters -->
<div class="flex items-center gap-md mb-xl overflow-x-auto tag-scroll py-xxs" id="tag-filters">
  <span class="whitespace-nowrap px-md py-xs bg-primary text-on-primary rounded-full font-button text-button cursor-pointer active-tag">#全部</span>
  {% for tag in tags %}
  <span class="whitespace-nowrap px-md py-xs border border-hairline text-secondary hover:border-primary hover:text-primary rounded-full font-button text-button cursor-pointer transition-all"
        data-tag="{{ tag.name }}">#{{ tag.name }}</span>
  {% endfor %}
</div>

<!-- Loading indicator -->
<div id="loading" class="text-center py-lg hidden">
  <p class="font-body-md text-muted">加载中...</p>
</div>

<!-- Card Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg" id="card-grid">
</div>

<!-- Empty state -->
<div id="empty-state" class="hidden text-center py-xxl">
  <p class="font-display-md text-display-md text-muted mb-md">这里还什么都没有</p>
  <p class="font-body-md text-muted-soft mb-lg">添加你的第一条知识碎片</p>
</div>

<!-- Load More -->
<div id="pagination" class="mt-section flex flex-col items-center justify-center hidden">
  <button id="btn-load-more"
    class="px-xl py-md bg-canvas border border-hairline text-ink rounded-lg hover:bg-surface-soft transition-all font-button text-button shadow-sm">
    加载更多
  </button>
  <p class="mt-md font-caption text-caption text-muted-soft uppercase tracking-widest" id="item-count"></p>
</div>

{% endblock %}
```

---

### Task 9: Modal 模板 (modal.html)

**Files:**
- Create: `templates/modal.html`

- [ ] **Step 1: 创建 modal.html**

```html
<div id="add-modal" class="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-md hidden">
  <div class="bg-canvas w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
    <!-- Header -->
    <header class="flex items-center justify-between px-xl py-lg border-b border-hairline">
      <h2 class="font-display-sm text-display-sm text-ink">添加到知识库</h2>
      <button class="p-xs hover:bg-hairline-soft rounded-full transition-all modal-close-btn">
        <span class="material-symbols-outlined text-secondary">close</span>
      </button>
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-xl py-lg space-y-xl">
      <!-- Type Selector -->
      <div class="space-y-sm">
        <label class="font-caption-uppercase text-caption-uppercase text-muted">条目类型</label>
        <div class="flex gap-md" id="modal-type-selector">
          {% set types = [('link', 'link', '链接'), ('note', 'description', '笔记'), ('code', 'code', '代码')] %}
          {% for key, icon, label in types %}
          <button class="flex-1 flex flex-col items-center gap-xs p-md rounded-lg border-2 transition-all modal-type-btn {% if loop.first %}border-primary bg-surface-container text-primary{% else %}border-hairline hover:bg-hairline-soft text-secondary{% endif %}"
                  data-type="{{ key }}">
            <span class="material-symbols-outlined">{{ icon }}</span>
            <span class="font-button text-button">{{ label }}</span>
          </button>
          {% endfor %}
        </div>
      </div>

      <!-- Form Fields -->
      <div class="space-y-lg" id="modal-form">
        <div class="space-y-xs" id="field-url">
          <label class="font-title-sm text-title-sm text-body-strong" for="field-url-input">网址</label>
          <input id="field-url-input"
            class="w-full h-10 px-md rounded-lg border border-hairline bg-canvas focus:ring-4 focus:ring-primary/15 focus:border-primary outline-none transition-all font-body-sm"
            placeholder="https://example.com/insight" type="url">
        </div>
        <div class="space-y-xs">
          <label class="font-title-sm text-title-sm text-body-strong" for="field-title">标题</label>
          <input id="field-title"
            class="w-full h-10 px-md rounded-lg border border-hairline bg-canvas focus:ring-4 focus:ring-primary/15 focus:border-primary outline-none transition-all font-body-sm"
            placeholder="条目的描述性标题..." type="text">
        </div>
        <div class="space-y-xs" id="field-language">
          <label class="font-title-sm text-title-sm text-body-strong" for="field-language-select">语言</label>
          <select id="field-language-select"
            class="w-full h-10 px-md rounded-lg border border-hairline bg-canvas focus:ring-4 focus:ring-primary/15 focus:border-primary outline-none transition-all font-body-sm">
            <option value="">选择语言...</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="java">Java</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="sql">SQL</option>
            <option value="shell">Shell</option>
          </select>
        </div>
        <div class="space-y-xs">
          <label class="font-title-sm text-title-sm text-body-strong" for="field-content">内容</label>
          <textarea id="field-content"
            class="w-full min-h-[120px] px-md py-sm rounded-lg border border-hairline bg-canvas focus:ring-4 focus:ring-primary/15 focus:border-primary outline-none transition-all font-body-sm"
            placeholder="写下你的想法..." rows="4"></textarea>
        </div>
        <div class="space-y-xs">
          <label class="font-title-sm text-title-sm text-body-strong">标签</label>
          <div class="relative">
            <div class="flex flex-wrap gap-xs p-xs border border-hairline rounded-lg bg-canvas min-h-[40px] items-center" id="tag-input-container">
              <input id="field-tags"
                class="flex-1 border-none bg-transparent focus:ring-0 outline-none font-body-sm p-1 min-w-[80px]"
                placeholder="添加标签..." type="text">
            </div>
            <div id="tag-autocomplete" class="absolute top-full left-0 w-full mt-xxs bg-canvas border border-hairline rounded-lg shadow-lg z-10 hidden"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="px-xl py-lg bg-surface-soft flex justify-end gap-md">
      <button class="px-lg h-10 rounded-lg font-button text-button text-secondary border border-hairline hover:bg-hairline-soft transition-all modal-close-btn">
        取消
      </button>
      <button id="btn-save"
        class="px-xl h-10 rounded-lg font-button text-button bg-primary text-on-primary hover:bg-primary-active transition-all">
        保存条目
      </button>
    </footer>
  </div>
</div>
```

---

### Task 10: Stats 模板 (stats.html)

**Files:**
- Create: `templates/stats.html`

- [ ] **Step 1: 创建 stats.html**

```html
{% extends "base.html" %}
{% block content %}

<div class="mb-xl">
  <h2 class="font-display-md text-display-md text-ink mb-xxs">洞察</h2>
  <p class="text-secondary font-body-sm">分析您的个人知识库</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-12 gap-lg" id="stats-grid">
  <!-- Total Count -->
  <div class="md:col-span-12 lg:col-span-8 bg-surface-card p-xl rounded-xl relative overflow-hidden">
    <div class="relative z-10">
      <span class="text-caption-uppercase font-caption-uppercase text-primary mb-sm block">总量统计</span>
      <div class="flex items-baseline gap-xs">
        <span class="font-display-xl text-display-xl text-ink" id="stat-total">0</span>
        <span class="font-title-lg text-title-lg text-secondary">个已保存条目</span>
      </div>
    </div>
  </div>

  <!-- Type Breakdown -->
  <div class="md:col-span-12 lg:col-span-6 space-y-lg">
    <div class="bg-canvas border border-hairline p-lg rounded-xl">
      <h3 class="font-title-md text-title-md text-ink mb-xl">内容分布</h3>
      <div class="space-y-xl">
        {% for t in [('link', '链接'), ('note', '笔记'), ('code', '代码')] %}
        <div>
          <div class="flex justify-between items-center mb-xs">
            <div class="flex items-center gap-xs">
              <span class="material-symbols-outlined text-primary text-[20px]">{{ {'link': 'link', 'note': 'description', 'code': 'code'}[t[0]] }}</span>
              <span class="font-body-md">{{ t[1] }}</span>
            </div>
            <span class="font-code text-code text-secondary" id="stat-{{ t[0] }}">0</span>
          </div>
          <div class="h-2 w-full bg-hairline-soft rounded-full overflow-hidden">
            <div class="h-full rounded-full stat-bar" data-type="{{ t[0] }}" style="width: 0%"></div>
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>

  <!-- Top Tags -->
  <div class="md:col-span-12">
    <div class="bg-surface-card p-xl rounded-xl">
      <h3 class="font-title-lg text-title-lg text-ink mb-xl">最常用标签</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-md" id="top-tags-grid">
      </div>
    </div>
  </div>
</div>

<script>
fetch('/api/stats')
  .then(r => r.json())
  .then(res => {
    if (!res.ok) return;
    const data = res.data;
    document.getElementById('stat-total').textContent = data.total;
    const total = data.total || 1;
    const types = {'link': 0, 'note': 0, 'code': 0};
    Object.assign(types, data.by_type);
    document.getElementById('stat-link').textContent = types.link;
    document.getElementById('stat-note').textContent = types.note;
    document.getElementById('stat-code').textContent = types.code;
    document.querySelectorAll('.stat-bar').forEach(el => {
      const t = el.dataset.type;
      el.style.width = (types[t] / total * 100) + '%';
    });
    const colors = ['#8f482f', '#a9583e', '#ad5f45', '#924a31', '#75331c'];
    const grid = document.getElementById('top-tags-grid');
    if (data.top_tags.length === 0) {
      grid.innerHTML = '<p class="font-body-md text-muted col-span-full">暂无标签</p>';
    } else {
      data.top_tags.forEach((tag, i) => {
        grid.innerHTML += `
          <div class="p-lg bg-canvas rounded-lg border border-hairline">
            <p class="text-caption text-secondary mb-xxs">#${String(i+1).padStart(2, '0')}</p>
            <p class="font-title-md text-title-md text-ink mb-md">${tag.name}</p>
            <p class="text-body-sm text-secondary">${tag.count} 个条目</p>
          </div>`;
      });
    }
  });
</script>
{% endblock %}
```

---

### Task 11: 前端交互 JS (app.js)

**Files:**
- Create: `static/js/app.js`

- [ ] **Step 1: 创建 app.js**

```javascript
// ---- State ----
let currentType = 'all';
let currentTags = [];
let currentQuery = '';
let currentOffset = 0;
let hasMore = false;
let searchTimeout = null;

// ---- DOM refs ----
const grid = document.getElementById('card-grid');
const emptyState = document.getElementById('empty-state');
const pagination = document.getElementById('pagination');
const loadMoreBtn = document.getElementById('btn-load-more');
const itemCount = document.getElementById('item-count');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('search-input');
const typeTabs = document.querySelectorAll('#type-tabs [data-type]');
const tagFilterEls = document.querySelectorAll('#tag-filters [data-tag]');
const addBtn = document.getElementById('btn-add');
const modal = document.getElementById('add-modal');
const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
const saveBtn = document.getElementById('btn-save');
const modalTypeBtns = document.querySelectorAll('.modal-type-btn');
const titleInput = document.getElementById('field-title');
const contentInput = document.getElementById('field-content');
const urlInput = document.getElementById('field-url');
const langSelect = document.getElementById('field-language-select');
const tagInput = document.getElementById('field-tags');
const tagContainer = document.getElementById('tag-input-container');
const autocomplete = document.getElementById('tag-autocomplete');
const fieldUrl = document.getElementById('field-url');
const fieldLanguage = document.getElementById('field-language');
const cardGrid = document.getElementById('card-grid');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  setupSearch();
  setupTypeTabs();
  setupTagFilters();
  setupModal();
  setupLoadMore();
  updateFormFields('link');
});

// ---- API helper ----
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ---- Load items ----
async function loadItems(append = false) {
  if (!append) {
    currentOffset = 0;
    loading.classList.remove('hidden');
  }
  const params = new URLSearchParams();
  if (currentType !== 'all') params.set('type', currentType);
  currentTags.forEach(t => params.append('tag', t));
  if (currentQuery) params.set('q', currentQuery);
  params.set('offset', currentOffset);
  params.set('limit', 24);

  const res = await api(`/api/items?${params}`);
  if (!res.ok) return;
  const data = res.data;
  hasMore = data.has_more;

  if (!append) grid.innerHTML = '';
  data.items.forEach(item => {
    grid.innerHTML += buildCard(item);
  });

  loading.classList.add('hidden');
  updatePagination(data.total, data.items.length, append);
}

function buildCard(item) {
  const icons = { link: 'link', note: 'description', code: 'code' };
  const isDark = item.type === 'code';
  const preview = item.type === 'code' ? item.content.slice(0, 80) :
                  item.type === 'link' ? (item.url || item.content.slice(0, 80)) :
                  item.content.slice(0, 80);
  const tagsHtml = (item.tags || []).map(t =>
    `<span class="px-xs py-[2px] bg-hairline-soft rounded text-[11px] font-medium text-muted uppercase tracking-wider">#${t.name}</span>`
  ).join('');

  return `
<div class="group ${isDark ? 'bg-surface-dark' : 'bg-surface-card'} p-lg rounded-xl border border-transparent hover:border-hairline hover:shadow-sm transition-all duration-300" data-id="${item.id}">
  <div class="flex items-start justify-between mb-md">
    <div class="w-10 h-10 rounded-lg ${isDark ? 'bg-surface-dark-soft' : 'bg-surface-container'} flex items-center justify-center ${isDark ? 'text-primary-fixed-dim' : 'text-primary'}">
      <span class="material-symbols-outlined">${icons[item.type]}</span>
    </div>
    <span class="font-caption text-caption ${isDark ? 'text-on-dark-soft' : 'text-muted-soft'}">${item.created_at.slice(0, 10)}</span>
  </div>
  <h3 class="font-title-md text-title-md ${isDark ? 'text-on-dark' : 'text-body-strong'} mb-xs line-clamp-1 transition-colors">${escapeHtml(item.title)}</h3>
  <p class="font-body-sm ${isDark ? 'text-on-dark-soft' : 'text-muted'} mb-lg line-clamp-1 ${isDark ? 'font-code' : ''}">${escapeHtml(preview)}</p>
  <div class="flex items-center justify-between">
    <div class="flex gap-xxs">${tagsHtml}</div>
    ${isDark ? '<span class="material-symbols-outlined text-on-dark-soft text-[18px]">terminal</span>' : '<span class="material-symbols-outlined text-muted-soft text-[18px]">arrow_forward</span>'}
  </div>
</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updatePagination(total, count, append) {
  if (total === 0) {
    emptyState.classList.remove('hidden');
    pagination.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  pagination.classList.remove('hidden');
  itemCount.textContent = `显示 ${Math.min(currentOffset + count, total)} 个项目中的 ${total} 个`;
  loadMoreBtn.classList.toggle('hidden', !hasMore);
}

// ---- Search ----
function setupSearch() {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentQuery = searchInput.value.trim();
      loadItems(false);
    }, 300);
  });
}

// ---- Type Tabs ----
function setupTypeTabs() {
  typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      typeTabs.forEach(t => {
        t.classList.remove('text-primary', 'border-b-2', 'border-primary');
        t.classList.add('text-secondary');
      });
      tab.classList.add('text-primary', 'border-b-2', 'border-primary');
      tab.classList.remove('text-secondary');
      currentType = tab.dataset.type;
      loadItems(false);
    });
  });
}

// ---- Tag Filters ----
function setupTagFilters() {
  tagFilterEls.forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      if (!tag) return;
      const idx = currentTags.indexOf(tag);
      if (idx > -1) {
        currentTags.splice(idx, 1);
        el.classList.remove('bg-primary', 'text-on-primary');
        el.classList.add('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
      } else {
        currentTags.push(tag);
        document.querySelector('#tag-filters [data-tag]').classList.remove('bg-primary', 'text-on-primary');
        document.querySelector('#tag-filters [data-tag]').classList.add('border', 'border-hairline', 'text-secondary');
        el.classList.remove('border', 'border-hairline', 'text-secondary', 'hover:border-primary', 'hover:text-primary');
        el.classList.add('bg-primary', 'text-on-primary');
      }
      loadItems(false);
    });
  });
}

// ---- Load More ----
function setupLoadMore() {
  loadMoreBtn.addEventListener('click', () => {
    currentOffset += 24;
    loadItems(true);
  });
}

// ---- Modal ----
function setupModal() {
  addBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetModalForm();
  });
  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Type switching
  modalTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTypeBtns.forEach(b => {
        b.classList.remove('border-primary', 'bg-surface-container', 'text-primary');
        b.classList.add('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
      });
      btn.classList.add('border-primary', 'bg-surface-container', 'text-primary');
      btn.classList.remove('border-hairline', 'hover:bg-hairline-soft', 'text-secondary');
      updateFormFields(btn.dataset.type);
    });
  });

  // Tag autocomplete
  tagInput.addEventListener('input', async () => {
    const val = tagInput.value.trim();
    if (!val) { autocomplete.classList.add('hidden'); return; }
    const res = await api(`/api/tags`);
    if (!res.ok) return;
    const matches = res.data.filter(t => t.name.toLowerCase().includes(val.toLowerCase()) && !getSelectedTags().includes(t.name));
    if (matches.length === 0) { autocomplete.classList.add('hidden'); return; }
    autocomplete.innerHTML = matches.map(t => `<div class="p-sm hover:bg-hairline-soft cursor-pointer font-body-sm" data-tag-name="${t.name}">${t.name}</div>`).join('');
    autocomplete.querySelectorAll('[data-tag-name]').forEach(el => {
      el.addEventListener('click', () => {
        addTagPill(el.dataset.tagName);
        tagInput.value = '';
        autocomplete.classList.add('hidden');
        tagInput.focus();
      });
    });
    autocomplete.classList.remove('hidden');
  });
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.value.trim();
      if (val) { addTagPill(val); tagInput.value = ''; }
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tag-input-container') && !e.target.closest('#tag-autocomplete')) {
      autocomplete.classList.add('hidden');
    }
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const type = document.querySelector('.modal-type-btn.border-primary')?.dataset.type || 'link';
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const data = { type, title, content: contentInput.value.trim(), tags: getSelectedTags() };
    if (type === 'link') data.url = urlInput.value.trim();
    if (type === 'code') data.language = langSelect.value || null;
    const res = await api('/api/items', { method: 'POST', body: JSON.stringify(data) });
    if (res.ok) {
      closeModal();
      loadItems(false);
      refreshTags();
    }
  });
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function resetModalForm() {
  titleInput.value = '';
  contentInput.value = '';
  urlInput.value = '';
  langSelect.value = '';
  tagInput.value = '';
  autocomplete.classList.add('hidden');
  document.querySelectorAll('#tag-input-container .tag-pill').forEach(el => el.remove());
  updateFormFields('link');
}

function updateFormFields(type) {
  fieldUrl.style.display = type === 'link' ? '' : 'none';
  fieldLanguage.style.display = type === 'code' ? '' : 'none';
  contentInput.placeholder = type === 'note' ? '写下你的想法...' :
                             type === 'code' ? '粘贴代码...' : '摘要或描述...';
}

function getSelectedTags() {
  return Array.from(document.querySelectorAll('#tag-input-container .tag-pill')).map(el => el.dataset.tag);
}

function addTagPill(name) {
  if (getSelectedTags().includes(name)) return;
  const pill = document.createElement('span');
  pill.className = 'tag-pill flex items-center gap-xxs px-sm py-1 bg-surface-cream-strong rounded-full font-caption text-caption text-ink';
  pill.dataset.tag = name;
  pill.innerHTML = `${name} <span class="material-symbols-outlined text-[14px] cursor-pointer tag-remove">close</span>`;
  pill.querySelector('.tag-remove').addEventListener('click', () => pill.remove());
  tagContainer.insertBefore(pill, tagInput);
}

// ---- Refresh tags in sidebar ----
async function refreshTags() {
  const res = await api('/api/tags');
  if (!res.ok) return;
  const container = document.getElementById('tag-filters');
  if (!container) return;
  const allTag = container.querySelector('[data-tag]');
  container.innerHTML = `<span class="whitespace-nowrap px-md py-xs bg-primary text-on-primary rounded-full font-button text-button cursor-pointer active-tag">#全部</span>`;
  if (allTag) container.appendChild(allTag.cloneNode(true));
  res.data.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'whitespace-nowrap px-md py-xs border border-hairline text-secondary hover:border-primary hover:text-primary rounded-full font-button text-button cursor-pointer transition-all';
    el.dataset.tag = tag.name;
    el.textContent = `#${tag.name}`;
    container.appendChild(el);
  });
}
```

---

### Task 12: 调试验证

**Files:** N/A

- [ ] **Step 1: 安装依赖并启动**

```bash
cd /Users/fly/Desktop/AI/myptoject/design-model/stitch-demo1
pip install flask
python app.py
```

- [ ] **Step 2: 验证首页加载**

浏览器打开 `http://localhost:5000`，确认：
- 页面按照设计稿渲染，导航栏、侧边栏、卡片网格正常显示
- Tailwind 样式正确加载，Claude 设计 token 生效

- [ ] **Step 3: 验证新增条目**

点击「新增项目」：
- 弹窗正常打开
- 切换三种类型，表单字段动态变化
- 添加标签支持输入自动补全
- 提交后页面刷新，新卡片出现

- [ ] **Step 4: 验证搜索和筛选**

- 搜索框输入关键词，300ms 防抖后列表过滤
- 点击类型 Tab，按类型展示
- 点击标签 pill，组合筛选

- [ ] **Step 5: 验证统计页面**

访问 `/stats`：
- 总数正确显示
- 内容分布条形图按比例渲染
- 热门标签列表展示

- [ ] **Step 6: 验证导出导入**

```bash
curl http://localhost:5000/api/export
```

确认返回 JSON 包含所有数据。
