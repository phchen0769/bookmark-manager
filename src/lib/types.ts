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

/** AI 服务配置（用户可在界面填写并保存） */
export interface AiConfig {
  /** API 地址，如 http://10.178.34.133:8317 */
  baseUrl: string
  /** 模型名，如 deepseek-v4-pro */
  model: string
  /** API Key（可选，有些内网服务不需要） */
  apiKey: string
}

/** AI 返回的单个书签分类结果 */
export interface ClassificationResult {
  /** 书签 id */
  id: string
  /** 建议归入的文件夹名 */
  category: string
  /** 建议打的标签 */
  tags: string[]
}

/** 分类过程进度 */
export interface ClassifyProgress {
  done: number
  total: number
  phase: "classifying" | "applying"
}
