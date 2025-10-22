export type SkillTag =
  | "UI样式"
  | "React组件改造"
  | "状态/副作用"
  | "数据/接口/RTC"
  | "可访问性"
  | "测试"
  | "工程化/配置";

export type LeverageLevel = "high" | "low" | "neutral";

export interface Commit {
  sha: string;
  sha7: string;
  date: string;
  subject: string;
}

export interface FileChange {
  path: string;
  adds: number;
  dels: number;
  kind: "ts_tsx" | "style" | "config" | "other";
  hints: string[];
  module: string;
  skillTags: SkillTag[];
  leverage: LeverageLevel;
  leverageSignals: string[];
}

export interface DayOverview {
  commitCount: number;
  fileCount: number;
  byKind: Record<string, number>;
  topSkills: SkillTag[];
  leverage: Record<LeverageLevel, number>;
}

export interface ModuleSummary {
  name: string;
  highlights: string[];
  evidence: string[];
}

export interface DayStats {
  commits: Commit[];
  files: FileChange[];
  overview: DayOverview;
  modules: ModuleSummary[];
  leverageSummary: {
    highFiles: string[];
    lowFiles: string[];
    highCommits: string[];
    lowCommits: string[];
    notes: string[];
  };
  unstaged?: { fileCount: number };
}

export interface SummarizeInput {
  date: string;
  tz: string;
  overview: DayOverview;
  modules: ModuleSummary[];
  commits: Array<Pick<Commit, "sha7" | "subject">>;
  leverage: DayStats["leverageSummary"];
  unstaged?: DayStats["unstaged"];
}

export interface AiConfig {
  enabled: boolean;
  model?: string;
}

export interface GenerateOptions {
  repo: string;
  date?: string;
  since?: string;
  until?: string;
  tz?: string;
  output?: string;
  maxCommits: number;
  includeUnstaged: boolean;
  noAi: boolean;
  open: boolean;
  verbose: boolean;
}

export interface TimeWindow {
  since: string;
  until: string;
  dateLabel: string;
  tz: string;
}
