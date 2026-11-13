import type { AiConfig } from "./types"

/**
 * Anthropic 兼容的 AI 客户端。
 * 调用 POST {baseUrl}/v1/messages，符合 Anthropic Messages API 格式。
 */

interface MessagesResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

/** 发送一次消息，返回模型文本输出 */
export async function chat(
  config: AiConfig,
  userMessage: string,
  systemPrompt?: string
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/v1/messages`

  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Anthropic 兼容接口的标准版本头
    "anthropic-version": "2023-06-01",
  }
  if (config.apiKey) {
    headers["x-api-key"] = config.apiKey
  }

  const body = {
    model: config.model,
    max_tokens: 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: userMessage }],
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(`AI 请求失败 (${resp.status}): ${text.slice(0, 300)}`)
  }

  const data = (await resp.json()) as MessagesResponse
  if (data.error?.message) {
    throw new Error(`AI 返回错误: ${data.error.message}`)
  }

  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim()

  if (!text) {
    throw new Error("AI 返回了空内容")
  }

  return text
}
