import React from 'react'
import { ScanText, Sparkles, Check } from 'lucide-react'
import type { PipelineMode, ThemeConfig } from '../../types'
import { tint } from '../../theme/themes'
import type { TFunc } from './ui'

/**
 * Default preset pipelines (OCR+LLM, VLM+LLM) — always visible in settings.
 * Their config lives in the legacy sections below; these cards switch them on.
 */
const PRESETS: Array<{
  mode: Exclude<PipelineMode, 'VLM' | 'TEXT' | 'CUSTOM'>
  icon: React.ReactNode
  label: string
  chain: string[]
  descKey: 'pipelineDescOcr' | 'pipelineDescVlmLlm'
}> = [
  { mode: 'OCR+LLM', icon: <ScanText size={14} />, label: 'OCR + LLM', chain: ['OCR', 'LLM'], descKey: 'pipelineDescOcr' },
  { mode: 'VLM+LLM', icon: <Sparkles size={14} />, label: 'VLM + LLM', chain: ['VLM', 'LLM'], descKey: 'pipelineDescVlmLlm' },
]

const OfficialPresets: React.FC<{
  mode: PipelineMode
  onSelect: (m: 'OCR+LLM' | 'VLM+LLM') => void
  theme: ThemeConfig
  t: TFunc
}> = ({ mode, onSelect, theme, t }) => {
  return (
    <section className="space-y-2.5 animate-rise">
      <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t('officialPresets')}</h2>
      <div className="space-y-2.5">
        {PRESETS.map(p => {
          const active = mode === p.mode
          return (
            <div
              key={p.mode}
              className="rounded-card border px-4 py-3.5 space-y-2.5"
              style={{
                backgroundColor: theme.card,
                borderColor: active ? tint(theme.primary, theme.card, 0.4) : theme.hairline,
                boxShadow: active ? `0 0 0 3px ${tint(theme.primary, theme.card, 0.88)}` : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: tint(theme.primary, theme.card, 0.14), color: theme.primary }}>
                  {p.icon}
                </span>
                <span className="flex-1 min-w-0 text-[13px] font-semibold" style={{ color: theme.text }}>
                  {p.label}
                </span>
                {active ? (
                  <span className="h-6 px-2 flex items-center gap-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: tint(theme.success, theme.card, 0.14), color: theme.success }}>
                    <Check size={11} />
                    {t('inUse')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(p.mode)}
                    className="h-6 px-2.5 rounded-full text-[10.5px] font-bold border transition-colors duration-fast ease-out-quart"
                    style={{ borderColor: tint(theme.primary, theme.card, 0.3), color: theme.primary, backgroundColor: tint(theme.primary, theme.card, 0.08) }}
                  >
                    {t('usePipeline')}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {p.chain.map((n, i) => (
                  <React.Fragment key={n}>
                    {i > 0 && <span aria-hidden className="text-[10px]" style={{ color: theme.textMuted }}>→</span>}
                    <span className="flex items-center h-6 px-2 rounded-full border text-[10.5px] font-medium"
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}>
                      {n}
                    </span>
                  </React.Fragment>
                ))}
                <span className="ml-1 text-[10.5px] leading-relaxed" style={{ color: theme.textMuted }}>
                  {t(p.descKey)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default OfficialPresets
