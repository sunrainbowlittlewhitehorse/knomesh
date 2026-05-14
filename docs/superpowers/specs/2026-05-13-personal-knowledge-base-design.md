# 个人知识库 / 收藏夹管理器 — 设计方案

## 1. 项目概述

一个轻量级的个人知识碎片管理工具，让用户能够快速保存、分类和检索日常积累的信息。对标 Cubox / Raindrop.io 的极简自托管版本，用户完全掌控自己的数据。

### 愿景

> 像「随手扔进抽屉」一样保存信息，像「翻自己的记忆」一样找到它。

### 目标用户

- 日常浏览大量网页、需要保存参考链接的人
- 有零散笔记/代码片段需要归类整理的技术人员
- 对数据隐私敏感、不想用第三方收藏工具的人

---

## 2. 功能规划

### MVP（两天内完成）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **添加条目** | 通过表单添加链接、笔记、代码片段三种类型 | P0 |
| **列表展示** | 按创建时间倒序展示所有条目，支持分页或虚拟滚动 | P0 |
| **标签系统** | 创建标签、为条目打标签、按标签筛选 | P0 |
| **全文搜索** | 搜索标题和内容，实时过滤 | P0 |
| **类型筛选** | 按 link/note/code 类型切换视图 | P0 |
| **数据持久化** | 本地 SQLite 存储，启动自动加载 | P0 |
| **深色模式** | 明暗主题切换 | P1 |
| **条目编辑/删除** | 修改已保存的内容或删除 | P1 |
| **统计看板** | 条目总数、各类型分布、热门标签 | P1 |
| **导入/导出** | 导出为 JSON，从 JSON 导入 | P2 |

### 后续规划（两天后）

- 浏览器插件（一键保存当前页面）
- AI 自动标签 / 自动摘要
- 全文检索增强（FTS5）
- WebDAV / iCloud 同步
- 分享功能（生成公开链接）

---

## 3. 技术栈

| 层 | 技术 | 选型理由 |
|----|------|----------|
| **运行时** | Python 3.10+ | 开箱即用，无需额外安装运行时 |
| **Web 框架** | Flask | 轻量、简单，适合两天快速出活 |
| **ORM / 数据库** | SQLite + sqlite3 | 零配置，单文件，数据直接掌握在用户手里 |
| **前端** | Vanilla JS | 无构建工具、无依赖，交互控制在合理范围内 |
| **模板引擎** | Jinja2 (Flask 内置) | 服务端渲染 + Tailwind 类名动态输出 |
| **CSS** | Tailwind CSS (CDN) | 设计稿由 Stitch 生成，使用 Tailwind 工具类；零构建，script 标签引入 |
| **图标** | Material Symbols (Google) | 设计稿中统一使用，3 种类型各自对应 icon |
| **设计系统** | Claude Design System (DESIGN.md) | 暖色调奶油 canvas、珊瑚色主色、Copernicus 衬线标题 / Inter 正文字体 |

### 关键决策

- **CSS 框架随设计稿走**：Stitch 生成的 HTML 已全部使用 Tailwind 类名和 Claude 设计 token，直接复用，不做二次转换。
- **Vanilla JS 够用**：不需要 Alpine.js 或 HTMX。交互场景为弹窗、标签选择、搜索防抖、Tab 切换，原生 JS 可胜任，避免额外依赖。
- **不走纯前端 localStorage**：为后续功能（浏览器插件、WebDAV 同步、搜索增强）留扩展空间，轻量后端更有弹性。

---

## 4. 数据模型

### 数据库表

```sql
-- 条目表
CREATE TABLE items (
    id          TEXT PRIMARY KEY,          -- UUID
    type        TEXT NOT NULL,             -- 'link' | 'note' | 'code'
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,             -- 链接的摘要 / 笔记正文 / 代码
    url         TEXT,                      -- 仅 link 类型有
    language    TEXT,                      -- 仅 code 类型有，如 'python', 'javascript'
    created_at  TEXT NOT NULL,             -- ISO 8601
    updated_at  TEXT NOT NULL              -- ISO 8601
);

-- 标签表
CREATE TABLE tags (
    id    TEXT PRIMARY KEY,                -- UUID
    name  TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1'  -- 标签颜色
);

-- 条目-标签 多对多关联
CREATE TABLE item_tags (
    item_id TEXT NOT NULL,
    tag_id  TEXT NOT NULL,
    PRIMARY KEY (item_id, tag_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_created_at ON items(created_at);
CREATE INDEX idx_item_tags_item ON item_tags(item_id);
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);
```

### 核心数据结构（Python）

```python
@dataclass
class Item:
    id: str
    type: Literal["link", "note", "code"]
    title: str
    content: str
    url: str | None
    language: str | None
    tags: list[Tag]
    created_at: str
    updated_at: str

@dataclass
class Tag:
    id: str
    name: str
    color: str
```

---

## 5. 架构设计

```
┌─────────────────────────────────────────────────┐
│                    Browser                        │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ 列表页面   │  │ 添加弹窗  │  │ 统计面板      │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │               │          │
│        └──────────────┴───────────────┘          │
│                      │  Fetch API                 │
└──────────────────────┼──────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────┐
│              Flask Web Server                     │
│  ┌──────────────────┴──────────────────┐         │
│  │           API Routes                │         │
│  │  GET /api/items                     │         │
│  │  POST /api/items                    │         │
│  │  PUT /api/items/:id                 │         │
│  │  DELETE /api/items/:id              │         │
│  │  GET /api/tags                      │         │
│  │  POST /api/tags                     │         │
│  │  DELETE /api/tags/:id               │         │
│  │  GET /api/stats                     │         │
│  │  GET /api/export                    │         │
│  │  POST /api/import                   │         │
│  └──────────────────┬──────────────────┘         │
│                     │                             │
│  ┌──────────────────┴──────────────────┐         │
│  │        Service Layer                │         │
│  │  ItemService, TagService, Search     │         │
│  └──────────────────┬──────────────────┘         │
│                     │                             │
│  ┌──────────────────┴──────────────────┐         │
│  │         SQLite Database              │         │
│  └─────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

### 路由设计

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/` | 主页面（渲染列表 UI） |
| GET | `/api/items` | 获取条目列表（支持 `?type=link&tag=xxx&q=关键词` 参数） |
| POST | `/api/items` | 创建条目 |
| PUT | `/api/items/:id` | 更新条目 |
| DELETE | `/api/items/:id` | 删除条目 |
| GET | `/api/tags` | 获取所有标签 |
| POST | `/api/tags` | 创建标签 |
| DELETE | `/api/tags/:id` | 删除标签（同时移除关联） |
| GET | `/api/stats` | 统计数据 |
| GET | `/api/export` | 导出全部数据为 JSON |
| POST | `/api/import` | 从 JSON 文件导入 |

---

## 6. UI / UX 设计

设计稿已通过 Google Stitch 生成，共 3 个页面，放置在 `docs/superpowers/specs/stitch_stitch_knowledge_base/` 下。

### 页面一：主列表页

布局结构：
- **顶部导航栏**：KnoMesh 品牌标题 + 搜索框 + 类型 Tab（全部/链接/笔记/代码）+「新增项目」按钮 + 头像
- **左侧固定侧边栏**：导航菜单（库、标签、统计、归档、回收站）+ 专业版升级卡片 + 帮助/隐私链接
- **标签筛选行**：横向滚动 pill 式标签，#全部 默认选中
- **内容网格**：3 列（桌面）/ 2 列（平板）/ 1 列（移动）卡片布局
- **卡片内容**：类型 icon（link/description/code）+ 标题 + 预览文字 + 标签 pill + 时间
- **分页区域**：「加载更多」按钮 + 条目总数提示

### 页面二：新增条目弹窗

布局结构：
- **遮罩层**：半透明 backdrop-blur
- **弹窗**：居中卡片，最大宽度 2xl
- **类型选择器**：3 个 icon+文字按钮（链接/笔记/代码），选中态 highlight
- **表单字段**：根据类型切换 —— 链接（URL + 标题）、笔记（标题 + 文本域）、代码（标题 + 语言下拉 + 代码文本域）
- **标签输入**：已有标签显示为可删除 pill + 输入框 + 自动补全下拉
- **链接预览**：仅在链接模式下显示，包含缩略图和摘要
- **底部**：取消按钮 +「保存条目」按钮

### 页面三：统计面板

布局结构：
- **总数统计卡片**：大字 1,248 +「个已保存条目」+ 月增长趋势
- **同步状态 / 日活**：两个小卡片并排
- **内容分布**：水平条形图展示链接/笔记/代码的数量和占比
- **近期活动**：时间线（今天/昨天/本周），带事件描述
- **热门标签**：Top 5 标签网格，显示条目数 + 趋势方向
- **右侧边栏**：知识图谱预览 + 语义建议 + 每周摘要

### 交互要点

- **搜索框**：输入即搜索，300ms 防抖，通过 API 参数 `?q=` 检索标题 + 内容
- **类型 Tab**：切换时仅更新 API 请求的 `?type=` 参数，不刷新页面
- **标签筛选**：点击标签切换筛选，多个标签可组合；选中态为 filled，未选中为 outline
- **新增弹窗**：选择类型 → 动态切换表单字段 → 标签自动补全 → 提交
- **空状态**：首次使用显示引导 CTA
- **分页**：「加载更多」按钮式分页，API 返回 `offset` 和 `has_more`

### 视觉风格

遵循 `docs/superpowers/specs/stitch_stitch_knowledge_base/claude/DESIGN.md` 定义的设计系统（Anthropic Claude 风格）：

- **底色**：暖调奶油色 `#faf9f5`，非纯白
- **主色**：珊瑚色 `#8f482f`（CTAs、选中态、品牌强调）
- **字体**：Copernicus 衬线（标题）+ StyreneB / Inter 无衬线（正文）
- **卡片**：`surface-card` `#efe9de`（普通卡片）、`surface-dark` `#181715`（代码卡片）
- **圆角分层**：8px（按钮输入框）/ 12px（卡片）/ 9999px（标签、按钮）
- **代码块**：JetBrains Mono，深色背景卡片展示
- **代码卡片**：深色背景 `surface-dark`，与普通卡片形成明暗节奏

---

## 7. 工程结构

```
stitch-demo1/
├── app.py                  # Flask 应用入口（路由 + 视图）
├── requirements.txt        # 依赖（Flask）
├── data/                   # SQLite 数据库文件
│   └── knowledge.db
├── static/
│   └── js/
│       └── app.js          # 前端交互逻辑（弹窗、搜索、筛选、分页）
├── templates/
│   ├── base.html           # 布局模板（nav + sidebar UI 由 Stitch 设计）
│   ├── index.html          # 主页面（列表 + 标签 + 分页）
│   ├── modal.html          # 新增/编辑弹窗
│   ├── stats.html          # 统计面板页面
│   └── components/         # Jinja2 可复用片段
│       ├── card.html       # 单个条目卡片
│       └── tag_pills.html  # 标签 pill 渲染
├── services/
│   ├── __init__.py
│   ├── database.py         # 数据库连接与初始化
│   ├── item_service.py     # 条目 CRUD
│   ├── tag_service.py      # 标签 CRUD
│   └── search_service.py   # 搜索逻辑
└── docs/
    └── superpowers/
        └── specs/
            ├── 2026-05-13-personal-knowledge-base-design.md
            ├── DESIGN.md                    # Claude 设计系统
            ├── stitch-prompt.md             # Stitch 生成 prompt
            └── stitch_stitch_knowledge_base/ # Stitch 输出的 HTML 源文件
                ├── knomesh_1/code.html
                ├── knomesh_2/code.html
                └── knomesh_3/code.html
```

> 注：CSS 样式由 Tailwind CDN 运行时生成，无需 `static/css/` 目录。Tailwind 配置（design token）内嵌在 HTML 的 `<script>` 标签中。

---

## 8. 开发计划

### 前置条件

> Stitch 设计稿已就位，三个页面的 HTML/CSS 作为 Jinja2 模板的直接基础。

### Day 1：核心骨架（8-10h）

| 阶段 | 内容 | 产出 |
|------|------|------|
| 环境搭建 | 初始化项目结构、Flask 应用、数据库 Schema | `python app.py` 可启动 |
| 数据层 | 数据库 CRUD + 搜索 + 统计查询 | 3 个 Service 文件 |
| API 层 | 所有 REST 路由 + JSON 响应 | `curl` 可测试 |
| 模板转化 | 将 Stitch HTML 拆为 Jinja2 模板（base / index / modal / card） | 三条数据可见 |

### Day 2：完善体验（6-8h）

| 阶段 | 内容 | 产出 |
|------|------|------|
| JS 交互 | 弹窗开关 + 类型切换 + 表单提交 + 搜索防抖 | 完整新增流程 |
| 标签筛选 | 点击标签筛选 + 组合筛选 + 分页加载 | 可按标签浏览 |
| 统计面板 | 模板渲染 + API 对接 | 数据可视化 |
| 导入导出 | JSON 导出下载 + 上传导入 | 数据可迁移 |
| 打磨 | 空状态、加载态、错误处理、细节调整 | 可交付 |

---

## 9. 非功能性需求

- **启动方式**：`pip install flask && python app.py`，一行命令启动
- **数据安全**：所有数据在本地 SQLite，不出网
- **性能**：1000 条以内的条目检索响应 < 200ms
- **兼容性**：支持 Chrome / Firefox / Safari 最新版本
- **错误处理**：API 统一返回 `{ok: bool, data?: any, error?: string}` 格式

---

## 10. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 两天做不完 | 中 | 高 | P0 功能优先做完，P2 砍掉 |
| 搜索性能差 | 低 | 中 | 先用 LIKE 查询，后续可加 FTS5 |
| 前端代码变臃肿 | 低 | 中 | 使用 Vanilla JS，弹窗/搜索/筛选等交互保持独立函数 |
| 用户不会用 Python | 低 | 高 | 提供打包好的可执行文件方案 |
