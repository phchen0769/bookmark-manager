import { useCallback, useEffect, useMemo, useState } from "react"
import type {
  FlatBookmark,
  DuplicateGroup,
  BookmarkStats,
  ClassificationResult,
  ClassifyProgress,
} from "~lib/types"
import {
  getAllBookmarks,
  searchBookmarks,
  detectDuplicates,
  getStats,
} from "~lib/bookmarks"
import { getAiConfig } from "~lib/aiConfig"
import { classifyBookmarks, applyClassification } from "~lib/classify"
import SettingsPanel from "./SettingsPanel"

type View = "list" | "classify"

/** 主面板组件：搜索 + 书签列表 + 统计 + 去重检测 + AI 自动分类 */
export default function BookmarkPanel() {
  const [bookmarks, setBookmarks] = useState<FlatBookmark[]>([])
  const [query, setQuery] = useState("")
  const [stats, setStats] = useState<BookmarkStats | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [showDupes, setShowDupes] = useState(false)
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<View>("list")
  const [showSettings, setShowSettings] = useState(false)

  // 分类相关状态
  const [classifying, setClassifying] = useState(false)
  const [progress, setProgress] = useState<ClassifyProgress | null>(null)
  const [classResults, setClassResults] = useState<ClassificationResult[]>([])
  const [error, setError] = useState<string | null>(null)

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

  /** 开始自动分类 */
  const handleClassify = useCallback(async () => {
    setClassifying(true)
    setError(null)
    setClassResults([])
    try {
      const config = await getAiConfig()
      const all = await getAllBookmarks()
      const results = await classifyBookmarks(all, config, setProgress)
      setClassResults(results)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setClassifying(false)
      setProgress(null)
    }
  }, [])

  /** 把分类结果应用到书签 */
  const handleApply = useCallback(async () => {
    setClassifying(true)
    setError(null)
    try {
      await applyClassification(classResults, setProgress)
      await refresh()
      setView("list")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setClassifying(false)
      setProgress(null)
    }
  }, [classResults, refresh])

  // 统计分类结果
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of classResults) {
      map.set(r.category, (map.get(r.category) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [classResults])

  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} />
  }

  return (
    <div className="bm-panel">
      <header className="bm-header">
        <div className="bm-header-top">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索书签标题或 URL…"
            className="bm-search"
          />
          <button
            className="bm-icon-btn"
            onClick={() => setShowSettings(true)}
            title="设置">
            ⚙️
          </button>
        </div>
        <div className="bm-tabs">
          <button
            className={view === "list" ? "bm-tab active" : "bm-tab"}
            onClick={() => setView("list")}>
            书签
          </button>
          <button
            className={view === "classify" ? "bm-tab active" : "bm-tab"}
            onClick={() => setView("classify")}>
            AI 分类
          </button>
        </div>
      </header>

      {error && <div className="bm-error">{error}</div>}

      {view === "list" ? (
        <>
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
        </>
      ) : (
        <main className="bm-list">
          <div className="bm-classify">
            <button
              className="bm-btn primary"
              onClick={handleClassify}
              disabled={classifying}>
              {classifying ? "分类中…" : "开始自动分类"}
            </button>

            {progress && (
              <p className="bm-progress">
                {progress.phase === "classifying" ? "正在分类" : "正在应用"}
                ：{progress.done}/{progress.total}
              </p>
            )}

            {classResults.length > 0 && (
              <>
                <div className="bm-classify-summary">
                  <h3>分类结果（{classResults.length} 个书签）</h3>
                  <ul className="bm-category-list">
                    {categoryCounts.map(([cat, count]) => (
                      <li key={cat}>
                        <span>{cat}</span>
                        <span className="bm-category-count">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  className="bm-btn success"
                  onClick={handleApply}
                  disabled={classifying}>
                  应用到书签（移动到「自动分类」文件夹）
                </button>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
