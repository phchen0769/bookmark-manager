import type { AiConfig } from "./types"

const STORAGE_KEY = "aiConfig"

/** 默认 AI 配置（用户可覆盖） */
const DEFAULT_CONFIG: AiConfig = {
  baseUrl: "http://10.178.34.133:8317",
  model: "deepseek-v4-pro",
  apiKey: "",
}

/** 读取保存的 AI 配置，若不存在则返回默认值 */
export async function getAiConfig(): Promise<AiConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY)
  const config = stored[STORAGE_KEY] as AiConfig | undefined
  return { ...DEFAULT_CONFIG, ...config }
}

/** 保存 AI 配置 */
export async function saveAiConfig(config: AiConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config })
}
