import React from 'react'
import { Info } from 'lucide-react'
import type { ThemeConfig } from '../../types'
import { tint } from '../../theme/themes'
import type { TFunc } from './ui'

/**
 * Model-name rules. This is reference material, not an error state, so it is
 * presented as a quiet note instead of a coloured alert box.
 */
const ValidationCard: React.FC<{ theme: ThemeConfig; t: TFunc }> = ({ theme, t }) => {
  const rules: Array<{ key: 'validation1' | 'validation2' | 'validation3'; mono?: boolean }> = [
    { key: 'validation1' },
    { key: 'validation2' },
    { key: 'validation3', mono: true },
  ]

  return (
    <div
      className="rounded-card border px-4 py-3.5 flex gap-3"
      style={{ backgroundColor: tint(theme.accent, theme.card, 0.07), borderColor: tint(theme.accent, theme.card, 0.2) }}
    >
      <Info size={14} className="mt-0.5 shrink-0" style={{ color: theme.accent }} />
      <div className="space-y-1.5 min-w-0">
        <h3 className="eyebrow" style={{ color: theme.accent }}>{t('modelValidation')}</h3>
        <ul className="space-y-1">
          {rules.map(({ key, mono }) => (
            <li
              key={key}
              className={`text-[11px] leading-relaxed ${mono ? 'font-mono' : ''}`}
              style={{ color: theme.textSecondary }}
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ValidationCard
