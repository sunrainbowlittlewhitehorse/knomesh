# Superpowers 介绍

## 它是什么

Superpowers 是一套面向 AI Coding Agent 的**开发工作流系统**。它不是插件，也不是框架，而是一组行为规范——当你在 Claude Code 这类 AI 编程工具中启用后，Agent 会遵循一套结构化的流程来完成开发需求，而不是"你说了需求它就直接写代码"。

如果把 AI Agent 比作一个开发者，Superpowers 就是这家公司的**开发流程手册**：先做设计评审、再写实现计划、按 TDD 写代码、每个任务经过审查、完成后验证再交付。

---

## 为什么要用它

AI Agent 直接写代码的模式有两个核心问题：

1. **跳过设计直接实现** — Agent 对需求的理解和你的真实意图可能有偏差，但它不会问，直接写。等你看到代码发现不对，已经浪费了时间。
2. **缺乏质量保障** — Agent 不会自己审查自己的代码，不会先写测试再实现，不会验证自己的"完成了"是否真的完成了。

Superpowers 通过强制流程来解决这些问题：**先设计、再计划、再实现、每步验证**。这听起来繁琐，但实际上减少了大量返工。

---

## 核心原则

- **设计先于代码** — 任何实现行为之前必须有设计文档和你的审批。没有例外，哪怕是一个按钮、一个单行修改。
- **先写测试，再写代码** — 必须亲眼看到测试失败，才能写实现代码。不遵守等于没走 TDD。
- **验证后才算完成** — 没跑验证命令就说"完成了"，等同于撒谎。
- **Agent 负责流程，你负责决策** — Agent 自动调度技能流转，你只需要在关键的决策点做选择。

---

## 13 个技能全景

Superpowers 由 13 个技能（skill）组成，分为几个层级：

### 核心工作流（完整链路的 5 步）

| 技能 | 作用 | 触发方式 |
|------|------|---------|
| **brainstorming** | 将模糊想法转化为设计文档。通过结构化对话理解需求、探索方案、输出 spec | 启动新需求时自动触发 |
| **writing-plans** | 将设计文档拆解为详细的实现计划。每个任务 2-5 分钟，包含完整代码和测试 | brainstorming 完成后自动触发 |
| **executing-plans** | 按计划逐个任务执行 | writing-plans 完成后你选择"内联执行"时 |
| **subagent-driven-development** | 每个任务派独立子代理实现，完成后经过两轮审查（spec 审查 + 代码质量审查） | writing-plans 完成后你选择"子代理执行"时 |
| **finishing-a-development-branch** | 开发完成后提供合并/PR/保留/丢弃 4 个选项 | 所有任务执行完毕后自动触发 |

### 质量保障（贯穿整个流程）

| 技能 | 作用 | 触发方式 |
|------|------|---------|
| **test-driven-development** | 铁律：没有失败的测试就不写生产代码。RED → GREEN → REFACTOR | 任何子代理写实现时自动内嵌使用 |
| **verification-before-completion** | 没有运行验证命令就不能声称任何东西完成 | 任何"完成了"声明前自动自检 |
| **systematic-debugging** | 四阶段系统化调试：根因调查 → 模式分析 → 假设验证 → 实现修复。3 次修复失败则质疑架构 | 测试失败、Bug 上报、构建出错时触发 |
| **requesting-code-review** | 派遣 code-reviewer 子代理审查代码变更 | subagent-driven-development 中每个任务后自动触发，也可主动请求 |
| **receiving-code-review** | 指导如何专业处理收到的审查反馈 | 收到外部 review 反馈时 |

### 开发环境与工具

| 技能 | 作用 | 触发方式 |
|------|------|---------|
| **using-git-worktrees** | 在隔离的 git worktree 中开发，保护当前分支 | 开始执行前自动触发 |
| **dispatching-parallel-agents** | 多个独立问题时并行派遣子代理同时处理 | 3 个以上独立根因的失败场景 |
| **writing-skills** | 用 TDD 方法编写新的 skill | 你想扩展 Superpowers 时，与日常开发无关 |

### 元技能

| 技能 | 作用 | 触发方式 |
|------|------|---------|
| **using-superpowers** | 规定了所有技能的调用规则：只要有 1% 的相关可能性就必须调用 | 会话开始时自动加载 |

---

## 最小可行流程

做一个需求最少需要 4 个技能走完，每个都不能跳过：

```
brainstorming → writing-plans → executing-plans/subagent-driven-development → finishing-a-development-branch
```

其中 executing-plans 和 subagent-driven-development 二选一，前者是当前 session 内联执行，后者是派独立子代理+双轮审查。

---

## 一次完整需求的过程

```txt
你: "给应用加一个搜索功能"

Step 1 - Brainstorming
  ├── Agent 自动触发 brainstorming skill
  ├── 探索当前项目结构
  ├── 逐一问你澄清问题（用什么搜索引擎？搜索范围？排序规则？）
  ├── 提出 2-3 种方案对比
  ├── 你选择方案后，Agent 逐节展示设计并确认
  └── 设计文档写入 docs/superpowers/specs/

Step 2 - Writing Plans
  ├── Agent 自动触发 writing-plans
  ├── 拆解为 5-8 个任务，每个含完整代码和测试
  ├── 计划写入 docs/superpowers/plans/
  └── 问你要"子代理执行"还是"内联执行"

Step 3 - Execution（以子代理执行为例）
  每个任务重复：
  ├── 派独立子代理实现
  │   ├── 自动走 TDD: 写测试 → 看失败 → 写实现 → 看通过
  │   └── 提交 commit
  ├── 派 spec-reviewer 检查代码是否符合设计
  │   └── 不合规 → 退回修复 → 再审查
  ├── 派 code-quality-reviewer 检查代码质量
  │   └── 有问题 → 退回修复 → 再审查
  └── 任务标记完成

Step 4 - Finishing
  ├── Agent 自动触发 finishing-a-development-branch
  ├── 跑全量测试
  ├── 提供 4 个选项：
  │   1. 合并到主分支
  │   2. 推送并创建 PR
  │   3. 保留分支，以后处理
  │   4. 丢弃本次工作
  └── 你选择后自动执行剩余操作
```

---

## 用户只需要参与 3 个决策点

在整个流程中，你不需要手动调用任何 skill。Agent 会自动判断并流转。你只需要在三个点做决定：

1. **Brainstorming 中** — 回答澄清问题、选择方案、审查设计
2. **Plan 写好之后** — 选择子代理执行还是内联执行
3. **所有任务完成后** — 选择合并/创建 PR/保留/丢弃

你的指令高于一切。你可以随时说"跳过审查，直接继续"或"直接写不用设计了"，Agent 会服从你的优先级。

---

## 与 OpenSpec 的区别

| 维度 | OpenSpec | Superpowers |
|------|----------|-------------|
| 范围 | Spec 格式标准 | 全链路开发工作流系统 |
| 流程 | spec → implement | brainstorm → design → plan → implement → review × 2 → verify → finish |
| 代理架构 | 单 agent 读 spec 实现 | 多 agent 协作：implementer + spec-reviewer + code-quality-reviewer 每个任务各司其职 |
| 质量保障 | 依赖 spec 完备性 | TDD 铁律 + 双轮审查 + 验证门禁 + 反找借口机制 |
| 调试 | 无内置 | 专门的 systematic-debugging 技能，4 阶段 + 3 次失败质疑架构 |

两者不冲突。你可以在 Superpowers 中用 OpenSpec 格式写 spec 文档。

---

## 什么情况下哪些技能会被触发

以最小流程为基准：

| 情形 | 新增触发的技能 |
|------|--------------|
| 正常开发 | 最小流程 4 个就够了 |
| 执行时选择子代理 | 增加 subagent-driven-development（取代 executing-plans） |
| 子代理执行中 | 自动内嵌 TDD、requesting-code-review |
| 出现 Bug/测试失败 | 增加 systematic-debugging |
| 3 个以上独立失败 | 可能增加 dispatching-parallel-agents |
| 收到 PR Review | 触发 receiving-code-review |
| 想扩展 Superpowers | 触发 writing-skills（独立于开发） |
| 需要隔离工作区 | 自动使用 using-git-worktrees |

---

## 常见问题

**Q: 这是不是太繁琐了？我就改一行代码也要走全流程？**

Brainstorming 的设计可以很短——几句话说清楚就行，但流程不能省。简单需求出问题往往就是因为"觉得简单所以跳过设计"。

**Q: 被审查卡住怎么办？**

你的指令高于一切。随时可以说"跳过审查，继续"。

**Q: 这些技能是安装的插件吗？**

不是。它们是内置在 Agent 系统提示中的行为规范，由 Agent 根据当前上下文自动判断是否加载。你不需要安装任何东西，只需要在支持的环境（如 Claude Code）中即可使用。

**Q: 调用了技能后还能反悔吗？**

可以。任何时候你都可以改变想法，Agent 会服从你的最新指令。
