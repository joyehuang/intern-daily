# intern-daily

> AI-powered daily report generator for interns - Track your growth, not just your work.

`intern-daily` 是一个基于 Git 提交历史自动生成实习日报的 CLI 工具。通过 AI 智能分析代码改动，评估工作的**含金量**（content value），并提供职业成长建议。

## ✨ 核心特性

- **AI 驱动的含金量评估**: 基于 5 个维度（技术新颖性、技能深化、重复性、技术深度、职业发展）智能评估每日工作价值
- **历史记忆功能**: 对比过去 14 天的工作，识别重复性任务，给出提升建议
- **代码上下文提取**: 自动提取关键代码片段及上下文，支持 20+ 编程语言
- **个性化报告**: 基于用户背景（学校、专业、职业目标、技术栈）定制报告内容
- **Markdown 输出**: 生成结构化、可读性强的日报文档
- **本地数据库**: 使用 SQLite 持久化存储，支持历史回顾和趋势分析
- **周报生成**: 汇总一周工作，提供成长轨迹分析（开发中）
- **模块化设计**: 高可维护性和可扩展性，支持未来 Web 后台集成

## 📋 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [命令详解](#命令详解)
- [配置选项](#配置选项)
- [输出示例](#输出示例)
- [工作原理](#工作原理)
- [开发指南](#开发指南)
- [常见问题](#常见问题)

## 📦 安装

### 系统要求

- **Node.js**: >= 20.0.0
- **Git**: 确保项目在 Git 仓库中
- **OpenAI API Key**: 用于 AI 分析（可选，但推荐）

### 全局安装（推荐）

```bash
npm install -g intern-daily
```

### 本地开发

```bash
git clone https://github.com/joyehuang/intern-daily.git
cd intern-daily
pnpm install
pnpm --filter intern-daily build
pnpm --filter intern-daily link --global
```

## 🚀 快速开始

### 1. 初始化配置

在你的项目仓库根目录运行：

```bash
intern-daily init
```

根据提示输入你的个人信息：
- 姓名、学校、专业、年级
- 实习职位、公司
- 实习开始日期
- 职业目标（如：全栈开发、后端工程师）
- 学习重点（如：性能优化、测试、架构设计）
- 技术栈（如：React, TypeScript, Node.js）
- 时区选择
- 是否启用 PDF 导出（需安装额外依赖）

配置文件将保存为 `.intern-daily.config.json`。

### 2. 设置 OpenAI API Key

在项目根目录创建 `.env` 文件：

```bash
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env
```

可选配置：

```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，用于自定义 API 端点
```

### 3. 生成日报

```bash
# 生成今日日报
intern-daily gen

# 生成指定日期的日报
intern-daily gen --date 2025-10-20

# 生成指定时间范围的日报
intern-daily gen --since 2025-10-20T00:00:00 --until 2025-10-20T23:59:59

# 指定输出路径
intern-daily gen --output ./reports/2025-10-20.md

# 禁用 AI 分析，仅生成规则摘要
intern-daily gen --no-ai
```

## 📖 命令详解

### `intern-daily init`

初始化配置文件，交互式引导用户设置个人信息。

**选项**:
- `--repo <path>`: 目标仓库路径（默认：当前目录 `.`）

**示例**:
```bash
# 在当前仓库初始化
intern-daily init

# 在指定仓库初始化
intern-daily init --repo /path/to/your/project
```

### `intern-daily gen`

生成日报或周报。

**选项**:

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--repo <path>` | 目标 Git 仓库路径 | `.` |
| `--date <YYYY-MM-DD>` | 自然日期 | 今日 |
| `--since <ISO>` | 开始时间（ISO 8601 格式） | 由 `--date` 推导 |
| `--until <ISO>` | 结束时间（ISO 8601 格式） | 由 `--date` 推导 |
| `--output <path>` | 输出文件路径 | `./.internlog/daily-YYYY-MM-DD.md` |
| `--max-commits <n>` | 单日最大提交数 | `200` |
| `--include-unstaged` | 统计未暂存改动 | `false` |
| `--no-ai` | 禁用 AI 分析 | `false` |
| `--tz <IANA_TZ>` | 时区 | 配置文件中的值或 `Australia/Sydney` |
| `--open` | 生成后打开文件 | `false` |

**示例**:
```bash
# 生成昨天的日报
intern-daily gen --date 2025-10-21

# 自定义时区
intern-daily gen --tz Asia/Shanghai

# 生成后自动打开
intern-daily gen --open

# 包含未暂存的改动统计
intern-daily gen --include-unstaged
```

## ⚙️ 配置选项

配置文件 `.intern-daily.config.json` 示例：

```json
{
  "user": {
    "name": "张三",
    "school": "清华大学",
    "major": "计算机科学与技术",
    "year": 3,
    "position": "前端开发实习生",
    "company": "字节跳动",
    "internStartDate": "2025-09-01",
    "careerGoals": "全栈开发工程师",
    "learningFocus": ["性能优化", "前端架构", "测试"]
  },
  "techStack": ["React", "TypeScript", "Node.js", "Next.js"],
  "timezone": "Asia/Shanghai",
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
    "email": "example@example.com"
  }
}
```

### 配置字段说明

#### `user` (必填)
- `name` (必填): 姓名
- `position` (必填): 实习职位
- `school`, `major`, `year`: 学校信息（可选）
- `company`: 公司名称（可选）
- `internStartDate`: 实习开始日期（可选）
- `careerGoals`: 职业目标（可选，用于 AI 定制建议）
- `learningFocus`: 学习重点数组（可选，用于 AI 评估对齐度）

#### `techStack` (必填)
技术栈数组，用于 AI 识别相关技术和评估技能成长。

#### `timezone`
默认时区，影响 `--date` 参数的解析。

#### `openai`
- `dailyModel`: 日报使用的 AI 模型（推荐 `gpt-4o-mini`，速度快成本低）
- `weeklyModel`: 周报使用的 AI 模型（推荐 `gpt-4`，分析更深入）
- `baseURL`: 自定义 OpenAI API 端点（可选）

#### `codeContext`
- `contextLines`: 代码片段上下文行数（默认 10）
- `enableSyntaxHighlight`: 是否启用语法高亮（默认 true）

#### `export`
- `pdf`: 是否启用 PDF 导出（需额外依赖，开发中）
- `email`: 邮件地址（未来用于自动发送，开发中）

## 📄 输出示例

生成的日报示例：

```markdown
# 日报 · 2025-10-22

## 📊 今日概览
- 提交数：5 个
- 影响文件：12 个
- 核心技能：TypeScript、数据库设计、OpenAI 集成
- **含金量**：高 ✅ - 首次实现 AI 驱动的含金量评估系统，涉及多模块设计与架构决策

## 💡 工作亮点
今天完成了 intern-daily 核心模块的开发，包括数据库设计、配置管理、代码上下文提取和 AI 集成。重点突破了 OpenAI API 的 prompt 工程，设计了 5 维度的含金量评估框架。同时解决了 inquirer ESM 兼容性和表单验证的技术难题。

## 📦 按模块分组

### 数据库模块 (db.ts)
- 设计 4 表 SQLite 架构（user_profile, daily_reports, code_contexts, weekly_reports）
- 实现 CRUD 操作类和批量插入优化
- 添加 schema 版本管理和自动迁移

### 配置管理 (config.ts)
- 实现交互式配置初始化（inquirer）
- 添加配置验证和错误处理
- 支持 JSON 文件持久化

### AI 集成 (ai.ts)
- 实现 `assessContentValue` 函数，5 维度评估
- 设计 daily/weekly 报告生成的 prompt 模板
- 支持历史上下文传递（14 天滚动窗口）

## 🎯 含金量分析
**高含金量理由**: 这是项目的核心架构搭建阶段，涉及多个技术领域的深度整合：
1. **技术新颖性**: 首次尝试 Shiki 语法高亮、better-sqlite3、OpenAI prompt 工程
2. **技术深度**: 跨数据库设计、CLI 交互、AI 集成的全栈实现
3. **架构决策**: 模块化设计、类型安全、错误处理等工程实践
4. **问题解决**: 解决 ESM/CommonJS 兼容性、inquirer 表单验证等实际问题

## 📚 学习与反思
- **学到**: OpenAI API 的 JSON mode 用法、inquirer 的 filter/validate 执行顺序
- **深化**: TypeScript 严格模式下的类型设计、SQLite 性能优化（索引、批量插入）
- **待提升**: 需要补充单元测试、考虑错误重试机制

## 🔗 提交记录
- [`a1b2c3d`] chore: initial project setup with infrastructure
- [`b2c3d4e`] fix: resolve TypeScript compilation errors
- [`c3d4e5f`] feat(db): implement SQLite database module
- [`d4e5f6g`] feat(config): implement configuration management
- [`e5f6g7h`] feat(ai): implement AI module with OpenAI integration

---
```

## 🔍 工作原理

### 1. 数据采集
- 使用 `git log` 和 `git diff` 提取提交历史和代码改动
- 解析 unified diff 格式，提取 hunks 和行号信息
- 检测文件类型（支持 20+ 编程语言）

### 2. 代码上下文提取
- 针对每个 commit，提取改动的代码片段
- 包含上下文（默认 ±10 行）
- 支持语法高亮（Shiki）

### 3. 规则分类
- 基于文件路径、关键字、改动模式进行分类
- 提取技能标签（如：React, TypeScript, API, Database）
- 识别模块（如：Frontend, Backend, Testing）

### 4. AI 含金量评估
- 构建包含用户背景、历史记录、今日工作的 prompt
- 调用 OpenAI API（gpt-4o-mini）进行 5 维度评估
- 返回结构化结果：`{ level: "high" | "medium" | "low", reason: "...", assessment: "..." }`

### 5. 日报生成
- 汇总所有数据（提交、代码、含金量评估）
- 调用 OpenAI 生成自然语言报告
- 输出 Markdown 格式文件

### 6. 数据持久化
- 将日报、代码上下文、含金量评估存入 SQLite
- 支持历史查询和趋势分析

## 🧩 模块架构

```
src/
├── cli.ts              # CLI 入口，命令解析
├── index.ts            # 主流程编排
├── config.ts           # 配置管理
├── db.ts               # 数据库操作
├── analyze.ts          # Git 提交分析
├── classify.ts         # 规则分类
├── context.ts          # 代码上下文提取
├── highlight.ts        # 语法高亮
├── ai.ts               # OpenAI 集成
└── summarize.ts        # 报告生成
```

### 数据流

```
Git Repo → analyze.ts → classify.ts → context.ts
                                           ↓
                                      highlight.ts
                                           ↓
                 db.ts ← ai.ts ← summarize.ts
                   ↓
              Markdown 日报
```

## 🛠️ 开发指南

### 本地开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm --filter intern-daily build

# 格式化代码
pnpm --filter intern-daily format

# 代码检查
pnpm --filter intern-daily lint

# 类型检查
pnpm --filter intern-daily type-check

# 本地链接
pnpm --filter intern-daily link --global
```

### 代码规范

- **Prettier**: 自动格式化（100 字符行宽）
- **ESLint**: TypeScript 代码检查
- **TypeScript**: 严格模式（所有检查启用）

### Git 提交规范

使用 Conventional Commits：

```
feat: 新功能
fix: 修复 bug
chore: 杂项（依赖更新、配置等）
docs: 文档更新
style: 代码格式（不影响逻辑）
refactor: 重构
test: 测试相关
```

### 添加新模块

1. 在 `src/` 下创建新文件
2. 导出类型和函数
3. 在 `index.ts` 中集成
4. 更新 `DATABASE.md`（如涉及数据库）
5. 补充单元测试
6. 更新本 README

## ❓ 常见问题

### Q1: 为什么需要 Node.js >= 20?

A: 项目使用 `inquirer` v9，该版本为 ES Module 格式，需要 Node.js 20+ 的原生 ESM 支持。

### Q2: 没有 OpenAI API Key 可以使用吗?

A: 可以！使用 `--no-ai` 参数可以生成基于规则的摘要报告，但无法获得 AI 的含金量评估和个性化建议。

### Q3: 如何查看历史日报?

A: 所有日报存储在 `.internlog/` 目录下，文件名格式为 `daily-YYYY-MM-DD.md`。历史数据也保存在 SQLite 数据库中（`.intern-daily.db`）。

### Q4: 支持哪些编程语言?

A: 支持 20+ 语言，包括：
- TypeScript, JavaScript, JSX, TSX
- Python, Java, Go, Rust
- C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala
- Bash, SQL, Markdown, JSON, YAML, HTML, CSS, SCSS

### Q5: 含金量评估的 5 个维度是什么?

A:
1. **技术新颖性**: 是否接触新技术/概念？
2. **技能深化**: 是否在已有技能上有深度提升？
3. **重复性**: 与过去 2 周是否高度重复？
4. **技术深度**: 是否涉及跨层次改动（状态+接口+UI）？架构级思考？
5. **职业发展**: 是否符合用户的学习重点和职业目标？

### Q6: 如何自定义 AI 模型?

A: 编辑 `.intern-daily.config.json`：

```json
{
  "openai": {
    "dailyModel": "gpt-4",  // 改为 gpt-4 以获得更深入分析
    "weeklyModel": "gpt-4",
    "baseURL": "https://your-custom-endpoint.com/v1"  // 自定义端点
  }
}
```

### Q7: 为什么初始化时提示 "input.trim is not a function"?

A: 这是旧版本的 bug，已在 v0.0.1 修复。请确保使用最新版本或参考 [fix commit](https://github.com/joyehuang/intern-daily/commit/xxx)。

## 🗺️ 开发路线图

### v0.1 (当前版本)
- [x] 数据库设计与实现
- [x] 配置管理
- [x] 代码上下文提取
- [x] 语法高亮
- [x] AI 含金量评估
- [x] 日报生成
- [ ] 集成测试
- [ ] 周报生成

### v0.2 (计划中)
- [ ] 月报生成
- [ ] 简历亮点提取
- [ ] PDF 导出
- [ ] 邮件发送
- [ ] Web 后台（简单版）

### v1.0 (未来)
- [ ] 可视化数据面板
- [ ] 多人协作支持
- [ ] 自定义评估维度
- [ ] 更多 AI 模型支持

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

开发前请阅读 [CLAUDE.md](./CLAUDE.md) 了解项目架构。

## 📧 联系方式

- GitHub Issues: https://github.com/joyehuang/intern-daily/issues
- Email: [待补充]

---

**Made with ❤️ for all interns growing in their careers.**
