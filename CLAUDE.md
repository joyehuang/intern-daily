# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**intern-daily** is a CLI tool that generates daily Markdown reports from Git commits with optional OpenAI-powered AI summaries. It analyzes Git activity within a specified time window (default: today in `Australia/Sydney` timezone), classifies changes by module and skill tags, performs leverage analysis (high vs low-impact work), and produces structured reports for technical managers.

**Key Context:**
- Author perspective: Joye, a second-year student at University of Melbourne working on frontend for AI sales training/call simulation
- Tech stack context: Next.js 15/React 19, TypeScript, Tailwind + shadcn/ui, RTC/ASR/TTS
- Privacy-first: Only extracts metadata and keywords, never uploads full source code to AI

## Common Commands

### Development
```bash
# Install dependencies (use pnpm, this is a pnpm workspace)
pnpm install

# Build the CLI (compiles TypeScript from src/ to dist/)
pnpm build

# Build all packages in monorepo
pnpm -r build

# Clean build artifacts
pnpm --filter intern-daily clean
```

### Usage (after building)
```bash
# Basic usage - generate report for today
npx intern-daily gen

# Specify repository and date
npx intern-daily gen --repo /path/to/repo --date 2025-10-17

# Custom time window (overrides --date)
npx intern-daily gen --since 2025-10-17T00:00:00 --until 2025-10-17T23:59:59

# Include unstaged changes in stats (not in commit list)
npx intern-daily gen --include-unstaged

# Skip AI summary (use rule-based summary only)
npx intern-daily gen --no-ai

# Generate and open in system editor
npx intern-daily gen --open

# Verbose debug output
npx intern-daily gen -v
```

### Environment Variables
Required for AI summary:
```bash
OPENAI_API_KEY="sk-..."                    # Required for AI features
OPENAI_BASE_URL="https://api.openai.com/v1" # Optional, for proxies
INTERN_DAILY_MODEL="gpt-4o-mini"            # Optional, defaults to gpt-4o-mini
INTERN_DAILY_TZ="Australia/Sydney"          # Optional, default timezone
```

The CLI automatically loads `.env` from the current directory via `dotenv`.

## Architecture

This is a **pnpm workspace monorepo** with a single package `packages/intern-daily/`.

### Data Flow Pipeline
1. **Time Resolution** (`time.ts`): Parse `--date/--since/--until` + timezone → ISO time window
2. **Git Collection** (`git.ts`): Execute `git log/show/diff` commands to extract commits and diffs
3. **Diff Parsing** (`parse.ts`): Parse unified diff output (`--unified=0` for minimal hunks)
4. **Classification** (`classify.ts`): Assign skill tags and module prefixes to file changes
5. **Leverage Analysis** (`analyze.ts`): Detect high-leverage (cross-layer, new features) vs low-leverage (pixel-pushing, styling-only) signals
6. **Redaction** (`redact.ts`): Strip secrets, replace red-line keywords (API keys, tokens) with `•••`
7. **Summarization** (`summarize.ts`): Call OpenAI API with redacted evidence or fallback to rule-based summary
8. **Rendering** (`render.ts`): Generate final Markdown with sections: overview, module summaries, commit list, tomorrow's plan, leverage signals
9. **File Output** (`fs.ts`): Write to `.internlog/daily-YYYY-MM-DD.md` (or custom `--output`)

### Module Responsibilities

- **`cli.ts`**: Commander-based CLI entry point; parses options, calls `generateDailyReport()`, handles `--open` flag
- **`git.ts`**: Wraps `git log`, `git show`, `git diff` via `child_process.spawn`; validates repo
- **`parse.ts`**: Parses unified diff format to extract added/deleted line ranges
- **`classify.ts`**: Multi-label skill tag assignment (UI样式, React组件改造, 状态/副作用, 数据/接口/RTC, 可访问性, 测试, 工程化/配置) based on file extensions and keyword matching
- **`analyze.ts`**: Orchestrates collection → builds `DayStats` with leverage summary
- **`redact.ts`**: Removes sensitive patterns (env vars, keys, tokens); truncates evidence snippets
- **`summarize.ts`**: Sends redacted input to OpenAI API; includes system prompt with Joye's context
- **`render.ts`**: Generates Markdown from `DayStats` (fallback when AI is disabled/fails)
- **`time.ts`**: Uses `luxon` for timezone-aware date parsing
- **`fs.ts`**: Ensures parent directories exist before writing
- **`types.ts`**: TypeScript interfaces for all data structures

### Skill Tag Logic (in `classify.ts`)

Tags are **multi-label** and **weighted** by:
- File count × line changes × keyword hits
- **UI样式**: `.css/.scss` files, or `.tsx` with only `className`/inline `style` changes
- **React组件改造**: `.tsx` with component/function signature changes, `props` shape changes
- **状态/副作用**: `useState/useReducer/useEffect/useRef`, custom hooks
- **数据/接口/RTC**: `lib/**`, `app/api/**`, `fetch/axios/WebRTC/RTC` keywords
- **可访问性**: `aria-*`, `role`, language/caption/keyboard-related
- **测试**: `*.test.ts*`, `__tests__/**`
- **工程化/配置**: `*.config.*`, build scripts, ESLint, etc.

### Leverage Detection (in `analyze.ts`)

- **High-leverage signals**: Cross-layer changes (state + API + UI), new components, performance optimizations, accessibility additions, test coverage
- **Low-leverage signals**: Style-only commits (no logic changes), small repetitive tweaks, single-file pixel adjustments
- Outputs separate lists: `highFiles`, `lowFiles`, `highCommits`, `lowCommits`, `notes`

### Privacy & Redaction (in `redact.ts`)

**Ignored paths** (never read):
- `**/*.env*`, `**/*.pem`, `**/*.key`, `**/.envrc`
- `**/node_modules/**`, `**/.next/**`, `**/.turbo/**`

**Red-line keywords** (replaced with `•••` before sending to OpenAI):
- `AKIA`, `sk-`, `Bearer `, `-----BEGIN`
- Long alphanumeric strings resembling tokens

Only metadata, file paths, and keyword hits are sent to OpenAI — **never full source code**.

## Important Implementation Notes

### Git Command Details
- Uses `git log --since=<iso> --until=<iso> --pretty=%H%x09%ad%x09%s --date=iso-local` for commit list
- Uses `git show --unified=0 <sha>` for minimal diff hunks (precise add/delete positions)
- Uses `git diff --name-status <rev1>..<rev2>` for file-level stats

### AI Failure Handling
- If OpenAI API call fails (network, auth, rate limit), automatically falls back to rule-based summary
- CLI exit code remains 0 even on AI failure
- Markdown header includes note: "AI 摘要失败（已使用规则摘要）"

### TypeScript Build
- `module: "CommonJS"` (not ESM)
- `target: "ES2020"`
- Outputs to `dist/` with source maps and declaration files
- Shebang `#!/usr/bin/env node` in `cli.ts` for direct execution

### Output Location
- Default: `<repo>/.internlog/daily-YYYY-MM-DD.md`
- Custom: `--output <path>`
- Automatically creates parent directories

## File Structure

```
intern-daily-monorepo/
├── package.json              # Root package with "build": "pnpm -r build"
├── pnpm-workspace.yaml       # Defines packages/*
├── pnpm-lock.yaml
├── develop.md                # Detailed Chinese spec (reference for prompts/behavior)
└── packages/
    └── intern-daily/
        ├── package.json      # CLI package with bin entry
        ├── tsconfig.json
        ├── README.md         # User-facing usage guide
        └── src/
            ├── cli.ts        # Commander entry point
            ├── index.ts      # Main orchestration (generateDailyReport)
            ├── git.ts        # Git command wrappers
            ├── parse.ts      # Unified diff parser
            ├── classify.ts   # Skill tag + module assignment
            ├── analyze.ts    # Stats collection + leverage analysis
            ├── redact.ts     # Privacy/secret filtering
            ├── summarize.ts  # OpenAI API integration
            ├── render.ts     # Markdown template rendering
            ├── time.ts       # Timezone handling
            ├── fs.ts         # File I/O utilities
            └── types.ts      # TypeScript interfaces
```

## Key Data Structures (from `types.ts`)

```typescript
interface Commit {
  sha: string; sha7: string; date: string; subject: string;
}

interface FileChange {
  path: string; adds: number; dels: number;
  kind: "ts_tsx" | "style" | "config" | "other";
  hints: string[];           // Keyword hits (e.g., "useEffect", "aria-label")
  module: string;            // Common prefix (e.g., "app/rtc-call")
  skillTags: SkillTag[];
  leverage: "high" | "low" | "neutral";
  leverageSignals: string[];
}

interface DayStats {
  commits: Commit[];
  files: FileChange[];
  overview: DayOverview;
  modules: ModuleSummary[];
  leverageSummary: { highFiles, lowFiles, highCommits, lowCommits, notes };
  unstaged?: { fileCount: number };
}
```

## System Prompt Context (in `summarize.ts`)

The AI is primed with:
- Author: **Joye**, second-year University of Melbourne student
- Context: Frontend for AI sales training/call simulation
- Stack: Next.js 15/React 19, TypeScript, Tailwind, shadcn/ui, RTC/ASR/TTS
- Output requirements: Concise, evidence-based, structured for tech managers
- Emphasis: If day is mostly UI styling, suggest "leverage improvements" (abstraction, tests, a11y)

## Development Guidelines

- **Always run `pnpm build`** after source changes (TypeScript compilation required)
- **Test with local repo**: `npx intern-daily gen --repo /path/to/test-repo --date YYYY-MM-DD -v`
- **Check AI behavior**: Toggle `--no-ai` to compare rule-based vs AI summaries
- **Validate redaction**: Run with `-v` and inspect logs for any leaked secrets
- **Module detection**: Ensure common prefixes are correctly aggregated (see `classify.ts` logic)
- **Leverage signals**: Review `analyze.ts` heuristics when adding new detection patterns

## Future Extension Points (not implemented in MVP)

- AST parsing (instead of keyword matching) using `@typescript-eslint/typescript-estree` or `tree-sitter`
- Multi-repo aggregation
- Weekly/monthly rollups
- Resume bullet point extraction
- Cloud integration (GitHub API for PRs/issues)
