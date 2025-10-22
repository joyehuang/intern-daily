#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import { writeFileSafe } from "./fs";
import { generateDailyReport } from "./index";
import { GenerateOptions } from "./types";
import { initConfigInteractive, configExists } from "./config";
import { spawn } from "child_process";
import path from "path";
import pkg from "../package.json";

loadEnv();

function parseInteger(value: string, defaultValue: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function mapOptions(cmd: Record<string, any>): GenerateOptions {
  return {
    repo: cmd.repo ?? ".",
    date: cmd.date,
    since: cmd.since,
    until: cmd.until,
    tz: cmd.tz,
    output: cmd.output,
    maxCommits: parseInteger(cmd.maxCommits ?? "200", 200),
    includeUnstaged: Boolean(cmd.includeUnstaged),
    noAi: cmd.ai === false,
    open: Boolean(cmd.open),
    verbose: Boolean(cmd.verbose),
  };
}

function openFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const absolute = path.resolve(filePath);
    const platform = process.platform;
    let command: string;
    let args: string[] = [];

    if (platform === "darwin") {
      command = "open";
      args = [absolute];
    } else if (platform === "win32") {
      command = "cmd";
      args = ["/c", "start", "", absolute];
    } else {
      command = "xdg-open";
      args = [absolute];
    }

    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", (err) => reject(err));
    child.on("exit", () => resolve());
  });
}

async function main() {
  const program = new Command();
  program.name("intern-daily").description("从 Git 提交生成当日日报的 CLI").version(pkg.version);

  // Init command
  program
    .command("init")
    .description("初始化配置文件")
    .option("--repo <path>", "目标仓库路径", ".")
    .action(async (cmd) => {
      const repoPath = path.resolve(cmd.repo as string);

      if (configExists(repoPath)) {
        console.error("⚠️  配置文件已存在。如需重新配置，请先删除 .intern-daily.config.json");
        process.exitCode = 1;
        return;
      }

      try {
        await initConfigInteractive(repoPath);
      } catch (err) {
        console.error(`❌ 初始化失败：${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // Gen command
  program
    .command("gen")
    .description("生成 Markdown 日报")
    .option("--repo <path>", "目标 Git 仓库路径", ".")
    .option("--date <YYYY-MM-DD>", "自然日，配合 --tz 使用")
    .option("--since <ISO>", "自定义起始时间（覆盖 --date）")
    .option("--until <ISO>", "自定义结束时间")
    .option("--tz <IANA_TZ>", "时区，默认 Australia/Sydney")
    .option("--output <path.md>", "输出文件路径")
    .option("--max-commits <n>", "单日最大提交数，默认 200")
    .option("--include-unstaged", "统计未暂存改动（不入提交列表）")
    .option("--no-ai", "仅使用规则摘要")
    .option("--open", "生成后使用系统编辑器打开")
    .option("-v, --verbose", "打印调试信息")
    .action(async (cmd) => {
      const options = mapOptions(cmd);
      try {
        const result = await generateDailyReport(options);
        await writeFileSafe(result.outputPath, result.markdown);
        console.log(`✅ 已生成日报：${result.outputPath}`);
        if (result.usedAi) {
          console.log("🤖 已使用 AI 总结");
        }
        if (result.note) {
          console.log(`ℹ️ ${result.note}`);
        }
        if (options.open) {
          try {
            await openFile(result.outputPath);
          } catch (err) {
            console.error(`⚠️ 无法自动打开文件：${(err as Error).message}`);
          }
        }
      } catch (err) {
        console.error(`❌ 生成失败：${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
