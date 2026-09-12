import React from 'react'
import { ScanEye, MessageSquare, ChevronDown } from 'lucide-react'
import type { PipelineMode, ThemeConfig } from '../../types'
import { tint } from '../../theme/themes'
import type { TFunc } from './ui'

/**
 * The two basic modes. Hybrid presets (OCR+LLM / VLM+LLM) sit between this
 * section and the advanced toggle; custom pipelines live in advanced mode.
 */
const MODES: Array<{
  mode: 'VLM' | 'TEXT'
  icon: React.ReactNode
  labelKey: 'multimodal' | 'textMode'
  descKey: 'pipelineDescVlm' | 'textModeDesc'
}> = [
  { mode: 'VLM', icon: <ScanEye size={15} />, labelKey: 'multimodal', descKey: 'pipelineDescVlm' },
  { mode: 'TEXT', icon: <MessageSquare size={15} />, labelKey: 'textMode', descKey: 'textModeDesc' },
]

export function Switch({ checked, onChange, label, theme }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  theme: ThemeConfig
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full border transition-colors duration-fast ease-out-quart shrink-0"
      style={{
        backgroundColor: checked ? theme.primary : theme.inputBg,
        borderColor: checked ? theme.primary : theme.inputBorder,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full transition-[left,background-color] duration-fast ease-out-quart"
        style={{ left: checked ? '18px' : '3px', backgroundColor: checked ? theme.onPrimary : theme.textMuted }}
      />
    </button>
  )
}

/** Basic modes only. */
const PipelineSelector: React.FC<{
  mode: PipelineMode
  onSelect: (m: 'VLM' | 'TEXT') => void
  theme: ThemeConfig
  t: TFunc
}> = ({ mode, onSelect, theme, t }) => {
  const active = MODES.find(m => m.mode === mode)
  const descKey = active
    ? active.descKey
    : mode === 'CUSTOM' ? 'customPipelines' as const : 'pipelineDescOcr' as const

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow shrink-0" style={{ color: theme.textSecondary }}>{t('basicModes')}</h2>
        <p className="text-[11px] leading-relaxed text-right" style={{ color: theme.textMuted }}>
          {t(descKey)}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={t('basicModes')}
        className="grid grid-cols-2 gap-1 p-1 rounded-[11px] border"
        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
      >
        {MODES.map(m => {
          const selected = mode === m.mode
          return (
            <button
              key={m.mode}
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(m.mode)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-[11px] font-semibold tracking-wide border transition-[background-color,border-color,color,transform] duration-base ease-out-quart active:scale-[0.98]"
              style={{
                color: selected ? theme.primary : theme.textSecondary,
                backgroundColor: selected ? tint(theme.primary, theme.card, 0.08) : 'transparent',
                borderColor: selected ? tint(theme.primary, theme.card, 0.3) : 'transparent',
                boxShadow: selected ? `0 1px 2px ${theme.hairline}` : undefined,
              }}
            >
              {m.icon}
              <span>{t(m.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** The advanced-mode card; rendered between hybrid presets and the builder. */
export function AdvancedModeCard({ advancedMode, onToggle, theme, t }: {
  advancedMode: boolean
  onToggle: (v: boolean) => void
  theme: ThemeConfig
  t: TFunc
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[11px] border"
      style={{ backgroundColor: theme.card, borderColor: theme.hairline }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: theme.text }}>{t('advancedMode')}</p>
        <p className="text-[10.5px] leading-relaxed" style={{ color: theme.textMuted }}>{t('advancedModeDesc')}</p>
      </div>
      <Switch checked={advancedMode} onChange={onToggle} label={t('advancedMode')} theme={theme} />
      <ChevronDown
        size={14}
        aria-hidden
        className="transition-transform duration-base ease-out-quart"
        style={{ color: theme.textMuted, transform: advancedMode ? 'rotate(0deg)' : 'rotate(-90deg)' }}
      />
    </div>
  )
}

export default PipelineSelector
