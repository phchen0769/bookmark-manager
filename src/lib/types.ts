// 书签相关的共享类型定义

/** 扁平化后的书签节点（递归展开后的叶子节点） */
export interface FlatBookmark {
  id: string
  title: string
  url?: string
  /** 从根到该节点的完整路径（文件夹名列表），用于展示所属目录 */
  path: string[]
  dateAdded?: number
  dateGroupModified?: number
}

/** 去重检测结果 */
export interface DuplicateGroup {
  /** 重复的 URL */
  url: string
  /** 拥有相同 URL 的所有书签 */
  items: FlatBookmark[]
}

/** 死链检测结果 */
export interface DeadLinkResult {
  url: string
  title: string
  status: number | null
  ok: boolean
  error?: string
}

/** 书签统计信息 */
export interface BookmarkStats {
  total: number
  folders: number
  maxDepth: number
  duplicates: number
}
