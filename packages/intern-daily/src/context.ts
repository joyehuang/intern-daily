/**
 * Code context extraction module
 * Extracts code snippets with surrounding context lines from git diffs
 */

import { spawn } from "child_process";
import path from "path";

/**
 * File change with code context
 */
export interface FileChangeWithContext {
  filePath: string;
  changeType: "added" | "modified" | "deleted";
  language: string;
  changes: ChangeWithContext[];
}

/**
 * Individual change with context
 */
export interface ChangeWithContext {
  lineStart: number;
  lineEnd: number;
  additions: number;
  deletions: number;
  codeSnippet: string; // The changed lines
  contextBefore: string; // Lines before the change
  contextAfter: string; // Lines after the change
}

/**
 * Options for context extraction
 */
export interface ContextExtractionOptions {
  repoPath: string;
  commitSha: string;
  contextLines: number; // Number of lines before/after to include
}

/**
 * Detect programming language from file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".py": "python",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".zsh": "bash",
    ".fish": "fish",
    ".sql": "sql",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
  };

  return languageMap[ext] || "plaintext";
}

/**
 * Parse unified diff header to extract line numbers
 * Format: @@ -oldStart,oldCount +newStart,newCount @@
 */
function parseHunkHeader(
  header: string
): { oldStart: number; oldCount: number; newStart: number; newCount: number } | null {
  const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1], 10),
    oldCount: match[2] ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newCount: match[4] ? parseInt(match[4], 10) : 1,
  };
}

/**
 * Get file content at specific commit
 */
async function getFileContent(
  repoPath: string,
  commitSha: string,
  filePath: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = ["show", `${commitSha}:${filePath}`];
    const proc = spawn("git", args, { cwd: repoPath });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to get file content: ${stderr}`));
        return;
      }
      resolve(stdout.split("\n"));
    });
  });
}

/**
 * Extract context around changed lines
 */
function extractContext(
  lines: string[],
  startLine: number,
  endLine: number,
  contextLines: number
): {
  before: string;
  after: string;
} {
  const beforeStart = Math.max(0, startLine - contextLines - 1);
  const beforeEnd = startLine - 1;
  const afterStart = endLine;
  const afterEnd = Math.min(lines.length, endLine + contextLines);

  const before = lines.slice(beforeStart, beforeEnd).join("\n");
  const after = lines.slice(afterStart, afterEnd).join("\n");

  return { before, after };
}

/**
 * Parse git diff output with context extraction
 */
export async function extractCodeContext(
  options: ContextExtractionOptions
): Promise<FileChangeWithContext[]> {
  const { repoPath, commitSha, contextLines } = options;

  // Get diff for this commit
  const diff = await new Promise<string>((resolve, reject) => {
    const args = ["show", "--unified=0", "--no-color", commitSha];
    const proc = spawn("git", args, { cwd: repoPath });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to get diff: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });

  // Parse diff
  const lines = diff.split("\n");
  const files: FileChangeWithContext[] = [];
  let currentFile: FileChangeWithContext | null = null;
  let currentHunk: ChangeWithContext | null = null;
  let hunkLines: string[] = [];

  for (const line of lines) {
    // New file marker
    if (line.startsWith("diff --git")) {
      if (currentFile && currentHunk) {
        currentHunk.codeSnippet = hunkLines.join("\n");
        currentFile.changes.push(currentHunk);
      }
      currentFile = null;
      currentHunk = null;
      hunkLines = [];
      continue;
    }

    // File path marker
    if (line.startsWith("+++ b/")) {
      const filePath = line.substring(6);
      if (filePath === "/dev/null") continue; // Deleted file

      currentFile = {
        filePath,
        changeType: "modified",
        language: detectLanguage(filePath),
        changes: [],
      };
      files.push(currentFile);
      continue;
    }

    // Detect change type
    if (line.startsWith("new file mode")) {
      if (currentFile) currentFile.changeType = "added";
      continue;
    }

    if (line.startsWith("deleted file mode")) {
      if (currentFile) currentFile.changeType = "deleted";
      continue;
    }

    // Hunk header
    if (line.startsWith("@@")) {
      // Save previous hunk
      if (currentFile && currentHunk) {
        currentHunk.codeSnippet = hunkLines.join("\n");
        currentFile.changes.push(currentHunk);
      }

      const hunkInfo = parseHunkHeader(line);
      if (!hunkInfo || !currentFile) continue;

      currentHunk = {
        lineStart: hunkInfo.newStart,
        lineEnd: hunkInfo.newStart + hunkInfo.newCount - 1,
        additions: 0,
        deletions: 0,
        codeSnippet: "",
        contextBefore: "",
        contextAfter: "",
      };
      hunkLines = [];

      // Extract context (for modified files only)
      if (currentFile.changeType === "modified") {
        try {
          const fileLines = await getFileContent(repoPath, `${commitSha}^`, currentFile.filePath);
          const context = extractContext(
            fileLines,
            hunkInfo.oldStart,
            hunkInfo.oldStart + hunkInfo.oldCount,
            contextLines
          );
          currentHunk.contextBefore = context.before;
          currentHunk.contextAfter = context.after;
        } catch (error) {
          // File might be new or error getting content, skip context
          console.warn(`Failed to get context for ${currentFile.filePath}:`, error);
        }
      }

      continue;
    }

    // Changed lines
    if (currentHunk && (line.startsWith("+") || line.startsWith("-"))) {
      if (line.startsWith("+")) {
        currentHunk.additions++;
        hunkLines.push(line.substring(1)); // Remove '+' prefix
      } else if (line.startsWith("-")) {
        currentHunk.deletions++;
      }
    }
  }

  // Save last hunk
  if (currentFile && currentHunk) {
    currentHunk.codeSnippet = hunkLines.join("\n");
    currentFile.changes.push(currentHunk);
  }

  return files;
}

/**
 * Extract context for multiple commits
 */
export async function extractContextForCommits(
  repoPath: string,
  commitShas: string[],
  contextLines: number
): Promise<Map<string, FileChangeWithContext[]>> {
  const results = new Map<string, FileChangeWithContext[]>();

  for (const sha of commitShas) {
    try {
      const contexts = await extractCodeContext({
        repoPath,
        commitSha: sha,
        contextLines,
      });
      results.set(sha, contexts);
    } catch (error) {
      console.error(`Failed to extract context for commit ${sha}:`, error);
      results.set(sha, []);
    }
  }

  return results;
}
