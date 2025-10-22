# intern-daily

最小可用版本的 CLI，可根据指定仓库在目标时间窗内的 Git 提交生成 Markdown 日报，并可选调用 OpenAI 生成自然语言总结。

## 开发与构建

```bash
pnpm install
pnpm build
```

编译产物位于 `dist/`，发布后可通过 `npx intern-daily gen` 调用。

## 使用示例

在目标仓库根目录执行：

```bash
npx intern-daily gen
```

常用选项：

- `--repo <path>`：目标 Git 仓库路径，默认当前目录。
- `--date <YYYY-MM-DD>`：自然日，配合 `--tz`（默认 `Australia/Sydney`）。
- `--since/--until <ISO>`：自定义时间范围，优先级高于 `--date`。
- `--output <path.md>`：输出文件路径，默认 `./.internlog/daily-YYYY-MM-DD.md`。
- `--max-commits <n>`：单日最大提交数，默认 200。
- `--include-unstaged`：统计未暂存改动数量（不进入提交列表）。
- `--no-ai`：仅使用规则摘要，不调用 OpenAI。
- `--tz <IANA_TZ>`：自定义时区。
- `--open`：生成后调用系统默认编辑器打开结果。

需要调用 OpenAI 总结时，可通过 `.env` 或环境变量注入：

```bash
# .env 文件（与执行命令的目录一致）
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.openai.com/v1"   # 可选
INTERN_DAILY_MODEL="gpt-4o-mini"              # 可选
INTERN_DAILY_TZ="Australia/Sydney"            # 可选

# 或直接在 shell 中导出
export OPENAI_API_KEY="sk-..."
```

## 行为说明

- 无提交时输出基础骨架并提示“今日无提交”。
- 规则摘要会按照模块前缀聚合，并基于关键字给出技能标签权重。
- `--no-ai` 或未设置 `OPENAI_API_KEY` 时自动使用规则摘要；AI 调用失败会回退并在提示中给出原因。
- `--include-unstaged` 仅统计数量，不将未暂存文件列入提交列表。
- CLI 会在启动时自动读取当前目录的 `.env` 文件（基于 [dotenv](https://github.com/motdotla/dotenv)）。
- 会自动识别高杠杆产出 vs 疑似低杠杆（dirty work）：对单个文件与提交打标签，并在 Markdown 中输出“杠杆信号”区块。

## AI 总结与杠杆分析

1. 准备好 `.env`（或在 shell 中 `export OPENAI_API_KEY=...`），确保构建完成后在目标 Git 仓库执行：

   ```bash
   intern-daily gen --repo .           # 如果通过 pnpm link --global 注册
   # 或在本仓库下：
   pnpm --filter intern-daily exec -- intern-daily gen --repo /path/to/repo
   ```

2. 工具会先解析 Git 提交 + diff，识别：
   - 疑似低杠杆信号：仅样式/像素级调节、规模很小的重复性改动等；
   - 高杠杆信号：跨层改动（状态/接口/工程化/测试/可访问性等）、新增组件或逻辑、性能优化等。

3. 若检测到高/低杠杆信号，会写入 Markdown 的“杠杆信号”章节，并把整合后的结构体传递给 OpenAI。
   - 有 API Key 且未加 `--no-ai` 时，默认调用 OpenAI 生成自然语言日报，重点说明哪些改动值得总结、哪些是 dirty work 并给出提升建议；
   - 无 API Key 或加了 `--no-ai` 时，会退回规则摘要模式，但仍保留杠杆标注，便于手动整理。

4. 建议在日报中引用这些信号：
   - 高杠杆条目可直接写入次日计划/周报/简历要点；
   - 疑似低杠杆的部分，可在日报中补上“如何提升杠杆”的思考（抽象、补测试、补可访问性等），形成可操作的复盘。
