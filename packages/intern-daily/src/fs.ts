import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

export async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

export function resolveOutputPath(
  repoPath: string,
  dateLabel: string,
  explicit?: string
): string {
  if (explicit) {
    return resolve(explicit);
  }
  return join(repoPath, ".internlog", `daily-${dateLabel}.md`);
}

export async function writeFileSafe(path: string, content: string): Promise<void> {
  await ensureDirForFile(path);
  await writeFile(path, content, "utf8");
}
