import { getCommitDiff, getCommitFileStats, getCommits, getUnstagedCount } from "./git";
import { parseUnifiedDiff } from "./parse";
import { buildFileChange } from "./classify";
import {
  Commit,
  DayOverview,
  DayStats,
  FileChange,
  LeverageLevel,
  SkillTag,
  SummarizeInput,
  TimeWindow,
} from "./types";
import { redact } from "./redact";

interface AggregateEntry {
  path: string;
  adds: number;
  dels: number;
  kind: FileChange["kind"];
  hints: Set<string>;
  module: string;
  skillTags: Set<SkillTag>;
  leverageScores: Record<LeverageLevel, number>;
  leverageSignals: Set<string>;
}

const LOW_SUBJECT_REGEX = /(fix|tweak|update|adjust)\s*(ui|style|copy|padding|margin)?/i;
const HIGH_SUBJECT_REGEX =
  /(feat|feature|refactor|support|integrat|optimi[sz]e|a11y|accessib|hook|api|data|backend)/i;

function ensureOverviewByKind(): Record<string, number> {
  return {
    ts_tsx: 0,
    style: 0,
    config: 0,
    other: 0,
  };
}

function ensureLeverageCount(): Record<LeverageLevel, number> {
  return {
    high: 0,
    low: 0,
    neutral: 0,
  };
}

function mergeFileChange(agg: Map<string, AggregateEntry>, change: FileChange): void {
  const existing = agg.get(change.path);
  if (existing) {
    existing.adds += change.adds;
    existing.dels += change.dels;
    for (const hint of change.hints) {
      existing.hints.add(hint);
    }
    for (const tag of change.skillTags) {
      existing.skillTags.add(tag);
    }
    if (typeof existing.leverageScores[change.leverage] !== "number") {
      existing.leverageScores[change.leverage] = 0;
    }
    existing.leverageScores[change.leverage] += 1;
    for (const signal of change.leverageSignals) {
      existing.leverageSignals.add(signal);
    }
  } else {
    const scores: Record<LeverageLevel, number> = { high: 0, low: 0, neutral: 0 };
    scores[change.leverage] = 1;
    agg.set(change.path, {
      path: change.path,
      adds: change.adds,
      dels: change.dels,
      kind: change.kind,
      hints: new Set(change.hints),
      module: change.module,
      skillTags: new Set(change.skillTags),
      leverageScores: scores,
      leverageSignals: new Set(change.leverageSignals),
    });
  }
}

function selectLeverageLevel(scores: Record<LeverageLevel, number>): LeverageLevel {
  const priority: LeverageLevel[] = ["high", "neutral", "low"];
  let best: LeverageLevel = "neutral";
  let bestScore = -Infinity;
  let bestPriority = priority.indexOf(best);
  priority.forEach((level) => {
    const score = scores[level] ?? 0;
    const orderIndex = priority.indexOf(level);
    if (score > bestScore || (score === bestScore && orderIndex < bestPriority)) {
      best = level;
      bestScore = score;
      bestPriority = orderIndex;
    }
  });
  if (bestScore <= 0) {
    return "neutral";
  }
  return best;
}

function toFileChanges(map: Map<string, AggregateEntry>): FileChange[] {
  return Array.from(map.values()).map((entry) => ({
    path: entry.path,
    adds: entry.adds,
    dels: entry.dels,
    kind: entry.kind,
    hints: Array.from(entry.hints),
    module: entry.module,
    skillTags: Array.from(entry.skillTags),
    leverage: selectLeverageLevel(entry.leverageScores),
    leverageSignals: Array.from(entry.leverageSignals),
  }));
}

function computeTopSkills(files: FileChange[], limit = 3): SkillTag[] {
  const scores = new Map<SkillTag, number>();
  for (const file of files) {
    const weight = Math.max(1, file.adds + file.dels);
    for (const tag of file.skillTags) {
      scores.set(tag, (scores.get(tag) || 0) + weight);
    }
  }
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function buildModuleHighlights(files: FileChange[]): DayStats["modules"] {
  const modules = new Map<string, { highlights: string[]; evidence: Set<string> }>();

  for (const file of files) {
    const key = file.module;
    if (!modules.has(key)) {
      modules.set(key, { highlights: [], evidence: new Set<string>() });
    }
    const bucket = modules.get(key)!;
    const tags = file.skillTags.join("、");
    const hints = file.hints.slice(0, 4).join("、");
    const parts = [`${file.path} (+${file.adds}/-${file.dels})`];
    if (tags) {
      parts.push(`涉及：${tags}`);
    }
    if (hints) {
      parts.push(`关键词：${hints}`);
    }
    if (file.leverage !== "neutral") {
      const leverLabel = file.leverage === "high" ? "高杠杆" : "疑似低杠杆";
      const signalText = file.leverageSignals.length
        ? `（${file.leverageSignals.join("、")}）`
        : "";
      parts.push(`杠杆判定：${leverLabel}${signalText}`);
    }
    bucket.highlights.push(redact(parts.join("；")));
    bucket.evidence.add(redact(file.path));
    file.hints.forEach((hint) => bucket.evidence.add(redact(hint)));
    file.leverageSignals.forEach((signal) => bucket.evidence.add(redact(signal)));
  }

  return Array.from(modules.entries()).map(([name, value]) => ({
    name,
    highlights: value.highlights,
    evidence: Array.from(value.evidence),
  }));
}

function buildOverview(files: FileChange[], commits: Commit[]): DayOverview {
  const byKind = ensureOverviewByKind();
  const leverage = ensureLeverageCount();
  for (const file of files) {
    byKind[file.kind] = (byKind[file.kind] || 0) + 1;
    leverage[file.leverage] = (leverage[file.leverage] || 0) + 1;
  }
  const topSkills = computeTopSkills(files);
  return {
    commitCount: commits.length,
    fileCount: files.length,
    byKind,
    topSkills,
    leverage,
  };
}

export interface CollectOptions {
  repoPath: string;
  window: TimeWindow;
  maxCommits: number;
  includeUnstaged: boolean;
  verbose?: boolean;
}

export interface CollectResult {
  stats: DayStats;
  summarizeInput: SummarizeInput;
}

export async function collectDayStats(options: CollectOptions): Promise<CollectResult> {
  const { repoPath, window, maxCommits, includeUnstaged, verbose } = options;

  const commits = await getCommits(repoPath, window.since, window.until, maxCommits);
  const aggregate = new Map<string, AggregateEntry>();
  const highCommitSummaries: string[] = [];
  const lowCommitSummaries: string[] = [];

  for (const commit of commits) {
    const [fileStats, diffText] = await Promise.all([
      getCommitFileStats(repoPath, commit.sha),
      getCommitDiff(repoPath, commit.sha),
    ]);
    const parsedDiffs = parseUnifiedDiff(diffText);
    const diffMap = new Map<string, typeof parsedDiffs[number]>();
    parsedDiffs.forEach((entry) => diffMap.set(entry.path, entry));

    let commitHasHigh = false;
    let commitHasLow = false;
    let totalDelta = 0;
    const commitHighSignals = new Set<string>();
    const commitLowSignals = new Set<string>();

    for (const stat of fileStats) {
      totalDelta += stat.adds + stat.dels;
      const diff = diffMap.get(stat.path);
      const change = buildFileChange(stat.path, stat.adds, stat.dels, diff);
      if (!change) continue;
      if (change.leverage === "high") {
        commitHasHigh = true;
        change.leverageSignals.forEach((signal) => commitHighSignals.add(redact(signal)));
      } else if (change.leverage === "low") {
        if (!commitHasHigh) {
          commitHasLow = true;
        }
        change.leverageSignals.forEach((signal) => commitLowSignals.add(redact(signal)));
      }
      mergeFileChange(aggregate, change);
    }

    const label = `[${commit.sha7}] ${redact(commit.subject)}`;
    if (!commitHasHigh && HIGH_SUBJECT_REGEX.test(commit.subject)) {
      commitHasHigh = true;
    }

    if (commitHasHigh) {
      const detail = commitHighSignals.size
        ? `（${Array.from(commitHighSignals).join("、")}）`
        : "";
      highCommitSummaries.push(`${label}${detail}`);
    } else {
      if (
        !commitHasLow &&
        (commitLowSignals.size > 0 || totalDelta <= 20 || LOW_SUBJECT_REGEX.test(commit.subject))
      ) {
        commitHasLow = true;
      }
      if (commitHasLow) {
        const reasons = commitLowSignals.size
          ? Array.from(commitLowSignals).join("、")
          : totalDelta <= 20
          ? "改动规模较小"
          : "样式类微调";
        const detail = reasons ? `（${reasons}）` : "";
        lowCommitSummaries.push(`${label}${detail}`);
      }
    }
  }

  const files = toFileChanges(aggregate);
  const overview = buildOverview(files, commits);
  const modules = buildModuleHighlights(files);
  const highFileHighlights = files
    .filter((file) => file.leverage === "high")
    .map((file) =>
      redact(
        `${file.path}：${file.leverageSignals.length ? file.leverageSignals.join("、") : "跨层/高杠杆改动"}`
      )
    );
  const lowFileHighlights = files
    .filter((file) => file.leverage === "low")
    .map((file) =>
      redact(
        `${file.path}：${file.leverageSignals.length ? file.leverageSignals.join("、") : "样式或重复性微调"}`
      )
    );
  const leverageNotes: string[] = [];
  if (highFileHighlights.length) {
    leverageNotes.push(`识别到 ${highFileHighlights.length} 个高杠杆改动，建议记录复盘。`);
  }
  if (lowFileHighlights.length) {
    leverageNotes.push(`检测到 ${lowFileHighlights.length} 个疑似低杠杆改动，可考虑抽象/合并以提升杠杆。`);
  }
  if (highCommitSummaries.length) {
    leverageNotes.push(`高杠杆提交 ${highCommitSummaries.length} 条。`);
  }
  if (lowCommitSummaries.length && lowCommitSummaries.length >= highCommitSummaries.length) {
    leverageNotes.push(`疑似低杠杆提交 ${lowCommitSummaries.length} 条，留意样式类重复劳动。`);
  }

  const stats: DayStats = {
    commits,
    files,
    overview,
    modules,
    leverageSummary: {
      highFiles: highFileHighlights,
      lowFiles: lowFileHighlights,
      highCommits: highCommitSummaries,
      lowCommits: lowCommitSummaries,
      notes: leverageNotes,
    },
  };

  if (includeUnstaged) {
    const unstagedCount = await getUnstagedCount(repoPath);
    if (unstagedCount > 0) {
      stats.unstaged = { fileCount: unstagedCount };
    }
  }

  const summarizeInput: SummarizeInput = {
    date: window.dateLabel,
    tz: window.tz,
    overview,
    modules,
    commits: commits.map((commit) => ({ sha7: commit.sha7, subject: redact(commit.subject) })),
    leverage: stats.leverageSummary,
    unstaged: stats.unstaged,
  };

  return { stats, summarizeInput };
}
