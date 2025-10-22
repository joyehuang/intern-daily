import { DayStats } from "./types";

interface RenderOptions {
  date: string;
  tz: string;
  note?: string;
}

function formatOverview(stats: DayStats): string {
  const overview = stats.overview;
  const byKind = overview.byKind || {};
  const topSkills = overview.topSkills.length ? overview.topSkills.join("、") : "暂无统计";

  const lines = [
    `- 提交数：${overview.commitCount}`,
    `- 影响文件：${overview.fileCount}（TS/TSX: ${byKind.ts_tsx ?? 0}，样式: ${byKind.style ?? 0}，配置: ${byKind.config ?? 0}，其他: ${byKind.other ?? 0})`,
    `- 技能标签：${topSkills}`,
    `- 杠杆评估：高 ${overview.leverage?.high ?? 0}，低 ${overview.leverage?.low ?? 0}，待判 ${overview.leverage?.neutral ?? 0}`,
  ];
  if (stats.unstaged?.fileCount) {
    lines.push(`- 工作区未暂存变更：${stats.unstaged.fileCount} 文件（不计入提交）`);
  }
  return lines.join("\n");
}

function formatModules(stats: DayStats): string {
  if (!stats.modules.length) {
    return "- 暂无模块改动记录";
  }
  return stats.modules
    .map((module) => {
      const highlights = module.highlights.length
        ? module.highlights.map((h) => `- ${h}`).join("\n")
        : "- 暂无亮点";
      return `### ${module.name}\n${highlights}`;
    })
    .join("\n\n");
}

function formatCommits(stats: DayStats): string {
  if (!stats.commits.length) {
    return "- 今日无提交";
  }
  return stats.commits.map((commit) => `- [${commit.sha7}] ${commit.subject}`).join("\n");
}

function formatLeverageSignals(stats: DayStats): string {
  const summary = stats.leverageSummary;
  if (!summary) {
    return "- 暂无杠杆信号";
  }
  const lines: string[] = [];
  if (summary.notes.length) {
    summary.notes.forEach((note) => lines.push(`- ${note}`));
  }
  if (summary.highFiles.length) {
    lines.push(`- 高杠杆改动示例：${summary.highFiles.slice(0, 3).join("；")}`);
  }
  if (summary.lowFiles.length) {
    lines.push(`- 疑似低杠杆改动：${summary.lowFiles.slice(0, 3).join("；")}`);
  }
  if (summary.highCommits.length) {
    lines.push(`- 高杠杆提交：${summary.highCommits.slice(0, 3).join("；")}`);
  }
  if (summary.lowCommits.length) {
    lines.push(`- 低杠杆提交：${summary.lowCommits.slice(0, 3).join("；")}`);
  }
  if (!lines.length) {
    return "- 暂无杠杆信号";
  }
  return lines.join("\n");
}

export function renderRuleMarkdown(stats: DayStats, opts: RenderOptions): string {
  const header = `# 日报 · ${opts.date}（${opts.tz}）`;
  const pieces = [header];

  if (opts.note) {
    pieces.push(`> ${opts.note}`);
  }

  pieces.push("\n## 今日总体概览\n" + formatOverview(stats));
  pieces.push("\n## 杠杆信号\n" + formatLeverageSignals(stats));
  pieces.push("\n## 关键改动摘要（按模块）\n" + formatModules(stats));
  pieces.push("\n## 详细提交\n" + formatCommits(stats));
  pieces.push("\n---\n\n> 由 intern-daily 自动生成");

  return pieces.join("\n\n");
}
