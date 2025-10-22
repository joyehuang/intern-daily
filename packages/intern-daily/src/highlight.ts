/**
 * Syntax highlighting module using Shiki
 */

import { createHighlighter, Highlighter } from "shiki";

/**
 * Singleton highlighter instance
 */
let highlighterInstance: Highlighter | null = null;

/**
 * Initialize or get existing highlighter
 */
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterInstance) {
    highlighterInstance = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "typescript",
        "javascript",
        "tsx",
        "jsx",
        "python",
        "java",
        "go",
        "rust",
        "c",
        "cpp",
        "csharp",
        "ruby",
        "php",
        "swift",
        "kotlin",
        "scala",
        "bash",
        "sql",
        "markdown",
        "json",
        "yaml",
        "xml",
        "html",
        "css",
        "scss",
      ],
    });
  }
  return highlighterInstance;
}

/**
 * Map language names to Shiki-supported language identifiers
 */
function mapLanguage(lang: string): string {
  const langMap: Record<string, string> = {
    ts: "typescript",
    js: "javascript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    fish: "bash",
    yml: "yaml",
    plaintext: "text",
  };

  return langMap[lang.toLowerCase()] || lang.toLowerCase();
}

/**
 * Generate syntax-highlighted markdown code block
 * Returns markdown with ```language fenced code block (no HTML)
 */
export async function highlightCode(code: string, language: string): Promise<string> {
  if (!code.trim()) {
    return "";
  }

  // For markdown output, just return fenced code block
  // Shiki's HTML output is not suitable for markdown files
  const lang = mapLanguage(language);

  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/**
 * Generate HTML-highlighted code (for web dashboard in future)
 */
export async function highlightCodeToHTML(
  code: string,
  language: string,
  theme: "github-dark" | "github-light" = "github-dark"
): Promise<string> {
  if (!code.trim()) {
    return "";
  }

  const highlighter = await getHighlighter();
  const lang = mapLanguage(language);

  try {
    const html = highlighter.codeToHtml(code, {
      lang,
      theme,
    });
    return html;
  } catch (error) {
    console.warn(`Failed to highlight ${lang}, falling back to plaintext:`, error);
    return highlighter.codeToHtml(code, {
      lang: "text",
      theme,
    });
  }
}

/**
 * Highlight code with context for daily report
 * Returns formatted markdown with before/change/after sections
 */
export async function highlightWithContext(
  contextBefore: string,
  codeSnippet: string,
  contextAfter: string,
  language: string
): Promise<string> {
  const parts: string[] = [];

  if (contextBefore.trim()) {
    parts.push("```" + mapLanguage(language));
    parts.push("// ... context before");
    parts.push(contextBefore);
    parts.push("```");
    parts.push("");
  }

  if (codeSnippet.trim()) {
    parts.push("```" + mapLanguage(language));
    parts.push("// Changed lines:");
    parts.push(codeSnippet);
    parts.push("```");
    parts.push("");
  }

  if (contextAfter.trim()) {
    parts.push("```" + mapLanguage(language));
    parts.push("// ... context after");
    parts.push(contextAfter);
    parts.push("```");
  }

  return parts.join("\n");
}

/**
 * Generate diff-style highlighted code (with +/- prefixes)
 */
export async function highlightDiff(
  additions: string[],
  deletions: string[],
  language: string
): Promise<string> {
  const lang = mapLanguage(language);
  const lines: string[] = [];

  if (deletions.length > 0) {
    deletions.forEach((line) => {
      lines.push(`- ${line}`);
    });
  }

  if (additions.length > 0) {
    additions.forEach((line) => {
      lines.push(`+ ${line}`);
    });
  }

  return `\`\`\`${lang}\n${lines.join("\n")}\n\`\`\``;
}

/**
 * Cleanup highlighter resources
 */
export function disposeHighlighter(): void {
  if (highlighterInstance) {
    // Shiki highlighter doesn't have explicit dispose method
    // Just clear the reference for garbage collection
    highlighterInstance = null;
  }
}
