import React from 'react'
import { Check, X as CloseIcon } from 'lucide-react'
import type { SavedConfiguration, ThemeConfig } from '../../types'
import { tint } from '../../theme/themes'
import { Card, TextInput, type TFunc } from './ui'

const API_FORMAT_TAGS = ['OpenAI API', 'Anthropic API', 'Ollama API', 'Gemini API']
const MODEL_TYPE_TAGS = ['Vision Model', 'Language Model', 'Inference Model', 'Non-Inference Model']

function getApiFormatLabel(provider: string): string {
  switch (provider) {
    case 'ollama': return 'Ollama API'
    case 'openai':
    case 'custom': return 'OpenAI API'
    case 'anthropic': return 'Anthropic API'
    default: return 'Unknown'
  }
}

interface SavedConfigsProps {
  show: boolean
  onToggleShow: () => void
  configName: string
  onConfigNameChange: (v: string) => void
  configTags: string[]
  customTagInput: string
  onCustomTagInputChange: (v: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onAddCustomTag: () => void
  onSave: () => void
  configurations: SavedConfiguration[]
  onApply: (config: SavedConfiguration) => void
  onDelete: (id: string) => void
  theme: ThemeConfig
  t: TFunc
}

/** Selectable tag chip. `tone` picks the highlight colour. */
function TagChip({ label, selected, onClick, theme, tone }: {
  label: string
  selected: boolean
  onClick: () => void
  theme: ThemeConfig
  tone: 'primary' | 'accent'
}) {
  const color = tone === 'accent' ? theme.accent : theme.primary
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="px-2.5 py-1 rounded-full border text-[11px] font-medium transition-[background-color,border-color,color,transform] duration-fast ease-out-quart active:scale-[0.97]"
      style={selected
        ? { backgroundColor: tint(color, theme.card, 0.16), borderColor: tint(color, theme.card, 0.34), color }
        : { backgroundColor: 'transparent', borderColor: theme.inputBorder, color: theme.textSecondary }}
    >
      {label}
    </button>
  )
}

/** Read-only label chip (tags / providers on a saved entry). */
function MetaChip({ label, color, theme }: { label: string; color: string; theme: ThemeConfig }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: tint(color, theme.card, 0.14), color }}
    >
      {label}
    </span>
  )
}

const SavedConfigs: React.FC<SavedConfigsProps> = (props) => {
  const {
    show, onToggleShow, configName, onConfigNameChange, configTags, customTagInput,
    onCustomTagInputChange, onAddTag, onRemoveTag, onAddCustomTag, onSave,
    configurations, onApply, onDelete, theme, t,
  } = props

  const customTags = configTags.filter(tag => !API_FORMAT_TAGS.includes(tag) && !MODEL_TYPE_TAGS.includes(tag))

  const toggleTag = (tag: string) => {
    if (configTags.includes(tag)) onRemoveTag(tag)
    else onAddTag(tag)
  }

  const pipelineLabel = (pipeline: string) =>
    pipeline === 'VLM' ? t('pipelineA') : pipeline === 'OCR+LLM' ? t('pipelineB') : t('pipelineC')

  /** Provider chips for one entry — declarative instead of one branch per pipeline. */
  const providerBadges = (config: SavedConfiguration) => {
    const c = config.config
    const entries: Array<{ label: string; color: string }> = []
    if (config.pipeline === 'VLM' && c.vlmProvider) {
      entries.push({ label: getApiFormatLabel(c.vlmProvider), color: theme.primary })
    }
    if (config.pipeline === 'OCR+LLM') {
      if (c.ocrProvider) entries.push({ label: getApiFormatLabel(c.ocrProvider), color: theme.primary })
      if (c.llmProvider) entries.push({ label: getApiFormatLabel(c.llmProvider), color: theme.accent })
    }
    if (config.pipeline === 'VLM+LLM') {
      if (c.vlm2Provider) entries.push({ label: getApiFormatLabel(c.vlm2Provider), color: theme.primary })
      if (c.llm2Provider) entries.push({ label: getApiFormatLabel(c.llm2Provider), color: theme.accent })
    }
    return entries
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t('savedConfigs')}</h2>
        <button
          type="button"
          onClick={onToggleShow}
          aria-expanded={show}
          className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors duration-fast ease-out-quart"
          style={{ color: theme.primary }}
        >
          {show ? t('hide') : t('show')}
          {configurations.length > 0 && (
            <span
              className="px-1.5 rounded-full text-[10px] tabular-nums"
              style={{ backgroundColor: tint(theme.primary, theme.card, 0.16), color: theme.primary }}
            >
              {configurations.length}
            </span>
          )}
        </button>
      </div>

      {show && (
        <div className="space-y-3 animate-rise">
          <Card theme={theme} className="space-y-4">
            <TextInput
              type="text"
              value={configName}
              onChange={(e) => onConfigNameChange(e.target.value)}
              placeholder={t('placeholderConfigName')}
              aria-label={t('configName')}
              theme={theme}
            />

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="eyebrow" style={{ color: theme.textMuted }}>{t('apiFormatTags')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {API_FORMAT_TAGS.map(tag => (
                    <TagChip
                      key={tag}
                      label={tag}
                      selected={configTags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                      theme={theme}
                      tone="primary"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="eyebrow" style={{ color: theme.textMuted }}>{t('modelTypeTags')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODEL_TYPE_TAGS.map(tag => (
                    <TagChip
                      key={tag}
                      label={tag}
                      selected={configTags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                      theme={theme}
                      tone="accent"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="eyebrow" style={{ color: theme.textMuted }}>{t('customTags')}</p>
                <div className="flex gap-2">
                  <TextInput
                    type="text"
                    value={customTagInput}
                    onChange={(e) => onCustomTagInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onAddCustomTag() }}
                    placeholder={t('placeholderCustomTag')}
                    aria-label={t('customTags')}
                    className="flex-1"
                    theme={theme}
                  />
                  <button
                    type="button"
                    onClick={onAddCustomTag}
                    className="h-10 px-4 rounded-field border text-[11px] font-semibold transition-[background-color,transform] duration-fast ease-out-quart active:scale-[0.97]"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
                  >
                    {t('add')}
                  </button>
                </div>
                {customTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {customTags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border text-[11px]"
                        style={{ borderColor: theme.inputBorder, color: theme.textSecondary }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => onRemoveTag(tag)}
                          aria-label={`${t('delete')} ${tag}`}
                          className="w-4 h-4 flex items-center justify-center rounded-full transition-colors duration-fast"
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.16); e.currentTarget.style.color = theme.danger }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'inherit' }}
                        >
                          <CloseIcon size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={!configName.trim()}
              className="w-full h-10 rounded-field text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-[filter,transform] duration-fast ease-out-quart hover:brightness-[1.06] active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100"
              style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
            >
              <Check size={14} />
              {t('saveConfig')}
            </button>
          </Card>

          {configurations.length > 0 ? (
            <div className="space-y-2">
              {(['VLM', 'OCR+LLM', 'VLM+LLM'] as const).map(pipeline => {
                const pipelineConfigs = configurations.filter(c => c.pipeline === pipeline)
                if (pipelineConfigs.length === 0) return null

                return (
                  <div key={pipeline} className="rounded-card border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.hairline }}>
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: theme.hairline }}>
                      <span className="eyebrow" style={{ color: theme.textMuted }}>{pipelineLabel(pipeline)}</span>
                      <span className="font-mono text-[10px]" style={{ color: theme.textMuted }}>{pipeline}</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: theme.hairline }}>
                      {pipelineConfigs.map(config => {
                        const badges = providerBadges(config)
                        return (
                          <div key={config.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-semibold truncate" style={{ color: theme.text }}>{config.name}</p>
                              {(badges.length > 0 || (config.tags && config.tags.length > 0)) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {badges.map(b => <MetaChip key={b.label} label={b.label} color={b.color} theme={theme} />)}
                                  {config.tags?.map(tag => (
                                    <MetaChip
                                      key={tag}
                                      label={tag}
                                      color={API_FORMAT_TAGS.includes(tag) ? theme.primary : MODEL_TYPE_TAGS.includes(tag) ? theme.accent : theme.textMuted}
                                      theme={theme}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onApply(config)}
                                className="h-7 px-2.5 rounded-[7px] text-[11px] font-semibold border transition-[background-color,transform] duration-fast ease-out-quart active:scale-[0.96]"
                                style={{
                                  backgroundColor: tint(theme.primary, theme.card, 0.14),
                                  borderColor: tint(theme.primary, theme.card, 0.3),
                                  color: theme.primary,
                                }}
                              >
                                {t('apply')}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(config.id)}
                                className="h-7 px-2.5 rounded-[7px] text-[11px] font-semibold border transition-[background-color,color,transform] duration-fast ease-out-quart active:scale-[0.96]"
                                style={{ backgroundColor: 'transparent', borderColor: theme.hairline, color: theme.textMuted }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.14); e.currentTarget.style.color = theme.danger; e.currentTarget.style.borderColor = tint(theme.danger, theme.card, 0.3) }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderColor = theme.hairline }}
                              >
                                {t('delete')}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-center py-6" style={{ color: theme.textMuted }}>{t('noConfigs')}</p>
          )}
        </div>
      )}
    </section>
  )
}

export default SavedConfigs
