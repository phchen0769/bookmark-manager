import { useCallback, useEffect, useState } from "react"
import type { AiConfig } from "~lib/types"
import { getAiConfig, saveAiConfig } from "~lib/aiConfig"

interface SettingsPanelProps {
  onClose: () => void
}

/** AI 服务配置面板：可填写并保存 baseUrl / model / apiKey */
export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [config, setConfig] = useState<AiConfig>({
    baseUrl: "",
    model: "",
    apiKey: "",
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAiConfig().then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [])

  const handleSave = useCallback(async () => {
    await saveAiConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [config])

  if (loading) {
    return <div className="bm-settings">加载中…</div>
  }

  return (
    <div className="bm-settings">
      <div className="bm-settings-header">
        <h2>AI 服务配置</h2>
        <button className="bm-icon-btn" onClick={onClose} title="关闭">
          ✕
        </button>
      </div>

      <label className="bm-field">
        <span>API 地址</span>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
          placeholder="http://10.178.34.133:8317"
        />
      </label>

      <label className="bm-field">
        <span>模型</span>
        <input
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          placeholder="deepseek-v4-pro"
        />
      </label>

      <label className="bm-field">
        <span>API Key（可选）</span>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          placeholder="留空表示不需要鉴权"
        />
      </label>

      <div className="bm-settings-footer">
        <button className="bm-btn primary" onClick={handleSave}>
          {saved ? "已保存 ✓" : "保存"}
        </button>
      </div>
    </div>
  )
}
