# intern-daily 产品需求文档 (PRD)

> **版本**: v0.1 - MVP 完成 ✅
> **最后更新**: 2025-10-22

---

## 一、产品定位

### 核心价值
**intern-daily** 是一款基于 Git 提交分析的实习生成长记录助手，通过 AI 自动提取、分析和总结实习生的日常工作，帮助实习生：
- 📊 **量化工作内容**：自动记录每天的技术产出
- 🧠 **识别学习价值**：判断任务的含金量和成长意义
- 📈 **追踪技能成长**：构建个人技能发展轨迹
- 💼 **积累简历素材**：从日常工作中提炼亮点库

### 目标用户
- **主要用户**：所有需要记录实习经历的实习生（前端/全栈/后端等）
- **典型场景**：每日下班前生成日报，周/月末总结成长，求职时快速提取简历亮点

---

## 二、核心功能需求

### 2.1 日报生成 (Daily Report)

#### 输入
- **数据源**：Git 提交记录 + diff 代码片段
- **时间范围**：
  - 默认："今天 00:00 - 此时此刻"
  - 支持指定任意日期
  - 支持自定义时间窗口（如补昨天的日报）
- **仓库范围**：单仓库（MVP 阶段）

#### 处理逻辑
1. **提交解析**：提取提交信息（SHA、时间、主题、文件变更）
2. **代码分析**：
   - 识别文件类型（TS/TSX/CSS/Config 等）
   - 提取关键代码片段（关键词：useState、useEffect、aria-*、fetch、API 等）
   - 模块分组（按路径前缀聚合，如 `app/rtc-call`, `components/ui`）
3. **技能标签**：多标签分类
   - UI 样式
   - React 组件开发
   - 状态管理/副作用
   - 数据接口/API
   - 可访问性
   - 测试
   - 工程化/配置
4. **含金量评估**（核心功能）：
   - **依赖历史记忆**：对比过去 N 天的任务类型
   - **判断重复性**：
     - 第一次做某类任务：含金量 **高** ✅
     - 连续 2 周做同类任务：含金量 **中** ⚠️
     - 连续 3+ 周做同类任务：含金量 **低** ❌（Dirty Work 预警）
   - **识别成长信号**：
     - 跨层次改动（状态+接口+UI）
     - 新技术栈首次使用
     - 架构级优化
     - 测试/文档完善

#### 输出
- **Markdown 文件**：
  - 保存路径：`<repo>/intern-daily/daily-YYYY-MM-DD.md`
  - 内容结构：
    ```markdown
    # 日报 · 2025-10-22

    ## 📊 今日概览
    - 提交数：X 个
    - 影响文件：Y 个
    - 核心技能标签：[标签1, 标签2, ...]
    - 含金量评估：高 X 项 / 中 Y 项 / 低 Z 项

    ## 💡 工作亮点（AI 总结）
    [AI 生成的自然语言总结，突出技术深度和学习价值]

    ## 📦 按模块分组
    ### app/rtc-call
    - [提交 abc123] 实现实时字幕组件 RealtimeSubtitles
    - 含金量：**高** - 首次实现 WebRTC 相关功能

    ### components/ui
    - [提交 def456] 调整按钮组移动端布局
    - 含金量：**低** - 连续第 3 周处理样式调整

    ## 🎯 含金量分析
    - 高含金量任务（学到新东西）：[列表]
    - 低含金量任务（重复性工作）：[列表]
    - AI 建议：[如何提升任务含金量，如主动提出重构、补测试、学习新技术等]

    ## 📚 学习记录
    - 新接触技术：[如首次使用 WebRTC API]
    - 技能深化：[如从简单组件到复杂状态管理]
    ```

- **PDF 格式**（可选）：
  - 通过配置选项 `--export-pdf` 生成
  - 样式：专业简洁，适合归档或分享

- **邮件发送**（可选）：
  - 通过配置 `--email` 发送到指定邮箱
  - 附件：PDF 版本
  - 主题：`[日报] YYYY-MM-DD - <用户名>`

### 2.2 周报生成 (Weekly Report)

#### 输入
- 过去 7 天的所有日报 Markdown 文件（从 SQLite 读取）
- 或指定周范围（如 `--week 2025-W42`）

#### 处理逻辑
- **聚合统计**：总提交数、总文件数、技能标签分布
- **AI 深度分析**（使用 GPT-4）：
  - 本周技术成长轨迹
  - 工作模式识别（如前 3 天 UI，后 2 天接口）
  - 含金量趋势（是否陷入重复工作）
  - 对比上周成长点
- **提炼亮点**：提取本周最有价值的 3-5 条工作记录
- **可视化图表**（在 Markdown 中嵌入）：
  - **贡献热力图**（GitHub-style）：7 天提交密度
  - **技能雷达图**（Mermaid 或 ASCII art）：各技能标签占比
  - **代码量折线图**：每日代码变更量
  - **含金量分布**：高/中/低任务占比饼图

#### 输出
- **Markdown**：纯文字总结 + 可视化图表（Mermaid 图表）
- **PDF**（可选）：轻量方案生成
- 保存路径：`<repo>/intern-daily/weekly-YYYY-Wxx.md`

#### 周报额外内容（相比日报）
- 📈 **技能成长曲线**：本周新接触技术 vs 上周
- 📚 **课外自由学习建议**：基于当前技能短板，AI 推荐学习资源
- 🎯 **下周发展建议**：结合职业目标，给出具体行动项

### 2.3 月报生成 (Monthly Report)

#### 输入
- 过去一个月的所有日报/周报

#### 处理逻辑
- **技能树构建**：展示本月技能点的扩展（可视化）
- **成长曲线**：含金量趋势图
- **阶段性总结**：AI 生成职业发展建议
- **简历亮点提取**：自动筛选可写入简历的条目

#### 输出
- Markdown + PDF
- 保存路径：`<repo>/intern-daily/monthly-YYYY-MM.md`

### 2.4 简历亮点库 (Highlight Library)

#### 功能
- 从**所有历史日报**中提取高含金量任务
- 按技能标签分类
- 提供 STAR 法则模板（Situation-Task-Action-Result）

#### 版本迭代
- **v0.2**：按含金量高低排序提取
  ```bash
  intern-daily extract --from 2025-06-01 --to 2025-10-22 --min-value high
  ```
- **v1.0**：支持岗位描述匹配
  ```bash
  intern-daily extract --from 2025-06-01 --to 2025-10-22 --job-desc "全栈开发，React+Node.js"
  ```
  → AI 会根据 JD 筛选相关技能标签，再从中提取高含金量案例

#### 输出示例
```markdown
# 简历亮点库

## React 组件开发
- **实时字幕组件开发** [含金量：高]
  - Situation: RTC 通话项目需要实时字幕功能
  - Task: 设计并实现独立的字幕组件
  - Action: 使用 WebSocket + React Context 管理状态，支持多语言
  - Result: 组件复用率 100%，性能优化后延迟 < 50ms

## 性能优化
- ...
```

### 2.5 网页端后台 (Web Dashboard)

#### MVP 版本（v0.1）- 简单可视化
- 本地启动服务：`intern-daily serve`
- 功能：
  - 📊 日报/周报/月报列表查看
  - 📈 GitHub-style 贡献热力图（提交密度）
  - 🎯 技能雷达图（技能标签分布）
  - 📉 含金量趋势图（按周统计）
  - 📝 在线预览 Markdown（只读）

#### 完整版本（v1.0）- 全功能后台
- **可视化图表**：
  - 工作强度热力图（按天展示提交数、行数）
  - 代码量趋势图（累计/每日）
  - 技能成长树（技能点扩展路径）
- **在线编辑**：
  - 修改日报内容
  - 手动添加学习笔记
  - 调整含金量评估
- **导出功能**：
  - 一键导出 PDF
  - 批量导出周报/月报
  - 分享链接（静态 HTML）

#### 技术栈
- **前端**：Next.js + React + Tailwind
- **图表**：Recharts + Mermaid
- **后端**：本地 API（读取 SQLite）
- **部署**：本地启动（无需云服务）

---

## 三、AI 功能设计（核心亮点）

### 3.1 AI Agent 定位
不仅仅是"总结工具"，而是一个**关注实习生职业发展的 AI 导师**：
- 识别学习价值
- 预警重复性工作
- 提供成长建议
- 辅助职业规划

### 3.2 AI 输入内容（隐私优化）
**不上传源码全文**，只上传：
- 提交主题和统计数据
- 文件路径和类型
- 关键词命中（如 `useEffect`, `aria-label`, `fetch`）
- 脱敏后的代码片段（变量名替换为 `var_1`, `func_2`）

### 3.3 AI Prompt 设计

#### System Prompt（日报）
```
你是一位专业的技术导师，帮助实习生分析每日工作的技术价值和成长意义。

用户背景：
- 姓名：[用户配置]
- 学校/专业：[用户配置]
- 实习岗位：[前端/全栈/...]
- 技术栈：[Next.js, React, TypeScript, ...]

输入数据：
- Git 提交记录（元数据）
- 技能标签统计
- 含金量初步判断（基于历史对比）

任务：
1. 用自然语言总结今天的工作亮点（100-200 字）
2. 识别学习价值：
   - 哪些是新接触的技术/概念？
   - 哪些是技能深化？
   - 哪些是重复性工作？
3. 提供成长建议：
   - 如果含金量偏低，建议如何主动提升（如提出重构、补测试、学习新技术）
   - 如果技术栈单一，建议扩展方向
4. 输出格式：Markdown，包含 emoji，专业且友好

注意：
- 基于证据，不夸大
- 如果是重复性工作，坦诚指出，但给出建设性建议
- 关注长期职业发展，而非单日产出
```

#### System Prompt（周报）
```
你是一位职业发展顾问，帮助实习生回顾一周的技术成长。

输入：过去 7 天的日报摘要

任务：
1. 总结本周技术成长轨迹（200-300 字）
2. 识别工作模式和趋势
3. 对比上周，指出进步点
4. 提炼本周最有价值的 3-5 条工作记录（可写入简历）
5. 给出下周发展建议
```

### 3.4 记忆功能设计（关键）

**核心原则**：含金量由 **AI 客观判断**，而非硬编码规则。

#### 数据存储
- 本地 SQLite 数据库：`<repo>/intern-daily/memory.db`
- 表结构：
  ```sql
  CREATE TABLE daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
    repo_path TEXT,
    commit_count INTEGER,
    file_count INTEGER,
    line_additions INTEGER,
    line_deletions INTEGER,
    skill_tags TEXT,  -- JSON array: ["UI样式", "React组件"]
    modules TEXT,  -- JSON array: ["app/rtc-call", "components/ui"]
    commits TEXT,  -- JSON array: [{"sha": "...", "subject": "..."}]
    content_value_assessment TEXT,  -- AI 生成的含金量评估（high/medium/low + reason）
    highlights TEXT,  -- JSON array: 当日亮点
    learning_points TEXT,  -- JSON array: 学到的新东西
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE code_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_id INTEGER,
    commit_sha TEXT,
    file_path TEXT,
    change_type TEXT,  -- added/modified/deleted
    code_snippet TEXT,  -- 带语法高亮的 Markdown 代码块
    context_before TEXT,  -- ±10 行上下文
    context_after TEXT,
    skill_tags TEXT,  -- JSON array
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id)
  );

  CREATE TABLE user_profile (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  ```

#### 含金量判断逻辑（AI-Driven）
```typescript
// 不再硬编码规则，而是构建 AI Prompt
function buildContentValuePrompt(
  userProfile: UserProfile,
  todayContext: DayContext,
  historyDays: DailyReport[]  // 过去 14 天
): string {
  return `
你是一位客观的技术导师，帮助实习生评估今日工作的含金量。

## 用户背景
${JSON.stringify(userProfile, null, 2)}

## 历史任务（过去 14 天摘要）
${historyDays.map(day => `- ${day.date}: ${day.skill_tags.join(', ')} | ${day.highlights.join('; ')}`).join('\n')}

## 今日任务详情
- 技能标签: ${todayContext.skill_tags.join(', ')}
- 模块: ${todayContext.modules.join(', ')}
- 提交数: ${todayContext.commit_count}
- 代码变更: +${todayContext.line_additions} -${todayContext.line_deletions}

请客观评估今日工作的含金量，输出 JSON：
{
  "level": "high" | "medium" | "low",
  "reason": "具体原因（50字内）",
  "assessment": "详细分析（100-200字）"
}

评估维度：
1. 技术新颖性：是否接触新技术/概念？
2. 技能深化：是否在已有技能上有深度提升？
3. 重复性：与过去 2 周是否高度重复？
4. 技术深度：是否涉及跨层次改动（状态+接口+UI）？
5. 职业发展：是否符合用户的学习重点和职业目标？
`;
}
```

---

## 四、技术选型

### 4.1 CLI 工具
- **语言**：TypeScript + Node.js
- **CLI 框架**：Commander.js
- **时间处理**：Luxon（支持时区）
- **Markdown 渲染**：自定义模板 + Marked.js
- **语法高亮**：Shiki 或 Prism.js（生成带高亮的 Markdown 代码块）
- **PDF 生成**：Markdown-PDF（轻量方案，避免 Puppeteer 的 200MB Chromium）
- **邮件发送**：Nodemailer

### 4.2 数据存储
- **本地日报**：Markdown 文件（`intern-daily/` 目录）
- **历史记忆**：SQLite（`memory.db`）
- **配置**：`.intern-daily.config.json` + `.env`

### 4.3 AI 服务
- **API**：OpenAI GPT-4o-mini（或 GPT-4）
- **备选**：支持兼容的 API 代理（如 Azure OpenAI）

### 4.4 Web 后台（未来）
- **前端**：Next.js + React + Tailwind
- **图表**：Recharts / ECharts
- **部署**：可本地启动（`npx intern-daily serve`）

---

## 五、用户配置

### 5.1 配置文件：`.intern-daily.config.json`
```json
{
  "user": {
    "name": "Joye",
    "school": "University of Melbourne",
    "major": "Computer Science",
    "year": 2,
    "position": "Frontend Intern",
    "company": "XX公司",
    "internStartDate": "2025-06-01",
    "careerGoals": "全栈开发 / React 专家",
    "learningFocus": ["性能优化", "架构设计", "测试"]
  },
  "techStack": ["Next.js", "React", "TypeScript", "Tailwind"],
  "timezone": "Australia/Sydney",
  "openai": {
    "dailyModel": "gpt-4o-mini",
    "weeklyModel": "gpt-4",
    "baseURL": "https://api.openai.com/v1"
  },
  "codeContext": {
    "contextLines": 10,
    "enableSyntaxHighlight": true
  },
  "export": {
    "pdf": false,
    "email": null
  }
}
```

**配置方式**：
- **交互式初始化**：`intern-daily init`（推荐，用户友好）
- **手动编辑**：直接修改 `.intern-daily.config.json`（高级用户）

### 5.2 环境变量：`.env`
```bash
OPENAI_API_KEY="sk-..."
```

---

## 六、CLI 命令设计

### 基础命令
```bash
# 初始化配置
intern-daily init

# 生成今日日报
intern-daily gen

# 生成指定日期日报
intern-daily gen --date 2025-10-20

# 生成本周周报
intern-daily weekly

# 生成本月月报
intern-daily monthly

# 提取简历亮点
intern-daily extract --from 2025-06-01 --to 2025-10-22

# 启动 Web 后台（未来）
intern-daily serve

# 查看历史记录
intern-daily history --days 30
```

### 选项参数
```bash
--repo <path>          # 仓库路径（默认当前目录）
--date <YYYY-MM-DD>    # 指定日期
--since / --until      # 自定义时间窗
--output <path>        # 输出路径
--export-pdf           # 导出 PDF
--email <address>      # 发送到邮箱
--no-ai                # 跳过 AI 总结（仅规则摘要）
-v / --verbose         # 调试输出
```

---

## 七、用户确认的关键决策 ✅

### 技术实现
1. ✅ **SQLite 存储历史**（已确认）
2. ✅ **代码上下文提取**：±10 行（可配置）+ 语法高亮
3. ✅ **AI 模型分级**：日报 `gpt-4o-mini` / 周报月报 `gpt-4`
4. ✅ **PDF 生成**：使用轻量方案（Markdown-PDF）
5. ✅ **配置方式**：交互式 `intern-daily init` + 手动编辑兼容

### 产品逻辑
6. ✅ **含金量评估**：完全由 AI 决定（基于用户背景 + 历史对比），无硬编码规则
7. ✅ **周报额外内容**：技能成长曲线、学习建议、对比上周进步、可视化图表
8. ✅ **简历亮点提取**：v0.2 按含金量，v1.0 支持岗位描述匹配
9. ✅ **Web 后台**：MVP 做简单版本（只读预览 + 基础图表）

---

## 八、开发优先级与进度

### 🎯 MVP 阶段（v0.1）- 核心价值验证
**目标**：验证"AI + 含金量分析"核心价值

#### ✅ 已完成 (2025-10-22)

##### **P0 - 基础架构** ✅ 全部完成
- [x] 项目初始化（Prettier + ESLint + TypeScript）
- [x] Git 工作流设置（Conventional Commits）
- [x] Node.js >= 20.0.0 版本要求

##### **P0 - 核心模块开发** ✅ 全部完成
- [x] **数据库模块** (db.ts - 685行)
  - [x] SQLite schema 设计（DATABASE.md）
  - [x] 4 表结构：user_profile, daily_reports, code_contexts, weekly_reports
  - [x] Schema 版本管理和自动迁移
  - [x] CRUD 操作类（UserProfileDB, DailyReportsDB, CodeContextsDB, WeeklyReportsDB）
  - [x] 批量插入优化和性能索引

- [x] **配置管理模块** (config.ts - 330行)
  - [x] 交互式配置初始化 `intern-daily init`（inquirer）
  - [x] JSON 文件持久化（.intern-daily.config.json）
  - [x] 配置验证和错误处理
  - [x] 自动同步 user profile 到数据库
  - [x] 动态导入 inquirer 避免 ESM 问题

- [x] **代码上下文提取模块** (context.ts - 325行)
  - [x] Git diff 解析（unified diff 格式）
  - [x] 提取 ±N 行上下文（默认 10 行，可配置）
  - [x] 支持 20+ 编程语言识别
  - [x] 处理 added/modified/deleted 文件
  - [x] Hunk 级别的代码片段提取

- [x] **语法高亮模块** (highlight.ts - 189行)
  - [x] Shiki 集成（Singleton 模式）
  - [x] Markdown 代码块输出
  - [x] HTML 输出（为未来 Web dashboard 准备）
  - [x] highlightWithContext 和 highlightDiff 辅助函数

- [x] **AI 模块** (ai.ts - 407行)
  - [x] assessContentValue：5 维度含金量评估
    - 技术新颖性、技能深化、重复性、技术深度、职业发展
  - [x] generateDailyReport：日报生成（gpt-4o-mini）
  - [x] generateWeeklyReport：周报生成 prompt（gpt-4）
  - [x] 复杂的 prompt 工程：
    - 用户背景上下文
    - 历史 14 天对比
    - 代码改动示例
    - STAR 法则亮点提炼
    - Mermaid 图表建议

##### **P0 - 日报生成核心流程** ✅ 全部完成
- [x] **主流程整合** (index.ts - 232行)
  - [x] 完整数据流：Git → analyze → classify → context → AI → db → markdown
  - [x] 三层 fallback 机制：
    1. AI 含金量评估 + 个性化报告（需要 config + OpenAI key）
    2. 旧版 AI summarization（需要 OpenAI key）
    3. 规则摘要（rule-based markdown，无需 AI）
  - [x] 数据库持久化（daily_reports + code_contexts）
  - [x] 类型安全的错误处理

- [x] **端到端测试**
  - [x] `intern-daily gen --no-ai` 成功生成规则摘要
  - [x] `intern-daily gen` 带 AI fallback 正常运行
  - [x] 数据库初始化和用户配置同步测试通过
  - [x] 代码上下文提取测试通过（新文件警告符合预期）
  - [x] Graceful error handling 验证

##### **P0 - 文档** ✅ 全部完成
- [x] **README.md**（485 行）
  - [x] 安装指南和系统要求
  - [x] 快速开始教程
  - [x] 命令详解（init / gen）
  - [x] 配置选项完整说明
  - [x] 输出示例
  - [x] 工作原理说明
  - [x] 开发指南
  - [x] FAQ（常见问题）
  - [x] 开发路线图

- [x] **CLAUDE.md** - 开发者指南
- [x] **DATABASE.md** - 数据库架构文档
- [x] **REQUIREMENTS.md** - 本文档（产品需求）

#### 📋 待开发（v0.2+）

##### **P1 - 周报生成** (未开始)
- [ ] 聚合 7 天日报数据
- [ ] 生成可视化图表（Mermaid 格式）
- [ ] AI 深度总结（GPT-4）
- [ ] 实现 `intern-daily weekly` 命令

##### **P1 - Web 后台（简单版）** (未开始)
- [ ] 本地启动服务 `intern-daily serve`
- [ ] 日报/周报列表查看
- [ ] Markdown 预览（只读）
- [ ] GitHub-style 贡献热力图

### 📦 v0.2 - 增强功能
- [ ] **P2 - 月报生成**
- [ ] **P2 - 简历亮点提取**（按含金量高低）
- [ ] **P2 - PDF 导出**（Markdown-PDF）
- [ ] **P2 - 邮件发送**（Nodemailer）

### 🚀 v1.0 - 产品化
- [ ] **P3 - 简历亮点匹配**（支持岗位描述）
- [ ] **P3 - Web 后台完整版**（在线编辑、批量导出）
- [ ] **P3 - 多仓库支持**
- [ ] **P3 - npm 发包**

---

## 九、开发总结与下一步

### ✅ v0.1 MVP 完成总结（2025-10-22）

**核心成果**：
- ✅ 完整的日报生成流程（Git → AI 评估 → 数据库 → Markdown）
- ✅ 5 大核心模块全部完成（db, config, context, highlight, ai）
- ✅ 端到端测试通过
- ✅ 完整文档（README + DATABASE + CLAUDE + REQUIREMENTS）
- ✅ 14 次 Git 提交，全部推送到 main 分支

**技术亮点**：
- 模块化设计，单一职责原则
- 类型安全（TypeScript 严格模式）
- 三层 fallback 机制（AI → AI fallback → rule-based）
- AI-driven 含金量评估（5 维度 + 历史对比）
- 完善的错误处理和降级策略

**代码统计**：
- src/db.ts: 685 行
- src/config.ts: 330 行
- src/context.ts: 325 行
- src/ai.ts: 407 行
- src/index.ts: 232 行
- src/highlight.ts: 189 行
- README.md: 485 行
- DATABASE.md: 260 行

**Git 提交历史**：
```
c271d28 fix(config): use dynamic import for inquirer to avoid ESM issues
6059aea feat(core): integrate all modules for AI-powered daily reports
d891770 docs: write comprehensive README.md user documentation
d842832 docs: update REQUIREMENTS.md with development progress
2f37f1e feat(ai): implement AI module with OpenAI integration
1d8c8c8 feat(highlight): implement syntax highlighting module with Shiki
662977c feat(context): implement code context extraction module
fe2336d fix(config): remove filter functions causing TypeError in inquirer
2392def chore: add Node.js version requirement (>=20.0.0)
50c39ce fix: resolve TypeScript compilation errors
b876e0b feat(config): implement configuration management with init command
ec87abd style: format existing code with Prettier
617982e feat(db): implement SQLite database module with schema
490cd5e chore: initial project setup with infrastructure
```

### 🎯 下一步计划（v0.2）

#### 优先级排序：
1. **P1 - 周报生成**：实现 `intern-daily weekly` 命令
   - 聚合 7 天数据
   - 生成 Mermaid 图表
   - AI 深度总结（GPT-4）

2. **P2 - 月报生成**：实现 `intern-daily monthly` 命令

3. **P2 - 简历亮点提取**：实现 `intern-daily extract` 命令

4. **P2 - PDF 导出**：集成 Markdown-PDF

5. **P2 - 邮件发送**：集成 Nodemailer

6. **P3 - Web 后台**：实现 `intern-daily serve` 命令

### 技术债务（低优先级）

- 优化 `intern-daily init` 中的用户信息收集（部分字段可能未被 AI 充分利用）
- 考虑简化配置项
- 添加单元测试覆盖
- CI/CD 流程设置
- npm 发包准备
