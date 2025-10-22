/**
 * AI module - OpenAI integration for content value assessment and report summarization
 */

import { UserProfile } from "./db";
import { getOpenAIKey } from "./config";

/**
 * Content value assessment result
 */
export interface ContentValueAssessment {
  level: "high" | "medium" | "low";
  reason: string; // Short reason (50 chars)
  assessment: string; // Detailed assessment (100-200 chars)
}

/**
 * Daily context for AI analysis
 */
export interface DailyContext {
  date: string;
  skillTags: string[];
  modules: string[];
  commitCount: number;
  fileCount: number;
  lineAdditions: number;
  lineDeletions: number;
  commits: Array<{ sha: string; subject: string }>;
  codeHighlights: string[]; // Key code snippets or keywords
}

/**
 * Historical context for comparison
 */
export interface HistoricalContext {
  date: string;
  skillTags: string[];
  modules: string[];
  contentValueLevel?: string;
  highlights?: string[];
}

/**
 * Weekly aggregated data
 */
export interface WeeklyData {
  dateStart: string;
  dateEnd: string;
  totalCommits: number;
  totalFiles: number;
  skillDistribution: Record<string, number>;
  contentValueDistribution: Record<string, number>;
  topModules: string[];
  dailyHighlights: string[][];
}

/**
 * Build system prompt for content value assessment
 */
function buildContentValuePrompt(
  userProfile: UserProfile,
  todayContext: DailyContext,
  historyDays: HistoricalContext[]
): string {
  const userInfo = `
姓名：${userProfile.name || "N/A"}
学校：${userProfile.school || "N/A"}
专业：${userProfile.major || "N/A"}
年级：${userProfile.year || "N/A"}
职位：${userProfile.position || "N/A"}
公司：${userProfile.company || "N/A"}
实习开始日期：${userProfile.intern_start_date || "N/A"}
职业目标：${userProfile.career_goals || "全栈开发"}
学习重点：${userProfile.learning_focus?.join("、") || "无"}
技术栈：${userProfile.tech_stack?.join("、") || "无"}
`.trim();

  const historyContext =
    historyDays.length > 0
      ? historyDays
          .map(
            (day) =>
              `- ${day.date}: ${day.skillTags.join(", ")} | ${day.modules.join(", ")} | 含金量: ${day.contentValueLevel || "unknown"}`
          )
          .join("\n")
      : "无历史记录";

  return `你是一位客观的技术导师，帮助实习生评估今日工作的含金量。

## 用户背景
${userInfo}

## 历史任务（过去 14 天摘要）
${historyContext}

## 今日任务详情
- 日期：${todayContext.date}
- 技能标签：${todayContext.skillTags.join("、")}
- 模块：${todayContext.modules.join("、")}
- 提交数：${todayContext.commitCount}
- 文件数：${todayContext.fileCount}
- 代码变更：+${todayContext.lineAdditions} -${todayContext.lineDeletions}
- 提交主题：${todayContext.commits.map((c) => c.subject).join("; ")}
- 代码亮点：${todayContext.codeHighlights.join("; ")}

请客观评估今日工作的含金量，输出 JSON（无其他文字）：
{
  "level": "high" | "medium" | "low",
  "reason": "具体原因（50字内）",
  "assessment": "详细分析（100-200字）"
}

评估维度：
1. **技术新颖性**：是否接触新技术/概念？
2. **技能深化**：是否在已有技能上有深度提升？
3. **重复性**：与过去 2 周是否高度重复？
4. **技术深度**：是否涉及跨层次改动（状态+接口+UI）？架构级思考？
5. **职业发展**：是否符合用户的学习重点和职业目标？

注意：
- 必须客观，基于证据
- 如果是第一次接触某类任务，应评为 high
- 如果连续多天做相同类型任务，应逐渐降低评级
- 如果只是样式调整/小修小补，通常为 low 或 medium
- 输出必须是纯 JSON，不要包含任何其他文字`;
}

/**
 * Build prompt for daily report summarization
 */
function buildDailyReportPrompt(
  userProfile: UserProfile,
  todayContext: DailyContext,
  contentValue: ContentValueAssessment,
  codeContexts: Array<{
    filePath: string;
    language: string;
    snippet: string;
  }>
): string {
  const userInfo = `${userProfile.name}（${userProfile.school || ""}${userProfile.major || ""}${userProfile.year ? ` ${userProfile.year}年级` : ""}），当前在${userProfile.company || "某公司"}担任${userProfile.position}`;

  return `你是一位专业的技术导师，帮助实习生撰写给技术主管看的日报。

## 用户信息
${userInfo}
技术栈：${userProfile.tech_stack?.join("、") || "无"}
职业目标：${userProfile.career_goals || "全栈开发"}

## 今日工作概况
- 日期：${todayContext.date}
- 提交数：${todayContext.commitCount}
- 文件数：${todayContext.fileCount}
- 技能标签：${todayContext.skillTags.join("、")}
- 模块：${todayContext.modules.join("、")}
- 含金量评估：**${contentValue.level}** - ${contentValue.reason}

## 含金量详细分析
${contentValue.assessment}

## 代码改动示例
${codeContexts.map((ctx) => `**${ctx.filePath}** (${ctx.language}):\n\`\`\`${ctx.language}\n${ctx.snippet}\n\`\`\``).join("\n\n")}

请生成一份专业的日报 Markdown 文档，结构如下：

# 日报 · ${todayContext.date}

## 📊 今日概览
- 提交数：X 个
- 影响文件：Y 个
- 核心技能：[列举]
- **含金量**：${contentValue.level === "high" ? "高 ✅" : contentValue.level === "medium" ? "中 ⚠️" : "低 ❌"} - ${contentValue.reason}

## 💡 工作亮点
[用 2-3 句话总结今天的核心工作成果，要具体、有技术深度]

## 📦 按模块分组
[按模块列举主要改动，每个模块 1-2 条要点，引用具体的提交或代码改动]

## 🎯 含金量分析
[结合含金量评估，说明：
- 如果是 high：强调技术价值和学习收获
- 如果是 medium：说明进步空间
- 如果是 low：客观指出重复性，并给出提升建议（如主动提出重构、补测试、学习新技术）]

## 📚 学习与反思
[列举今天学到的新东西，或技能深化的点]

## 🔗 提交记录
${todayContext.commits.map((c) => `- [\`${c.sha.substring(0, 7)}\`] ${c.subject}`).join("\n")}

---

要求：
- 简洁、具体、基于证据
- 不要空话套话
- 引用具体的代码改动
- 如果含金量低，要客观指出并给建设性建议
- 使用中文，专业且友好的语气`;
}

/**
 * Build prompt for weekly report summarization
 */
function buildWeeklyReportPrompt(
  userProfile: UserProfile,
  weeklyData: WeeklyData,
  dailySummaries: string[]
): string {
  return `你是一位职业发展顾问，帮助实习生回顾一周的技术成长。

## 用户信息
${userProfile.name}（${userProfile.position}）
职业目标：${userProfile.career_goals || "全栈开发"}
学习重点：${userProfile.learning_focus?.join("、") || "无"}

## 本周数据
- 时间范围：${weeklyData.dateStart} 至 ${weeklyData.dateEnd}
- 总提交数：${weeklyData.totalCommits}
- 总文件数：${weeklyData.totalFiles}
- 技能分布：${Object.entries(weeklyData.skillDistribution)
    .map(([skill, count]) => `${skill}(${count}天)`)
    .join("、")}
- 含金量分布：高=${weeklyData.contentValueDistribution.high || 0}天 | 中=${weeklyData.contentValueDistribution.medium || 0}天 | 低=${weeklyData.contentValueDistribution.low || 0}天
- 主要模块：${weeklyData.topModules.join("、")}

## 每日亮点摘要
${dailySummaries.map((summary, i) => `**Day ${i + 1}**:\n${summary}`).join("\n\n")}

请生成一份专业的周报 Markdown 文档，结构如下：

# 周报 · ${weeklyData.dateStart} - ${weeklyData.dateEnd}

## 📊 本周概览
[总结本周的整体工作量和技能分布]

## 🚀 技术成长轨迹
[分析本周的技能演进，是否有新技术接触？是否有技能深化？]

## 🎯 本周亮点 TOP 3
[从每日亮点中提炼最有价值的 3 条，用 STAR 法则描述]

## ⚠️ 含金量趋势分析
[分析本周的含金量分布：
- 如果高含金量任务多：鼓励继续保持
- 如果低含金量任务多：指出重复性工作过多，给出提升建议]

## 📈 可视化数据
\`\`\`mermaid
pie title 技能分布
${Object.entries(weeklyData.skillDistribution)
  .map(([skill, count]) => `    "${skill}" : ${count}`)
  .join("\n")}
\`\`\`

## 📚 学习建议
[基于本周的技能短板和用户的学习重点，给出下周的学习建议]

## 🎯 下周发展方向
[结合职业目标，给出 3 条具体的行动建议]

---

要求：
- 从"成长"角度撰写，而非单纯的工作记录
- 对比本周与上周的变化（如果有历史数据）
- 客观指出不足，给出可操作的改进建议
- 使用图表增强可读性`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  return content.trim();
}

/**
 * Assess content value using AI
 */
export async function assessContentValue(
  userProfile: UserProfile,
  todayContext: DailyContext,
  historyDays: HistoricalContext[]
): Promise<ContentValueAssessment> {
  const prompt = buildContentValuePrompt(userProfile, todayContext, historyDays);

  const responseText = await callOpenAI(
    [
      {
        role: "system",
        content: "你是一位客观的技术导师。请严格按照 JSON 格式输出，不要包含任何其他文字。",
      },
      { role: "user", content: prompt },
    ],
    "gpt-4o-mini"
  );

  // Parse JSON response
  try {
    // Extract JSON from markdown code block if present
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText) as ContentValueAssessment;

    // Validate
    if (!["high", "medium", "low"].includes(parsed.level)) {
      throw new Error(`Invalid level: ${parsed.level}`);
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse AI response:", responseText);
    throw new Error(`Failed to parse content value assessment: ${(error as Error).message}`);
  }
}

/**
 * Generate daily report using AI
 */
export async function generateDailyReport(
  userProfile: UserProfile,
  todayContext: DailyContext,
  contentValue: ContentValueAssessment,
  codeContexts: Array<{ filePath: string; language: string; snippet: string }>
): Promise<string> {
  const prompt = buildDailyReportPrompt(userProfile, todayContext, contentValue, codeContexts);

  const markdown = await callOpenAI(
    [
      {
        role: "system",
        content: "你是一位专业的技术导师，擅长撰写技术日报。请直接输出 Markdown 格式的日报。",
      },
      { role: "user", content: prompt },
    ],
    "gpt-4o-mini"
  );

  return markdown;
}

/**
 * Generate weekly report using AI
 */
export async function generateWeeklyReport(
  userProfile: UserProfile,
  weeklyData: WeeklyData,
  dailySummaries: string[]
): Promise<string> {
  const prompt = buildWeeklyReportPrompt(userProfile, weeklyData, dailySummaries);

  const markdown = await callOpenAI(
    [
      {
        role: "system",
        content: "你是一位职业发展顾问，擅长撰写技术周报。请直接输出 Markdown 格式的周报。",
      },
      { role: "user", content: prompt },
    ],
    "gpt-4"
  );

  return markdown;
}
