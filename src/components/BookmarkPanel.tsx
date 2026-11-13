import { useCallback, useEffect, useMemo, useState } from "react"
import type { FlatBookmark, DuplicateGroup, BookmarkStats } from "~lib/types"
import {
  getAllBookmarks,
  searchBookmarks,
  detectDuplicates,
  getStats,
} from "~lib/bookmarks"

/** 主面板组件：搜索 + 书签列表 + 统计 + 去重检测 */
export default function BookmarkPanel() {
  const [bookmarks, setBookmarks] = useState<FlatBookmark[]>([])
  const [query, setQuery] = useState("")
  const [stats, setStats] = useState<BookmarkStats | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [showDupes, setShowDupes] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [all, s, d] = await Promise.all([
      getAllBookmarks(),
      getStats(),
      detectDuplicates(),
    ])
    setBookmarks(all)
    setStats(s)
    setDuplicates(d)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    // 书签变化时自动刷新
    const handler = () => refresh()
    chrome.bookmarks.onCreated.addListener(handler)
    chrome.bookmarks.onRemoved.addListener(handler)
    chrome.bookmarks.onChanged.addListener(handler)
    chrome.bookmarks.onMoved.addListener(handler)
    return () => {
      chrome.bookmarks.onCreated.removeListener(handler)
      chrome.bookmarks.onRemoved.removeListener(handler)
      chrome.bookmarks.onChanged.removeListener(handler)
      chrome.bookmarks.onMoved.removeListener(handler)
    }
  }, [refresh])

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim()) {
        const results = await searchBookmarks(query.trim())
        setBookmarks(results)
      } else {
        setBookmarks(await getAllBookmarks())
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const display = useMemo(() => {
    if (showDupes) {
      return duplicates.flatMap((d) => d.items)
    }
    return bookmarks
  }, [showDupes, duplicates, bookmarks])

  return (
    <div className="bm-panel">
      <header className="bm-header">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索书签标题或 URL…"
          className="bm-search"
        />
      </header>

      {stats && (
        <div className="bm-stats">
          <span>书签 {stats.total}</span>
          <span>文件夹 {stats.folders}</span>
          <span>重复 {stats.duplicates}</span>
          <button
            onClick={() => setShowDupes((v) => !v)}
            className={showDupes ? "bm-badge active" : "bm-badge"}>
            {showDupes ? "显示全部" : `查看重复 (${duplicates.length})`}
          </button>
        </div>
      )}

      <main className="bm-list">
        {loading ? (
          <p className="bm-empty">加载中…</p>
        ) : display.length === 0 ? (
          <p className="bm-empty">
            {query ? "没有匹配的书签" : "暂无书签"}
          </p>
        ) : (
          <ul className="bm-items">
            {display.map((bm) => (
              <li key={bm.id}>
                <a
                  href={bm.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bm-item">
                  <div className="bm-item-body">
                    <p className="bm-item-title">
                      {bm.title || "(无标题)"}
                    </p>
                    {bm.path.length > 0 && (
                      <p className="bm-item-path">
                        {bm.path.join(" / ")}
                      </p>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
