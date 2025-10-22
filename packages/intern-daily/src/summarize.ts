import { AiConfig, SummarizeInput } from "./types";

export const SYSTEM_PROMPT = `你是“前端实习日报生成助手”。输入是某自然日的 Git 提交统计与经脱敏证据。
作者：Joye（墨尔本大学二年级，前端/全栈），当前在做 AI 销售训练/模拟通话相关的前端工作。
技术栈语境：Next.js 15/React 19、TypeScript、Tailwind + shadcn/ui、RTC/ASR/TTS、报告页等。

输出一份给技术主管看的 Markdown 日报，结构必须包含：
【今日总体概览】【关键改动摘要（按模块）】【详细提交（仅列 SHA7+主题）】【次日计划（占位）】。
要求：
- 简洁、具体、基于证据；不要堆叠空话。
- 模块按路径前缀聚合（如 app/rtc-call、components/rtc、lib/rtc）。
- 引用技能标签统计（UI样式/React组件改造/状态副作用/数据接口/可访问性/测试/工程化等）。
- 结合 leverage 字段识别高杠杆 vs 疑似低杠杆任务，并针对低杠杆部分给出可操作的提升建议。
- 严禁输出源码、密钥、URL；出现敏感串以“•••”处理。
- 如果当天是以 UI 样式为主，也要给出“如何提升杠杆”的建议（如抽象通用组件、补 a11y、补测试）。`;

export async function aiSummarize(input: SummarizeInput, cfg: AiConfig): Promise<string> {
  if (!cfg.enabled) {
    throw new Error("AI 功能已禁用");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未找到 OPENAI_API_KEY，无法调用 OpenAI");
  }
  const model = cfg.model || process.env.INTERN_DAILY_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 未返回内容");
  }
  return content.trim();
}
