import React from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import type { AppSettings, ThemeConfig, ToolbarAction } from '../../types'
import { DEFAULT_TOOLBAR_ACTIONS } from '../../lib/defaults'
import { tint } from '../../theme/themes'
import { Card, FieldLabel, TextInput, TextArea, type TFunc } from './ui'

interface Props {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => void
  theme: ThemeConfig
  t: TFunc
}

let seq = 0
const newAction = (): ToolbarAction => ({
  id: `a${Date.now().toString(36)}${seq += 1}`,
  label: '',
  prompt: '',
  enabled: true,
})

/**
 * Editor for the buttons that appear on the capture / selection toolbars.
 * Every button carries its own prompt ({input} = selected text or, for the
 * capture toolbar, overrides the task prompt across the node chain).
 */
const ToolbarActionsSection: React.FC<Props> = ({ settings, onPatch, theme, t }) => {
  const actions = settings.toolbarActions || []

  const patchAction = (id: string, patch: Partial<ToolbarAction>) => {
    onPatch({ toolbarActions: actions.map(a => (a.id === id ? { ...a, ...patch } : a)) })
  }

  const addAction = () => {
    onPatch({ toolbarActions: [...actions, newAction()] })
  }

  const removeAction = (id: string) => {
    onPatch({ toolbarActions: actions.filter(a => a.id !== id) })
  }

  const restoreDefaults = () => {
    onPatch({ toolbarActions: DEFAULT_TOOLBAR_ACTIONS.map(a => ({ ...a })) })
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t('toolbarButtons')}</h2>
          <p className="text-[10.5px] leading-relaxed mt-0.5" style={{ color: theme.textMuted }}>
            {t('toolbarButtonsDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={restoreDefaults}
            className="h-7 px-2.5 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 border"
            style={{ borderColor: theme.inputBorder, color: theme.textSecondary, backgroundColor: theme.card }}
          >
            <RotateCcw size={11} />
            {t('restoreDefaults')}
          </button>
          <button
            type="button"
            onClick={addAction}
            className="h-7 px-2.5 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 border transition-colors duration-fast ease-out-quart"
            style={{ borderColor: tint(theme.primary, theme.card, 0.3), color: theme.primary, backgroundColor: tint(theme.primary, theme.card, 0.08) }}
          >
            <Plus size={12} />
            {t('addAction')}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {actions.map((a, i) => (
          <Card key={a.id} pad={false} theme={theme} className="overflow-hidden">
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
                  style={{ backgroundColor: tint(theme.text, theme.card, 0.08), color: theme.textSecondary }}
                >
                  {i + 1}
                </span>
                <span
                  role="switch"
                  aria-checked={a.enabled}
                  aria-label={a.label || t('actionLabel')}
                  onClick={() => patchAction(a.id, { enabled: !a.enabled })}
                  className="relative w-8 h-[18px] rounded-full border shrink-0 cursor-pointer transition-colors duration-fast ease-out-quart"
                  style={{ backgroundColor: a.enabled ? theme.primary : theme.inputBg, borderColor: a.enabled ? theme.primary : theme.inputBorder }}
                >
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-[left,background-color] duration-fast ease-out-quart"
                    style={{ left: a.enabled ? '17px' : '2px', backgroundColor: a.enabled ? theme.onPrimary : theme.textMuted }}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <TextInput
                    value={a.label}
                    onChange={(e) => patchAction(a.id, { label: e.target.value })}
                    placeholder={t('actionLabel')}
                    theme={theme}
                    className="h-8"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAction(a.id)}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] border transition-colors duration-fast ease-out-quart"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.danger }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <FieldLabel theme={theme}>{t('actionPrompt')}</FieldLabel>
                <TextArea
                  value={a.prompt}
                  onChange={(e) => patchAction(a.id, { prompt: e.target.value })}
                  rows={2}
                  placeholder={t('actionPromptHint')}
                  theme={theme}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default ToolbarActionsSection
