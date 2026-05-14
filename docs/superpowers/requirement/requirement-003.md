### 一、问题描述
**根据问题描述修复，并且填充该文档中以下几点的内容**
1. 三个页面的标题字体样式不一致，比如知识库页面的标题行的"我的知识"和统计页面的"洞察"样式不一致，推荐统一用统计页面的样式
2. 左侧边栏的"知识库"字体和其他两个栏目的字体大小不一样

### 二、修复过程
1. **页面标题统一**：对比三个页面的标题样式：
   - 统计页面（目标样式）：`font-display-md text-display-md text-ink mb-xxs`（36px）
   - 知识库页面：原为 `text-display-lg`（48px），改为 `text-display-md`
   - 标签管理页面：原为 `text-display-lg`（48px），改为 `text-display-md`
2. **侧边栏字体统一**：「知识库」的 `<span>` 原有多余的 `text-body-sm` 类而其他两个栏目没有，导致字体偏小（14px vs 继承的16px）。移除该冗余类后三者均使用 `font-body-sm` 获得一致的字体样式。

### 三、修复范围
- `templates/index.html`：标题从 `text-display-lg` 改为 `text-display-md`
- `templates/tags.html`：标题从 `text-display-lg` 改为 `text-display-md`
- `templates/base.html`：侧边栏「知识库」span 移除 `text-body-sm` 类

### 四、修复结果
- 三个页面标题样式完全统一：`font-display-md text-display-md text-ink mb-xxs`
- 侧边栏三个导航项的字体大小一致，均使用 `font-body-sm` 系列
