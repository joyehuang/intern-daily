/**
 * Configuration management module
 */

import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import inquirer from "inquirer";

/**
 * User configuration interface
 */
export interface UserConfig {
  user: {
    name: string;
    school?: string;
    major?: string;
    year?: number;
    position: string;
    company?: string;
    internStartDate?: string;
    careerGoals?: string;
    learningFocus?: string[];
  };
  techStack: string[];
  timezone: string;
  openai: {
    dailyModel: string;
    weeklyModel: string;
    baseURL?: string;
  };
  codeContext: {
    contextLines: number;
    enableSyntaxHighlight: boolean;
  };
  export: {
    pdf: boolean;
    email?: string;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: UserConfig = {
  user: {
    name: "",
    position: "",
  },
  techStack: [],
  timezone: "Australia/Sydney",
  openai: {
    dailyModel: "gpt-4o-mini",
    weeklyModel: "gpt-4",
  },
  codeContext: {
    contextLines: 10,
    enableSyntaxHighlight: true,
  },
  export: {
    pdf: false,
  },
};

/**
 * Configuration file name
 */
const CONFIG_FILE_NAME = ".intern-daily.config.json";

/**
 * Get configuration file path for a repository
 */
export function getConfigPath(repoPath: string): string {
  return path.join(repoPath, CONFIG_FILE_NAME);
}

/**
 * Load configuration from file
 */
export function loadConfig(configPath: string): UserConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Configuration file not found: ${configPath}\n` + `Please run "intern-daily init" first.`
    );
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as UserConfig;
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    throw new Error(`Failed to parse configuration file: ${(error as Error).message}`);
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(configPath: string, config: UserConfig): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Check if configuration file exists
 */
export function configExists(repoPath: string): boolean {
  return fs.existsSync(getConfigPath(repoPath));
}

/**
 * Get OpenAI API key from environment
 */
export function getOpenAIKey(): string | undefined {
  // Load .env from current directory
  loadEnv();

  return process.env.OPENAI_API_KEY;
}

/**
 * Validate configuration
 */
export function validateConfig(config: UserConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.user.name || config.user.name.trim() === "") {
    errors.push("User name is required");
  }

  if (!config.user.position || config.user.position.trim() === "") {
    errors.push("User position is required");
  }

  if (config.techStack.length === 0) {
    errors.push("At least one tech stack item is required");
  }

  if (config.codeContext.contextLines < 0) {
    errors.push("Context lines must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Interactive configuration initialization
 */
export async function initConfigInteractive(repoPath: string): Promise<UserConfig> {
  console.log("\n🚀 Welcome to intern-daily!\n");
  console.log("Let's set up your profile to personalize AI-generated reports.\n");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Your name:",
      validate: (input: string) => input.trim() !== "" || "Name is required",
    },
    {
      type: "input",
      name: "school",
      message: "Your school/university (optional):",
    },
    {
      type: "input",
      name: "major",
      message: "Your major (optional):",
    },
    {
      type: "number",
      name: "year",
      message: "Current year (e.g., 2 for sophomore, optional):",
    },
    {
      type: "input",
      name: "position",
      message: "Internship position (e.g., Frontend Intern):",
      validate: (input: string) => input.trim() !== "" || "Position is required",
    },
    {
      type: "input",
      name: "company",
      message: "Company name (optional):",
    },
    {
      type: "input",
      name: "internStartDate",
      message: "Internship start date (YYYY-MM-DD, optional):",
      validate: (input: string) => {
        if (!input) return true;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(input) || "Invalid date format. Use YYYY-MM-DD";
      },
    },
    {
      type: "input",
      name: "careerGoals",
      message: "Career goals (e.g., Full-stack developer, optional):",
    },
    {
      type: "input",
      name: "learningFocus",
      message: "Learning focus areas (comma-separated, e.g., Performance, Testing, optional):",
      filter: (input: string) =>
        input
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
    },
    {
      type: "input",
      name: "techStack",
      message: "Tech stack (comma-separated, e.g., React, TypeScript, Node.js):",
      validate: (input: string) =>
        input.trim() !== "" || "At least one tech stack item is required",
      filter: (input: string) =>
        input
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
    },
    {
      type: "list",
      name: "timezone",
      message: "Timezone:",
      choices: [
        "Australia/Sydney",
        "Asia/Shanghai",
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "UTC",
      ],
      default: "Australia/Sydney",
    },
    {
      type: "confirm",
      name: "exportPdf",
      message: "Enable PDF export? (requires markdown-pdf)",
      default: false,
    },
    {
      type: "input",
      name: "email",
      message: "Email for report delivery (optional):",
      validate: (input: string) => {
        if (!input) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || "Invalid email format";
      },
    },
  ]);

  const config: UserConfig = {
    user: {
      name: answers.name as string,
      school: (answers.school as string) || undefined,
      major: (answers.major as string) || undefined,
      year: (answers.year as number) || undefined,
      position: answers.position as string,
      company: (answers.company as string) || undefined,
      internStartDate: (answers.internStartDate as string) || undefined,
      careerGoals: (answers.careerGoals as string) || undefined,
      learningFocus: (answers.learningFocus as string[]).length
        ? (answers.learningFocus as string[])
        : undefined,
    },
    techStack: answers.techStack as string[],
    timezone: answers.timezone as string,
    openai: {
      dailyModel: "gpt-4o-mini",
      weeklyModel: "gpt-4",
    },
    codeContext: {
      contextLines: 10,
      enableSyntaxHighlight: true,
    },
    export: {
      pdf: answers.exportPdf as boolean,
      email: (answers.email as string) || undefined,
    },
  };

  // Save configuration
  const configPath = getConfigPath(repoPath);
  saveConfig(configPath, config);

  console.log(`\n✅ Configuration saved to: ${configPath}`);
  console.log("\n💡 Don't forget to set your OPENAI_API_KEY in .env file!");
  console.log('   Example: echo "OPENAI_API_KEY=sk-..." > .env\n');

  return config;
}

/**
 * Update specific configuration fields
 */
export function updateConfig(configPath: string, updates: Partial<UserConfig>): UserConfig {
  const currentConfig = loadConfig(configPath);
  const newConfig = { ...currentConfig, ...updates };
  saveConfig(configPath, newConfig);
  return newConfig;
}

/**
 * Get configuration or create default
 */
export function getOrCreateConfig(repoPath: string): UserConfig | null {
  const configPath = getConfigPath(repoPath);

  if (fs.existsSync(configPath)) {
    return loadConfig(configPath);
  }

  return null;
}
