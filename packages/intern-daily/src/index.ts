import path from "path";
import { ensureRepo } from "./git";
import { resolveTimeWindow } from "./time";
import { collectDayStats } from "./analyze";
import { renderRuleMarkdown } from "./render";
import { aiSummarize } from "./summarize";
import { GenerateOptions, TimeWindow } from "./types";

export interface GenerateResult {
  markdown: string;
  usedAi: boolean;
  note?: string;
  outputPath: string;
  timeWindow: TimeWindow;
}

function buildNote(messages: string[]): string | undefined {
  const filtered = messages.filter(Boolean);
  if (!filtered.length) return undefined;
  return filtered.join("；");
}

export async function generateDailyReport(options: GenerateOptions): Promise<GenerateResult> {
  const repoPath = path.resolve(options.repo || ".");
  await ensureRepo(repoPath);

  const window = resolveTimeWindow({
    date: options.date,
    since: options.since,
    until: options.until,
    tz: options.tz,
  });

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

  const aiEnabled = !options.noAi && Boolean(process.env.OPENAI_API_KEY);
  if (!aiEnabled) {
    if (options.noAi) {
      notes.push("已跳过 AI 总结 (--no-ai)");
    } else if (!process.env.OPENAI_API_KEY) {
      notes.push("未配置 OPENAI_API_KEY，使用规则摘要");
    }
  }

  if (aiEnabled) {
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
  };
}
