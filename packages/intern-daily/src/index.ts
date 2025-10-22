/**
 * Main orchestration module for daily report generation
 * Integrates all modules: git analysis, classification, code context extraction,
 * database persistence, AI-powered content value assessment, and report generation
 */

import path from "path";
import { ensureRepo } from "./git";
import { resolveTimeWindow } from "./time";
import { collectDayStats } from "./analyze";
import { renderRuleMarkdown } from "./render";
import { aiSummarize } from "./summarize";
import { GenerateOptions, TimeWindow } from "./types";
import { InternDailyDB } from "./db";
import { loadConfig, getConfigPath, configExists, UserConfig } from "./config";
import { extractContextForCommits } from "./context";
import { assessContentValue, generateDailyReport as generateAIDailyReport } from "./ai";
import type { DailyContext, HistoricalContext, ContentValueAssessment } from "./ai";

export interface GenerateResult {
  markdown: string;
  usedAi: boolean;
  note?: string;
  outputPath: string;
  timeWindow: TimeWindow;
  contentValue?: ContentValueAssessment;
}

function buildNote(messages: string[]): string | undefined {
  const filtered = messages.filter(Boolean);
  if (!filtered.length) return undefined;
  return filtered.join("；");
}

/**
 * Generate daily report with AI-powered content value assessment
 */
export async function generateDailyReport(options: GenerateOptions): Promise<GenerateResult> {
  const repoPath = path.resolve(options.repo || ".");
  await ensureRepo(repoPath);

  const window = resolveTimeWindow({
    date: options.date,
    since: options.since,
    until: options.until,
    tz: options.tz,
  });

  // Check if configuration exists
  const configPath = getConfigPath(repoPath);
  let userConfig: UserConfig | null = null;
  let db: InternDailyDB | null = null;

  if (configExists(repoPath)) {
    try {
      userConfig = loadConfig(configPath);
      // Initialize database
      const dbPath = path.join(repoPath, ".intern-daily.db");
      const { initDatabase } = await import("./db");
      const dbInstance = initDatabase(dbPath);
      db = new InternDailyDB(dbInstance);
    } catch (error) {
      console.warn(`⚠️ Failed to load config or initialize database: ${(error as Error).message}`);
    }
  }

  // Collect git statistics
  const { stats, summarizeInput } = await collectDayStats({
    repoPath,
    window,
    maxCommits: options.maxCommits,
    includeUnstaged: options.includeUnstaged,
    verbose: options.verbose,
  });

  const notes: string[] = [];
  let markdown = "";
  let usedAi = false;
  let contentValue: ContentValueAssessment | undefined;

  // Check if AI is enabled
  const aiEnabled = !options.noAi && Boolean(process.env.OPENAI_API_KEY);
  if (!aiEnabled) {
    if (options.noAi) {
      notes.push("已跳过 AI 总结 (--no-ai)");
    } else if (!process.env.OPENAI_API_KEY) {
      notes.push("未配置 OPENAI_API_KEY，使用规则摘要");
    }
  }

  // Enhanced AI generation with content value assessment (if config exists)
  if (aiEnabled && userConfig && db) {
    try {
      // Extract code contexts for commits
      const commitShas = stats.commits.slice(0, 10).map((c) => c.sha); // Limit to 10 commits for performance
      const codeContextsMap = await extractContextForCommits(repoPath, commitShas, 10);

      // Build today's context
      const todayContext: DailyContext = {
        date: window.dateLabel,
        skillTags: stats.overview.topSkills,
        modules: stats.modules.map((m) => m.name),
        commitCount: stats.commits.length,
        fileCount: stats.files.length,
        lineAdditions: stats.files.reduce((sum, f) => sum + f.adds, 0),
        lineDeletions: stats.files.reduce((sum, f) => sum + f.dels, 0),
        commits: stats.commits.map((c) => ({ sha: c.sha, subject: c.subject })),
        codeHighlights: stats.modules.flatMap((m) => m.highlights),
      };

      // Get historical context (past 14 days)
      const historicalDays: HistoricalContext[] = db.dailyReports
        .getRecentDays(14)
        .filter((report) => report.date < window.dateLabel)
        .map((report) => ({
          date: report.date,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          skillTags: JSON.parse(report.skill_tags || "[]"),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          modules: JSON.parse(report.modules || "[]"),
          contentValueLevel: report.content_value_level || undefined,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          highlights: report.highlights ? JSON.parse(report.highlights) : undefined,
        }));

      // Assess content value
      const userProfile = db.userProfile.getProfile();
      if (userProfile && userProfile.name && userProfile.position) {
        contentValue = await assessContentValue(
          {
            name: userProfile.name,
            school: userProfile.school,
            major: userProfile.major,
            year: userProfile.year ? String(userProfile.year) : undefined,
            position: userProfile.position,
            company: userProfile.company,
            intern_start_date: userProfile.intern_start_date,
            career_goals: userProfile.career_goals,
            learning_focus: userProfile.learning_focus,
            tech_stack: userProfile.tech_stack,
          },
          todayContext,
          historicalDays
        );

        // Prepare code contexts for report generation
        const codeContextsForReport = Array.from(codeContextsMap.entries())
          .flatMap(([_sha, fileChanges]) =>
            fileChanges.slice(0, 3).map((fc) => ({
              filePath: fc.filePath,
              language: fc.language,
              snippet: fc.changes
                .slice(0, 1)
                .map((ch) => ch.codeSnippet)
                .join("\n"),
            }))
          )
          .slice(0, 5); // Limit to 5 snippets total

        // Generate AI daily report
        markdown = await generateAIDailyReport(
          {
            name: userProfile.name,
            school: userProfile.school,
            major: userProfile.major,
            year: userProfile.year ? String(userProfile.year) : undefined,
            position: userProfile.position,
            company: userProfile.company,
            intern_start_date: userProfile.intern_start_date,
            career_goals: userProfile.career_goals,
            learning_focus: userProfile.learning_focus,
            tech_stack: userProfile.tech_stack,
          },
          todayContext,
          contentValue,
          codeContextsForReport
        );
        usedAi = true;

        // Persist to database
        const reportId = db.dailyReports.insert({
          date: window.dateLabel,
          repo_path: repoPath,
          content_value_level: contentValue.level,
          content_value_reason: contentValue.reason,
          content_value_assessment: contentValue.assessment,
          skill_tags: JSON.stringify(todayContext.skillTags),
          modules: JSON.stringify(todayContext.modules),
          commit_count: todayContext.commitCount,
          file_count: todayContext.fileCount,
          line_additions: todayContext.lineAdditions,
          line_deletions: todayContext.lineDeletions,
          highlights: JSON.stringify(todayContext.codeHighlights),
          learning_points: JSON.stringify([]), // To be filled by AI extraction in future
          ai_summary: markdown,
          commits: JSON.stringify(todayContext.commits),
        });

        // Persist code contexts
        for (const [sha, fileChanges] of codeContextsMap.entries()) {
          for (const fileChange of fileChanges) {
            for (const change of fileChange.changes) {
              db.codeContexts.insert({
                daily_report_id: reportId,
                commit_sha: sha,
                file_path: fileChange.filePath,
                change_type: fileChange.changeType,
                code_snippet: change.codeSnippet,
                context_before: change.contextBefore,
                context_after: change.contextAfter,
                line_start: change.lineStart,
                line_end: change.lineEnd,
                additions: change.additions,
                deletions: change.deletions,
              });
            }
          }
        }
      }
    } catch (error) {
      notes.push(`AI 含金量评估失败（${(error as Error).message}）`);
      console.error("AI assessment error:", error);
    }
  }

  // Fallback to old AI summarization if config doesn't exist
  if (aiEnabled && !markdown) {
    try {
      const content = await aiSummarize(summarizeInput, {
        enabled: true,
        model: undefined,
      });
      markdown = content;
      usedAi = true;
    } catch (err) {
      notes.push(`AI 摘要失败（${(err as Error).message}）`);
    }
  }

  // Fallback to rule-based markdown
  if (!markdown) {
    const isNoCommit = stats.commits.length === 0;
    if (isNoCommit) {
      notes.push("今日无提交，输出基础骨架");
    }
    markdown = renderRuleMarkdown(stats, {
      date: window.dateLabel,
      tz: window.tz,
      note: buildNote(notes),
    });
  }

  const outputPath = path.resolve(
    options.output || path.join(repoPath, ".internlog", `daily-${window.dateLabel}.md`)
  );

  return {
    markdown,
    usedAi,
    note: buildNote(notes),
    outputPath,
    timeWindow: window,
    contentValue,
  };
}
