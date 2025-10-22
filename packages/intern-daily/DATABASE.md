# Database Schema Design

## Overview

intern-daily uses **SQLite** as the local database to store:
- User profile and configuration
- Daily report metadata and history
- Code context snippets for AI analysis
- Content value assessments and learning points

Database location: `<repo>/.internlog/memory.db`

---

## Schema

### 1. `user_profile` - User Configuration

Stores user information for AI personalization.

```sql
CREATE TABLE IF NOT EXISTS user_profile (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Key-Value Pairs**:
```
name: "Joye"
school: "University of Melbourne"
major: "Computer Science"
year: "2"
position: "Frontend Intern"
company: "XX公司"
intern_start_date: "2025-06-01"
career_goals: "全栈开发 / React 专家"
learning_focus: '["性能优化", "架构设计"]'  -- JSON array
tech_stack: '["Next.js", "React", "TypeScript"]'  -- JSON array
timezone: "Australia/Sydney"
```

---

### 2. `daily_reports` - Daily Report Metadata

Stores metadata for each generated daily report.

```sql
CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,              -- YYYY-MM-DD
  repo_path TEXT NOT NULL,
  commit_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  line_additions INTEGER NOT NULL DEFAULT 0,
  line_deletions INTEGER NOT NULL DEFAULT 0,
  skill_tags TEXT,                         -- JSON: ["UI样式", "React组件"]
  modules TEXT,                            -- JSON: ["app/rtc-call", "components/ui"]
  commits TEXT,                            -- JSON: [{"sha":"...", "subject":"..."}]

  -- AI-generated assessments
  content_value_level TEXT CHECK(content_value_level IN ('high', 'medium', 'low')),
  content_value_reason TEXT,               -- Short reason (50 chars)
  content_value_assessment TEXT,           -- Detailed assessment (100-200 chars)

  highlights TEXT,                         -- JSON: ["亮点1", "亮点2"]
  learning_points TEXT,                    -- JSON: ["学到的东西1", "学到的东西2"]

  ai_summary TEXT,                         -- Full AI-generated summary (Markdown)

  markdown_path TEXT,                      -- Path to generated .md file

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_repo ON daily_reports(repo_path);
```

---

### 3. `code_contexts` - Code Context Snippets

Stores code snippets with context for AI analysis.

```sql
CREATE TABLE IF NOT EXISTS code_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_report_id INTEGER NOT NULL,
  commit_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  change_type TEXT CHECK(change_type IN ('added', 'modified', 'deleted')),

  -- Code snippet with syntax highlighting (Markdown code block)
  code_snippet TEXT,                       -- Highlighted changed lines
  context_before TEXT,                     -- ±N lines before change
  context_after TEXT,                      -- ±N lines after change

  skill_tags TEXT,                         -- JSON: inferred skill tags for this file

  line_start INTEGER,                      -- Starting line number
  line_end INTEGER,                        -- Ending line number
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_code_contexts_daily_report ON code_contexts(daily_report_id);
CREATE INDEX IF NOT EXISTS idx_code_contexts_file ON code_contexts(file_path);
```

---

### 4. `weekly_reports` - Weekly Report Metadata

Stores aggregated weekly reports.

```sql
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,                   -- ISO week number
  date_start TEXT NOT NULL,                -- YYYY-MM-DD (Monday)
  date_end TEXT NOT NULL,                  -- YYYY-MM-DD (Sunday)

  repo_path TEXT NOT NULL,

  total_commits INTEGER NOT NULL DEFAULT 0,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_additions INTEGER NOT NULL DEFAULT 0,
  total_deletions INTEGER NOT NULL DEFAULT 0,

  skill_distribution TEXT,                 -- JSON: {"UI样式": 10, "React组件": 5}
  content_value_distribution TEXT,         -- JSON: {"high": 3, "medium": 2, "low": 1}

  top_modules TEXT,                        -- JSON: ["app/rtc-call", "components/ui"]
  top_highlights TEXT,                     -- JSON: top 5 highlights

  ai_summary TEXT,                         -- AI-generated weekly summary (Markdown)
  learning_suggestions TEXT,               -- JSON: AI suggestions for next week

  visualization_data TEXT,                 -- JSON: data for Mermaid charts

  markdown_path TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(year, week, repo_path)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_date ON weekly_reports(year DESC, week DESC);
```

---

## Indexes

All indexes are created inline with table definitions:
- `idx_daily_reports_date` - Fast date-based queries
- `idx_daily_reports_repo` - Filter by repository
- `idx_code_contexts_daily_report` - Join daily reports with code contexts
- `idx_code_contexts_file` - Search by file path
- `idx_weekly_reports_date` - Weekly report chronological ordering

---

## Data Flow

### Daily Report Generation
1. Collect Git data (commits, diffs) → Parse changes
2. Extract code contexts (±10 lines) → Syntax highlight
3. Classify skill tags and modules
4. Query last 14 days from `daily_reports` (for AI context)
5. Call AI for content value assessment
6. Call AI for daily summary
7. Insert into `daily_reports` and `code_contexts`
8. Generate Markdown file

### Weekly Report Generation
1. Query `daily_reports` for past 7 days
2. Aggregate statistics (commits, files, skill distribution)
3. Query `code_contexts` for top highlights
4. Call AI (GPT-4) for weekly summary
5. Generate visualization data (Mermaid charts)
6. Insert into `weekly_reports`
7. Generate Markdown file

---

## Maintenance

### Database Migration
Version managed via `schema_version` in `user_profile`:
```sql
INSERT OR IGNORE INTO user_profile (key, value) VALUES ('schema_version', '1');
```

### Cleanup Old Data
Optional: Prune `code_contexts` older than N days (configurable):
```sql
DELETE FROM code_contexts
WHERE daily_report_id IN (
  SELECT id FROM daily_reports WHERE date < date('now', '-90 days')
);
```

---

## Security & Privacy

- Database file is local only, never uploaded
- Sensitive data (API keys) stored in `.env`, not in DB
- `code_contexts` can be optionally disabled via config (`storeCodeContexts: false`)
- All JSON fields are sanitized before storage (no raw secrets)

---

## Example Queries

### Get last 14 days history for AI prompt
```sql
SELECT
  date,
  skill_tags,
  modules,
  content_value_level,
  highlights
FROM daily_reports
WHERE date >= date('now', '-14 days')
ORDER BY date DESC;
```

### Get weekly skill distribution
```sql
SELECT
  skill_tags,
  COUNT(*) as days
FROM daily_reports
WHERE date >= date('now', '-7 days')
GROUP BY skill_tags;
```

### Find high-value tasks for resume
```sql
SELECT
  date,
  highlights,
  content_value_assessment
FROM daily_reports
WHERE content_value_level = 'high'
ORDER BY date DESC
LIMIT 20;
```
