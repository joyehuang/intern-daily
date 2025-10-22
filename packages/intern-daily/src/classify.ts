import { ParsedFileDiff } from "./parse";
import { FileChange, LeverageLevel, SkillTag } from "./types";

const STYLE_EXTENSIONS = [".css", ".scss", ".sass", ".less", ".styl", ".pcss"];
const CONFIG_PATTERNS = [
  /(^|\/)next\.config\.[^/]+$/,
  /(^|\/)postcss\.config\.[^/]+$/,
  /(^|\/)tailwind\.config\.[^/]+$/,
  /(^|\/)eslint\.[^/]+$/,
  /(^|\/)babel\.config\.[^/]+$/,
  /(^|\/)tsconfig\.[^/]+$/,
  /(^|\/)package\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)vite\.config\.[^/]+$/,
];

const IGNORE_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)\.turbo\//,
  /\.env[^/]*$/,
  /\.pem$/,
  /\.key$/,
  /(^|\/)\.envrc$/,
];

const STATE_HOOKS = ["useState", "useReducer", "useEffect", "useRef", "useMemo", "useCallback"];
const DATA_KEYWORDS = ["fetch", "axios", "swr", "WebRTC", "webrtc", "RTC", "socket", "graphql", "prisma"];
const ACCESSIBILITY_KEYWORDS = ["aria-", "role=", "ariaLabel", "ariaDescribedby", "ariaHidden", "ariaLive", "alt="];
const TEST_KEYWORDS = ["describe(", "it(", "test(", "expect("];

function hasExtension(path: string, exts: string[]): boolean {
  return exts.some((ext) => path.toLowerCase().endsWith(ext));
}

export function shouldIgnorePath(path: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(path));
}

function detectKind(path: string): FileChange["kind"] {
  const lower = path.toLowerCase();
  if (hasExtension(lower, STYLE_EXTENSIONS)) return "style";
  if (CONFIG_PATTERNS.some((p) => p.test(path))) return "config";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "ts_tsx";
  return "other";
}

function deriveModule(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return path;
  if (parts[0] === "app" && parts[1] === "api" && parts.length >= 3) {
    return parts.slice(0, 3).join("/");
  }
  if (parts.length >= 2) {
    return parts.slice(0, 2).join("/");
  }
  return parts[0];
}

function collectHints(path: string, diff?: ParsedFileDiff): Set<string> {
  const hints = new Set<string>();
  if (!diff) {
    return hints;
  }

  const lines = [...diff.added, ...diff.removed];
  for (const line of lines) {
    for (const hook of STATE_HOOKS) {
      if (line.includes(hook)) {
        hints.add(hook);
      }
    }
    for (const keyword of DATA_KEYWORDS) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        hints.add(keyword);
      }
    }
    for (const keyword of ACCESSIBILITY_KEYWORDS) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        hints.add(keyword.replace(/=.*$/, ""));
      }
    }
    for (const keyword of TEST_KEYWORDS) {
      if (line.includes(keyword)) {
        hints.add("test");
      }
    }
    if (line.includes("className") || line.includes("class=")) {
      hints.add("className");
    }
    if (line.includes("style=")) {
      hints.add("style");
    }
    if (line.includes("props")) {
      hints.add("props");
    }
    if (line.includes("children")) {
      hints.add("children");
    }
  }

  if (path.startsWith("app/api") || path.startsWith("lib/")) {
    hints.add("module:data");
  }
  if (path.includes("test") || path.includes("__tests__")) {
    hints.add("module:test");
  }
  if (CONFIG_PATTERNS.some((p) => p.test(path))) {
    hints.add("module:config");
  }

  return hints;
}

function touchesOnlyStyling(diff: ParsedFileDiff | undefined): boolean {
  if (!diff) return false;
  const relevant = [...diff.added, ...diff.removed];
  if (relevant.length === 0) return false;
  return relevant.every((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const lowered = trimmed.toLowerCase();
    if (lowered.startsWith("import")) return false;
    if (/[=]>/u.test(trimmed)) return false;
    if (/(function|const|let|return|if|else|switch|case|for|while)\b/.test(trimmed)) {
      return false;
    }
    if (lowered.includes("class") || lowered.includes("style")) {
      return true;
    }
    return false;
  });
}

function detectHighLeverageSignals(
  skillTags: SkillTag[],
  hints: Set<string>,
  diff: ParsedFileDiff | undefined
): string[] {
  const signals: string[] = [];
  if (skillTags.includes("状态/副作用")) {
    signals.push("涉及状态或副作用调整");
  }
  if (skillTags.includes("数据/接口/RTC")) {
    signals.push("涉及数据/接口/RTC 调用");
  }
  if (skillTags.includes("可访问性")) {
    signals.push("可访问性优化");
  }
  if (skillTags.includes("测试")) {
    signals.push("补充测试覆盖");
  }
  if (skillTags.includes("工程化/配置")) {
    signals.push("工程化/配置提升");
  }
  if (
    diff?.added.some((line) => /\b(export\s+)?(async\s+)?function\b/.test(line)) ||
    diff?.added.some((line) => /\bconst\s+\w+\s*=\s*(async\s*)?\(.*\)\s*=>/.test(line))
  ) {
    signals.push("新增函数/组件实现");
  }
  if (diff?.added.some((line) => /\buse(Form|Mutation|Query|Context|Memo|Callback)/.test(line))) {
    signals.push("引入新的 Hook");
  }
  if (diff?.added.some((line) => /\b(fetch|axios|client|socket|subscribe)\b/.test(line))) {
    signals.push("新增数据/接口调用");
  }
  if (diff?.added.some((line) => /\bperformance|memo|cache|debounce|throttle\b/i.test(line))) {
    signals.push("性能相关优化");
  }
  return signals;
}

function detectLowLeverageSignals(
  kind: FileChange["kind"],
  skillTags: SkillTag[],
  diff: ParsedFileDiff | undefined,
  adds: number,
  dels: number
): string[] {
  const signals: string[] = [];
  if (kind === "style" || touchesOnlyStyling(diff)) {
    signals.push("仅样式或排版调整");
  }
  if (skillTags.length === 1 && skillTags[0] === "UI样式" && adds + dels < 40) {
    signals.push("UI 样式微调");
  }
  if (adds + dels <= 10) {
    signals.push("改动规模极小");
  }
  return signals;
}

function detectLeverage(
  kind: FileChange["kind"],
  skillTags: SkillTag[],
  hints: Set<string>,
  diff: ParsedFileDiff | undefined,
  adds: number,
  dels: number
): { level: LeverageLevel; signals: string[] } {
  const highSignals = detectHighLeverageSignals(skillTags, hints, diff);
  if (highSignals.length > 0) {
    return { level: "high", signals: highSignals };
  }
  const lowSignals = detectLowLeverageSignals(kind, skillTags, diff, adds, dels);
  if (lowSignals.length > 0) {
    return { level: "low", signals: lowSignals };
  }
  return { level: "neutral", signals: [] };
}

function detectSkillTags(
  path: string,
  kind: FileChange["kind"],
  hints: Set<string>,
  diff?: ParsedFileDiff
): SkillTag[] {
  const tags = new Set<SkillTag>();
  if (kind === "style" || hints.has("className") || hints.has("style")) {
    tags.add("UI样式");
  }

  if (kind === "ts_tsx" && touchesOnlyStyling(diff)) {
    tags.add("UI样式");
  }

  if (kind === "ts_tsx") {
    const modulePrefix = path.split("/")[0];
    const hasComponentSignals =
      hints.has("props") ||
      hints.has("children") ||
      diff?.added.some((line) => /<\w+/.test(line)) ||
      diff?.removed.some((line) => /<\w+/.test(line));

    if (hasComponentSignals || modulePrefix === "components" || modulePrefix === "app") {
      tags.add("React组件改造");
    }
  }

  if ([...hints].some((hint) => STATE_HOOKS.includes(hint))) {
    tags.add("状态/副作用");
  }

  if (
    [...hints].some((hint) => DATA_KEYWORDS.some((kw) => hint.toLowerCase().includes(kw.toLowerCase()))) ||
    hints.has("module:data")
  ) {
    tags.add("数据/接口/RTC");
  }

  if ([...hints].some((hint) => hint.startsWith("aria") || hint === "alt=")) {
    tags.add("可访问性");
  }

  if (hints.has("test") || hints.has("module:test")) {
    tags.add("测试");
  }

  if (kind === "config" || hints.has("module:config")) {
    tags.add("工程化/配置");
  }

  return Array.from(tags);
}

export function buildFileChange(
  path: string,
  adds: number,
  dels: number,
  diff?: ParsedFileDiff
): FileChange | null {
  if (shouldIgnorePath(path)) {
    return null;
  }

  const kind = detectKind(path);
  const hints = collectHints(path, diff);
  const module = deriveModule(path);
  const skillTags = detectSkillTags(path, kind, hints, diff);
  const leverageInfo = detectLeverage(kind, skillTags, hints, diff, adds, dels);

  return {
    path,
    adds,
    dels,
    kind,
    hints: Array.from(hints).filter((hint) => !hint.startsWith("module:")),
    module,
    skillTags,
    leverage: leverageInfo.level,
    leverageSignals: leverageInfo.signals,
  };
}
