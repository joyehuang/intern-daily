export interface ParsedFileDiff {
  path: string;
  added: string[];
  removed: string[];
}

const DIFF_HEADER = /^diff --git a\/(.+) b\/(.+)$/;

export function parseUnifiedDiff(diff: string): ParsedFileDiff[] {
  const results: ParsedFileDiff[] = [];
  const lines = diff.split(/\r?\n/);
  let current: ParsedFileDiff | null = null;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const match = line.match(DIFF_HEADER);
      if (match) {
        const next: ParsedFileDiff = { path: match[2], added: [], removed: [] };
        current = next;
        results.push(next);
      } else {
        current = null;
      }
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim();
      if (!path.startsWith("/dev/null")) {
        current.path = path.startsWith("b/") ? path.slice(2) : path;
      }
      continue;
    }

    if (line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("@@")) {
      continue;
    }

    if (line.startsWith("+")) {
      current.added.push(line.slice(1));
      continue;
    }

    if (line.startsWith("-")) {
      current.removed.push(line.slice(1));
    }
  }

  return results;
}
