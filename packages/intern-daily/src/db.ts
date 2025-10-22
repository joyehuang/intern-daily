/**
 * Database module - SQLite operations for intern-daily
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * Database schema version
 */
const SCHEMA_VERSION = "1";

/**
 * User profile key-value interface
 */
export interface UserProfile {
  name?: string;
  school?: string;
  major?: string;
  year?: string;
  position?: string;
  company?: string;
  intern_start_date?: string;
  career_goals?: string;
  learning_focus?: string[]; // JSON array
  tech_stack?: string[]; // JSON array
  timezone?: string;
}

/**
 * Daily report database record
 */
export interface DailyReportRecord {
  id?: number;
  date: string; // YYYY-MM-DD
  repo_path: string;
  commit_count: number;
  file_count: number;
  line_additions: number;
  line_deletions: number;
  skill_tags?: string; // JSON
  modules?: string; // JSON
  commits?: string; // JSON
  content_value_level?: "high" | "medium" | "low";
  content_value_reason?: string;
  content_value_assessment?: string;
  highlights?: string; // JSON
  learning_points?: string; // JSON
  ai_summary?: string; // Markdown
  markdown_path?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Code context database record
 */
export interface CodeContextRecord {
  id?: number;
  daily_report_id: number;
  commit_sha: string;
  file_path: string;
  change_type: "added" | "modified" | "deleted";
  code_snippet?: string;
  context_before?: string;
  context_after?: string;
  skill_tags?: string; // JSON
  line_start?: number;
  line_end?: number;
  additions: number;
  deletions: number;
  created_at?: string;
}

/**
 * Weekly report database record
 */
export interface WeeklyReportRecord {
  id?: number;
  year: number;
  week: number; // ISO week
  date_start: string;
  date_end: string;
  repo_path: string;
  total_commits: number;
  total_files: number;
  total_additions: number;
  total_deletions: number;
  skill_distribution?: string; // JSON
  content_value_distribution?: string; // JSON
  top_modules?: string; // JSON
  top_highlights?: string; // JSON
  ai_summary?: string; // Markdown
  learning_suggestions?: string; // JSON
  visualization_data?: string; // JSON
  markdown_path?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Initialize database connection
 */
export function initDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Run migration
  migrateSchema(db);

  return db;
}

/**
 * Run database schema migration
 */
function migrateSchema(db: Database.Database): void {
  // Check current schema version
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const row = db.prepare("SELECT value FROM user_profile WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  const currentVersion = row?.value || "0";

  if (currentVersion === SCHEMA_VERSION) {
    return; // Already up to date
  }

  console.log(`Migrating database schema from v${currentVersion} to v${SCHEMA_VERSION}...`);

  // Create or update schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      repo_path TEXT NOT NULL,
      commit_count INTEGER NOT NULL DEFAULT 0,
      file_count INTEGER NOT NULL DEFAULT 0,
      line_additions INTEGER NOT NULL DEFAULT 0,
      line_deletions INTEGER NOT NULL DEFAULT 0,
      skill_tags TEXT,
      modules TEXT,
      commits TEXT,
      content_value_level TEXT CHECK(content_value_level IN ('high', 'medium', 'low')),
      content_value_reason TEXT,
      content_value_assessment TEXT,
      highlights TEXT,
      learning_points TEXT,
      ai_summary TEXT,
      markdown_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_repo ON daily_reports(repo_path);

    CREATE TABLE IF NOT EXISTS code_contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_report_id INTEGER NOT NULL,
      commit_sha TEXT NOT NULL,
      file_path TEXT NOT NULL,
      change_type TEXT CHECK(change_type IN ('added', 'modified', 'deleted')),
      code_snippet TEXT,
      context_before TEXT,
      context_after TEXT,
      skill_tags TEXT,
      line_start INTEGER,
      line_end INTEGER,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_code_contexts_daily_report ON code_contexts(daily_report_id);
    CREATE INDEX IF NOT EXISTS idx_code_contexts_file ON code_contexts(file_path);

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      total_commits INTEGER NOT NULL DEFAULT 0,
      total_files INTEGER NOT NULL DEFAULT 0,
      total_additions INTEGER NOT NULL DEFAULT 0,
      total_deletions INTEGER NOT NULL DEFAULT 0,
      skill_distribution TEXT,
      content_value_distribution TEXT,
      top_modules TEXT,
      top_highlights TEXT,
      ai_summary TEXT,
      learning_suggestions TEXT,
      visualization_data TEXT,
      markdown_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, week, repo_path)
    );

    CREATE INDEX IF NOT EXISTS idx_weekly_reports_date ON weekly_reports(year DESC, week DESC);
  `);

  // Update schema version
  db.prepare(`INSERT OR REPLACE INTO user_profile (key, value) VALUES ('schema_version', ?)`).run(
    SCHEMA_VERSION
  );

  console.log("Database migration completed.");
}

/**
 * User Profile Operations
 */
export class UserProfileDB {
  constructor(private db: Database.Database) {}

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO user_profile (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`
      )
      .run(key, value);
  }

  get(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM user_profile WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare("SELECT key, value FROM user_profile").all() as Array<{
      key: string;
      value: string;
    }>;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM user_profile WHERE key = ?").run(key);
  }

  /**
   * Get full user profile with JSON parsing
   */
  getProfile(): UserProfile {
    const data = this.getAll();
    return {
      name: data.name,
      school: data.school,
      major: data.major,
      year: data.year,
      position: data.position,
      company: data.company,
      intern_start_date: data.intern_start_date,
      career_goals: data.career_goals,
      learning_focus: data.learning_focus ? JSON.parse(data.learning_focus) : undefined,
      tech_stack: data.tech_stack ? JSON.parse(data.tech_stack) : undefined,
      timezone: data.timezone,
    };
  }

  /**
   * Set full user profile with JSON serialization
   */
  setProfile(profile: UserProfile): void {
    if (profile.name) this.set("name", profile.name);
    if (profile.school) this.set("school", profile.school);
    if (profile.major) this.set("major", profile.major);
    if (profile.year) this.set("year", profile.year);
    if (profile.position) this.set("position", profile.position);
    if (profile.company) this.set("company", profile.company);
    if (profile.intern_start_date) this.set("intern_start_date", profile.intern_start_date);
    if (profile.career_goals) this.set("career_goals", profile.career_goals);
    if (profile.learning_focus) this.set("learning_focus", JSON.stringify(profile.learning_focus));
    if (profile.tech_stack) this.set("tech_stack", JSON.stringify(profile.tech_stack));
    if (profile.timezone) this.set("timezone", profile.timezone);
  }
}

/**
 * Daily Reports Operations
 */
export class DailyReportsDB {
  constructor(private db: Database.Database) {}

  insert(report: DailyReportRecord): number {
    const result = this.db
      .prepare(
        `INSERT INTO daily_reports (
          date, repo_path, commit_count, file_count, line_additions, line_deletions,
          skill_tags, modules, commits,
          content_value_level, content_value_reason, content_value_assessment,
          highlights, learning_points, ai_summary, markdown_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        report.date,
        report.repo_path,
        report.commit_count,
        report.file_count,
        report.line_additions,
        report.line_deletions,
        report.skill_tags || null,
        report.modules || null,
        report.commits || null,
        report.content_value_level || null,
        report.content_value_reason || null,
        report.content_value_assessment || null,
        report.highlights || null,
        report.learning_points || null,
        report.ai_summary || null,
        report.markdown_path || null
      );
    return result.lastInsertRowid as number;
  }

  update(id: number, updates: Partial<DailyReportRecord>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE daily_reports SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  getByDate(date: string): DailyReportRecord | undefined {
    return this.db.prepare("SELECT * FROM daily_reports WHERE date = ?").get(date) as
      | DailyReportRecord
      | undefined;
  }

  getById(id: number): DailyReportRecord | undefined {
    return this.db.prepare("SELECT * FROM daily_reports WHERE id = ?").get(id) as
      | DailyReportRecord
      | undefined;
  }

  /**
   * Get reports for last N days (for AI context)
   */
  getRecentDays(days: number): DailyReportRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM daily_reports
         WHERE date >= date('now', '-${days} days')
         ORDER BY date DESC`
      )
      .all() as DailyReportRecord[];
  }

  /**
   * Get reports within date range
   */
  getByDateRange(startDate: string, endDate: string): DailyReportRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM daily_reports
         WHERE date >= ? AND date <= ?
         ORDER BY date DESC`
      )
      .all(startDate, endDate) as DailyReportRecord[];
  }

  /**
   * Get high-value reports for resume extraction
   */
  getHighValueReports(limit: number = 20): DailyReportRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM daily_reports
         WHERE content_value_level = 'high'
         ORDER BY date DESC
         LIMIT ?`
      )
      .all(limit) as DailyReportRecord[];
  }
}

/**
 * Code Contexts Operations
 */
export class CodeContextsDB {
  constructor(private db: Database.Database) {}

  insert(context: CodeContextRecord): number {
    const result = this.db
      .prepare(
        `INSERT INTO code_contexts (
          daily_report_id, commit_sha, file_path, change_type,
          code_snippet, context_before, context_after, skill_tags,
          line_start, line_end, additions, deletions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        context.daily_report_id,
        context.commit_sha,
        context.file_path,
        context.change_type,
        context.code_snippet || null,
        context.context_before || null,
        context.context_after || null,
        context.skill_tags || null,
        context.line_start || null,
        context.line_end || null,
        context.additions,
        context.deletions
      );
    return result.lastInsertRowid as number;
  }

  getByDailyReport(dailyReportId: number): CodeContextRecord[] {
    return this.db
      .prepare("SELECT * FROM code_contexts WHERE daily_report_id = ?")
      .all(dailyReportId) as CodeContextRecord[];
  }

  /**
   * Batch insert code contexts
   */
  insertBatch(contexts: CodeContextRecord[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO code_contexts (
        daily_report_id, commit_sha, file_path, change_type,
        code_snippet, context_before, context_after, skill_tags,
        line_start, line_end, additions, deletions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = this.db.transaction((contexts: CodeContextRecord[]) => {
      for (const ctx of contexts) {
        stmt.run(
          ctx.daily_report_id,
          ctx.commit_sha,
          ctx.file_path,
          ctx.change_type,
          ctx.code_snippet || null,
          ctx.context_before || null,
          ctx.context_after || null,
          ctx.skill_tags || null,
          ctx.line_start || null,
          ctx.line_end || null,
          ctx.additions,
          ctx.deletions
        );
      }
    });

    insertMany(contexts);
  }
}

/**
 * Weekly Reports Operations
 */
export class WeeklyReportsDB {
  constructor(private db: Database.Database) {}

  insert(report: WeeklyReportRecord): number {
    const result = this.db
      .prepare(
        `INSERT INTO weekly_reports (
          year, week, date_start, date_end, repo_path,
          total_commits, total_files, total_additions, total_deletions,
          skill_distribution, content_value_distribution,
          top_modules, top_highlights, ai_summary, learning_suggestions,
          visualization_data, markdown_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        report.year,
        report.week,
        report.date_start,
        report.date_end,
        report.repo_path,
        report.total_commits,
        report.total_files,
        report.total_additions,
        report.total_deletions,
        report.skill_distribution || null,
        report.content_value_distribution || null,
        report.top_modules || null,
        report.top_highlights || null,
        report.ai_summary || null,
        report.learning_suggestions || null,
        report.visualization_data || null,
        report.markdown_path || null
      );
    return result.lastInsertRowid as number;
  }

  getByWeek(year: number, week: number, repoPath: string): WeeklyReportRecord | undefined {
    return this.db
      .prepare("SELECT * FROM weekly_reports WHERE year = ? AND week = ? AND repo_path = ?")
      .get(year, week, repoPath) as WeeklyReportRecord | undefined;
  }

  getRecent(limit: number = 10): WeeklyReportRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM weekly_reports
         ORDER BY year DESC, week DESC
         LIMIT ?`
      )
      .all(limit) as WeeklyReportRecord[];
  }
}

/**
 * Unified Database API
 */
export class InternDailyDB {
  public userProfile: UserProfileDB;
  public dailyReports: DailyReportsDB;
  public codeContexts: CodeContextsDB;
  public weeklyReports: WeeklyReportsDB;

  constructor(private db: Database.Database) {
    this.userProfile = new UserProfileDB(db);
    this.dailyReports = new DailyReportsDB(db);
    this.codeContexts = new CodeContextsDB(db);
    this.weeklyReports = new WeeklyReportsDB(db);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get raw database instance (for advanced queries)
   */
  getRawDB(): Database.Database {
    return this.db;
  }
}

/**
 * Initialize and return database API
 */
export function getDatabase(dbPath: string): InternDailyDB {
  const db = initDatabase(dbPath);
  return new InternDailyDB(db);
}
