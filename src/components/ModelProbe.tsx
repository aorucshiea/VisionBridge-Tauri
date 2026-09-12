import React, { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ThemeConfig } from '../types'
import { tint } from '../theme/themes'
import type { TFunc } from './settings/ui'

export interface CatalogEntry {
  id: string
  name: string
  vision: boolean
  reasoning: boolean
  tools: boolean
  context: number | null
}

/**
 * Capability probe modal: merges the models.dev catalog (vision / reasoning /
 * tools / context metadata, the same source opencode uses) with the vendor's
 * live /v1/models list, and lets the user pick a model.
 */
const ModelProbe: React.FC<{
  config: { provider: string; apiKey: string; baseUrl: string }
  mdIds: string[]
  current: string
  onPick: (model: string) => void
  onClose: () => void
  theme: ThemeConfig
  t: TFunc
}> = ({ config, mdIds, current, onPick, onClose, theme, t }) => {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [live, setLive] = useState<string[] | null>(null)
  const [liveError, setLiveError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    window.ipcRenderer.modelCatalog({ mdIds }).then((entries: CatalogEntry[]) => {
      if (alive) setCatalog(entries)
    }).catch(() => { if (alive) setCatalog([]) })
    window.ipcRenderer.listModels(config).then((models: string[]) => {
      if (alive) setLive(models)
    }).catch((e: any) => { if (alive) setLiveError(e?.message || '') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = query.trim().toLowerCase()
  const cat = (catalog || []).filter(m => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  const liveOnly = (live || []).filter(id => !cat.some(c => c.id === id) && (!q || id.toLowerCase().includes(q)))

  const fmtContext = (n: number | null): string => {
    if (!n) return ''
    return n >= 1000000 ? `${Math.round(n / 100000) / 10}M` : `${Math.round(n / 1000)}K`
  }

  const badge = (label: string, color: string) => (
    <span
      className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold shrink-0"
      style={{ backgroundColor: tint(color, theme.card, 0.86), color }}
    >
      {label}
    </span>
  )

  const row = (id: string, name: string, badges: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => onPick(id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-[9px] border transition-colors duration-fast ease-out-quart"
      style={{
        borderColor: current === id ? theme.primary : 'transparent',
        backgroundColor: current === id ? tint(theme.primary, theme.card, 0.92) : 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.text, theme.card, 0.05) }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = current === id ? tint(theme.primary, theme.card, 0.92) : 'transparent' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono font-medium truncate" style={{ color: theme.text }}>{id}</p>
        {name && name !== id && (
          <p className="text-[10.5px] truncate" style={{ color: theme.textMuted }}>{name}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">{badges}</div>
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] max-h-[80vh] flex flex-col rounded-[14px] border overflow-hidden"
        style={{ backgroundColor: theme.card, borderColor: theme.hairline, boxShadow: '0 24px 64px -24px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-4 pt-3.5 pb-3 border-b" style={{ borderColor: theme.hairline }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold" style={{ color: theme.text }}>{t('modelProbeTitle')}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('cancel')}
              className="w-7 h-7 flex items-center justify-center rounded-[8px]"
              style={{ color: theme.textSecondary }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 px-2.5 h-8 rounded-[9px] border"
            style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}>
            <Search size={13} style={{ color: theme.textMuted }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('probeSearch')}
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: theme.text }}
            />
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2 space-y-3">
          {catalog === null ? (
            <p className="text-center text-[12px] py-6" style={{ color: theme.textMuted }}>{t('analyzing')}</p>
          ) : (
            <>
              <p className="eyebrow px-1.5" style={{ color: theme.textMuted }}>{t('catalogModels')}</p>
              {cat.length === 0 ? (
                <p className="text-[11.5px] px-1.5 py-2 leading-relaxed" style={{ color: theme.textMuted }}>
                  {t('probeEmpty')}
                </p>
              ) : (
                <div className="space-y-1">
                  {cat.map(m => row(
                    m.id,
                    m.name,
                    <>
                      {m.vision && badge(t('capVision'), theme.primary)}
                      {m.reasoning && badge(t('capReasoning'), theme.accent)}
                      {m.tools && badge(t('capTools'), theme.textSecondary)}
                      {m.context ? (
                        <span className="text-[9.5px] font-mono shrink-0" style={{ color: theme.textMuted }}>
                          {fmtContext(m.context)}
                        </span>
                      ) : null}
                    </>,
                  ))}
                </div>
              )}

              {liveOnly.length > 0 && (
                <>
                  <p className="eyebrow px-1.5 pt-1" style={{ color: theme.textMuted }}>{t('liveModels')}</p>
                  <div className="space-y-1">
                    {liveOnly.map(id => row(id, '', null))}
                  </div>
                </>
              )}

              {liveError && (
                <p className="text-[11px] px-1.5 leading-relaxed" style={{ color: theme.textMuted }}>
                  {t('liveModels')}: {liveError}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModelProbe
