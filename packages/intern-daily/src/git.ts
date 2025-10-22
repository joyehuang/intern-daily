import { execFile } from "child_process";
import { promisify } from "util";
import { Commit } from "./types";

const execFileAsync = promisify(execFile);

export interface GitFileStat {
  path: string;
  adds: number;
  dels: number;
  status?: string;
}

export async function ensureRepo(repoPath: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoPath,
    });
    if (stdout.trim() !== "true") {
      throw new Error();
    }
  } catch (err) {
    throw new Error(`路径 ${repoPath} 不是有效的 Git 仓库`);
  }
}

export async function runGit(
  repoPath: string,
  args: string[],
  verbose = false
): Promise<string> {
  if (verbose) {
    console.error(`[git] git ${args.join(" ")}`);
  }
  const { stdout } = await execFileAsync("git", args, { cwd: repoPath });
  return stdout;
}

export async function getCommits(
  repoPath: string,
  since: string,
  until: string,
  maxCommits: number
): Promise<Commit[]> {
  const args = [
    "log",
    `--since=${since}`,
    `--until=${until}`,
    "--pretty=%H%x09%ad%x09%s",
    "--date=iso-local",
  ];
  if (maxCommits > 0) {
    args.push(`--max-count=${maxCommits}`);
  }
  const stdout = await runGit(repoPath, args);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, date, subject] = line.split("\t");
      return {
        sha,
        sha7: sha.slice(0, 7),
        date,
        subject: subject || "(no subject)",
      } satisfies Commit;
    });
}

export async function getCommitFileStats(
  repoPath: string,
  sha: string
): Promise<GitFileStat[]> {
  const stdout = await runGit(repoPath, [
    "diff-tree",
    "--no-commit-id",
    "--numstat",
    "-r",
    "-M",
    sha,
  ]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 3) {
        return null;
      }
      const adds = parts[0] === "-" ? 0 : Number(parts[0]);
      const dels = parts[1] === "-" ? 0 : Number(parts[1]);
      const path = parts[parts.length - 1];
      return { path, adds: Number.isNaN(adds) ? 0 : adds, dels: Number.isNaN(dels) ? 0 : dels };
    })
    .filter((stat): stat is GitFileStat => Boolean(stat));
}

export async function getCommitDiff(repoPath: string, sha: string): Promise<string> {
  return runGit(repoPath, ["show", "--unified=0", sha]);
}

export async function getUnstagedCount(repoPath: string): Promise<number> {
  const stdout = await runGit(repoPath, ["status", "--porcelain"], false);
  if (!stdout.trim()) {
    return 0;
  }
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  return lines.length;
}
