import type { FlatBookmark, DuplicateGroup, DeadLinkResult, BookmarkStats } from "./types"

/**
 * chrome.bookmarks API 的封装层。
 * 所有函数都是异步的，返回扁平化的数据，UI 层不需要关心深层嵌套的书签树结构。
 */

/** 递归遍历书签树，把叶子节点（书签）扁平化，并记录从根到它的文件夹路径 */
function flatten(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[] = []
): FlatBookmark[] {
  const currentPath = node.url ? path : [...path, node.title]

  if (node.url) {
    return [
      {
        id: node.id,
        title: node.title,
        url: node.url,
        path,
        dateAdded: node.dateAdded,
      },
    ]
  }

  if (!node.children) return []

  return node.children.flatMap((child) => flatten(child, currentPath))
}

/** 获取所有书签（扁平化） */
export async function getAllBookmarks(): Promise<FlatBookmark[]> {
  const tree = await chrome.bookmarks.getTree()
  // getTree 返回的根节点是 "书签栏" 和 "其他书签"，把它们全部展开
  return tree.flatMap((root) => flatten(root))
}

/** 获取书签树原始结构（用于树形展示） */
export async function getTree() {
  return chrome.bookmarks.getTree()
}

/** 搜索书签（chrome 内置的 search，按标题和 URL 匹配） */
export async function searchBookmarks(
  query: string
): Promise<FlatBookmark[]> {
  const results = await chrome.bookmarks.search(query)
  // search 返回的节点可能是文件夹，需要展开并还原路径
  const flat: FlatBookmark[] = []
  for (const node of results) {
    const path = await getPathToNode(node.id)
    flat.push(...flatten(node, path))
  }
  return flat
}

/** 获取某个节点的父级路径 */
async function getPathToNode(id: string): Promise<string[]> {
  const path: string[] = []
  let current = (await chrome.bookmarks.get(id))[0]
  while (current && current.parentId) {
    const parent = (await chrome.bookmarks.get(current.parentId))[0]
    if (!parent) break
    // 根节点（id 为 0）和它的直接子节点（书签栏等）不加入路径，避免显示冗余
    if (parent.id === "0") break
    path.unshift(parent.title)
    current = parent
  }
  return path
}

/** 检测重复书签（按 URL 分组） */
export async function detectDuplicates(): Promise<DuplicateGroup[]> {
  const all = await getAllBookmarks()
  const byUrl = new Map<string, FlatBookmark[]>()

  for (const bm of all) {
    if (!bm.url) continue
    const key = bm.url
    const list = byUrl.get(key) ?? []
    list.push(bm)
    byUrl.set(key, list)
  }

  return [...byUrl.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([url, items]) => ({ url, items }))
}

/** 死链检测：并发请求 URL，判断是否失效（仅做 HEAD/GET 探测，可能有跨域限制） */
export async function detectDeadLinks(
  bookmarks: FlatBookmark[],
  onProgress?: (done: number, total: number) => void
): Promise<DeadLinkResult[]> {
  const results: DeadLinkResult[] = []
  const total = bookmarks.length
  let done = 0

  // 控制并发，避免浏览器限制
  const CONCURRENCY = 5
  const queue = [...bookmarks]

  async function worker() {
    while (queue.length > 0) {
      const bm = queue.shift()
      if (!bm || !bm.url) continue
      const res = await probeUrl(bm.url, bm.title)
      results.push(res)
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return results
}

async function probeUrl(
  url: string,
  title: string
): Promise<DeadLinkResult> {
  try {
    // 书签 URL 通常跨域，无法用 fetch 直接读取响应体，改用 no-cors 模式探测可达性
    const resp = await fetch(url, {
      method: "GET",
      mode: "no-cors",
      signal: AbortSignal.timeout(5000),
    })
    // no-cors 模式下无法读取真实状态码，但能抛出网络错误
    return { url, title, status: null, ok: resp.type === "opaque" || resp.ok }
  } catch (e) {
    const err = e as Error
    // AbortError 表示超时，也算"可能失效"
    return {
      url,
      title,
      status: null,
      ok: false,
      error: err.name === "TimeoutError" ? "请求超时" : err.message,
    }
  }
}

/** 统计书签信息 */
export async function getStats(): Promise<BookmarkStats> {
  const tree = await getTree()
  let total = 0
  let folders = 0
  let maxDepth = 0

  function walk(node: chrome.bookmarks.BookmarkTreeNode, depth: number) {
    if (node.url) {
      total++
      maxDepth = Math.max(maxDepth, depth)
    } else {
      if (node.id !== "0") folders++
      node.children?.forEach((child) => walk(child, depth + 1))
    }
  }

  tree.forEach((root) => walk(root, 0))

  const dups = await detectDuplicates()
  const duplicates = dups.reduce((sum, g) => sum + g.items.length - 1, 0)

  return { total, folders, maxDepth, duplicates }
}
