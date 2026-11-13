import type {
  AiConfig,
  ClassificationResult,
  ClassifyProgress,
  FlatBookmark,
} from "./types"
import { chat } from "./aiClient"

/**
 * 自动分类逻辑：把书签分批发给 AI，让它为每个书签建议一个文件夹分类和若干标签，
 * 然后把分类应用到 Chrome 书签树（创建/复用文件夹并移动书签）。
 */

const SYSTEM_PROMPT = `你是一个书签整理助手。用户会给你一批书签（含标题和 URL），你需要为每个书签：
1. 判断它最合适的分类文件夹（用简洁的中文，如「开发工具」「新闻资讯」「购物」「视频」「学习」等）
2. 给它打 1-3 个标签

严格按照 JSON 数组返回，不要输出任何其他文字。每个元素格式：
{"id": "<书签id>", "category": "<分类文件夹名>", "tags": ["<标签1>", "<标签2>"]}`

/** 从 AI 文本输出中稳健地解析 JSON 数组 */
function parseResult(text: string): ClassificationResult[] {
  // 尝试直接解析
  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr)) return arr
  } catch {
    // ignore
  }

  // 尝试提取 ```json ... ``` 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      const arr = JSON.parse(fence[1])
      if (Array.isArray(arr)) return arr
    } catch {
      // ignore
    }
  }

  // 尝试提取第一个 [ ... ] 片段
  const bracket = text.match(/\[[\s\S]*\]/)
  if (bracket) {
    try {
      const arr = JSON.parse(bracket[0])
      if (Array.isArray(arr)) return arr
    } catch {
      // ignore
    }
  }

  throw new Error("无法解析 AI 返回的分类结果")
}

/** 对书签进行自动分类 */
export async function classifyBookmarks(
  bookmarks: FlatBookmark[],
  config: AiConfig,
  onProgress?: (p: ClassifyProgress) => void
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []
  // 每批 20 个，避免单次请求过大
  const BATCH = 20

  for (let i = 0; i < bookmarks.length; i += BATCH) {
    const batch = bookmarks.slice(i, i + BATCH)
    const payload = batch.map((b) => ({
      id: b.id,
      title: b.title || "(无标题)",
      url: b.url ?? "",
    }))

    const text = await chat(
      config,
      JSON.stringify(payload, null, 2),
      SYSTEM_PROMPT
    )

    const parsed = parseResult(text)

    // 用 id 对齐回原书签，容错
    for (const item of parsed) {
      if (item && typeof item.id === "string" && item.category) {
        results.push({
          id: item.id,
          category: item.category,
          tags: Array.isArray(item.tags) ? item.tags : [],
        })
      }
    }

    onProgress?.({ done: Math.min(i + BATCH, bookmarks.length), total: bookmarks.length, phase: "classifying" })
  }

  return results
}

/**
 * 把分类结果应用到 Chrome 书签树：
 * 为每个分类创建（或复用）「自动分类/<category>」文件夹，把书签移进去。
 */
export async function applyClassification(
  results: ClassificationResult[],
  onProgress?: (p: ClassifyProgress) => void
): Promise<void> {
  const ROOT = "自动分类"
  const total = results.length
  let done = 0

  // 缓存已创建/查到的文件夹 id
  const folderCache = new Map<string, string>()

  // 确保根文件夹存在（在书签栏下）
  const rootId = await ensureFolder(ROOT, "1", folderCache)

  for (const r of results) {
    try {
      const folderId = await ensureFolder(r.category, rootId, folderCache)
      await chrome.bookmarks.move(r.id, { parentId: folderId })
    } catch (e) {
      // 单个失败不阻断整体，继续处理下一个
      console.warn("移动书签失败:", r.id, e)
    }
    done++
    onProgress?.({ done, total, phase: "applying" })
  }
}

/** 在指定父文件夹下查找或创建文件夹，返回其 id */
async function ensureFolder(
  name: string,
  parentId: string,
  cache: Map<string, string>
): Promise<string> {
  const cacheKey = `${parentId}/${name}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const children = await chrome.bookmarks.getChildren(parentId)
  const existing = children.find((c) => !c.url && c.title === name)
  if (existing) {
    cache.set(cacheKey, existing.id)
    return existing.id
  }

  const created = await chrome.bookmarks.create({
    parentId,
    title: name,
  })
  cache.set(cacheKey, created.id)
  return created.id
}
