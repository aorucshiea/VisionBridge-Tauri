import React, { useId, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import type { ThemeConfig, TestStatus } from '../../types'
import type { TranslationDict } from '../../i18n'
import { PROVIDER_PRESETS, PROVIDER_GROUPS, GROUP_LABEL_KEY, presetOf } from '../../lib/providers'
import { tint } from '../../theme/themes'
import ModelProbe from '../ModelProbe'
import {
  Card, FieldLabel, MonoInput, PasswordInput, Select, TextArea, TextInput,
  TestButton, TestStatusText, type TFunc,
} from './ui'

type SectionType = 'vlm' | 'ocr' | 'llm' | 'vlm2' | 'llm2'

export interface SectionModel {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  translatePrompt?: string
  explainPrompt?: string
  jsonPrompt?: string
}

interface ProviderConfigSectionProps {
  type: SectionType
  step?: '1' | '2'
  tone: 'primary' | 'accent'
  titleKey: keyof TranslationDict
  collapsible: boolean
  expanded: boolean
  onToggle: () => void
  fields: Array<'translatePrompt' | 'explainPrompt' | 'jsonPrompt'>
  testStyle: 'inline' | 'full'
  testLabelKey: keyof TranslationDict
  modelPlaceholderKey: keyof TranslationDict
  section: SectionModel
  onPatch: (patch: Partial<SectionModel>) => void
  testStatus: TestStatus
  testMessage: string
  showApiKey: boolean
  onToggleApiKey: () => void
  onTest: () => void
  theme: ThemeConfig
  t: TFunc
}

const FIELD_META: Record<'translatePrompt' | 'explainPrompt' | 'jsonPrompt', {
  labelKey: keyof TranslationDict
  placeholderKey: keyof TranslationDict
  rows: number
}> = {
  translatePrompt: { labelKey: 'translatePrompt', placeholderKey: 'placeholderTranslatePrompt', rows: 3 },
  explainPrompt: { labelKey: 'explainPrompt', placeholderKey: 'placeholderExplainPrompt', rows: 3 },
  jsonPrompt: { labelKey: 'jsonPrompt', placeholderKey: 'placeholderJsonPrompt', rows: 4 },
}

const GROUPS = PROVIDER_GROUPS

const ProviderConfigSection: React.FC<ProviderConfigSectionProps> = (props) => {
  const {
    type, step, tone, titleKey, collapsible, expanded, onToggle,
    fields, testStyle, testLabelKey, modelPlaceholderKey,
    section, onPatch, testStatus, testMessage, showApiKey, onToggleApiKey, onTest,
    theme, t,
  } = props

  const toneColor = tone === 'accent' ? theme.accent : theme.primary
  const datalistId = `models-${useId()}`
  const [showProbe, setShowProbe] = useState(false)

  const preset = presetOf(section.provider)
  const suggestions = preset?.models || []

  const handleProviderChange = (id: string) => {
    const target = presetOf(id)
    // Picking a vendor autofills its API host; the key and model stay yours.
    onPatch(target && target.baseUrl ? { provider: id, baseUrl: target.baseUrl } : { provider: id })
  }

  const providerSelect = (
    <Select
      value={section.provider}
      onChange={(e) => handleProviderChange(e.target.value)}
      aria-label={t('apiProvider')}
      theme={theme}
    >
      {GROUPS.map(g => (
        <optgroup key={g.key} label={t(GROUP_LABEL_KEY[g.key] as keyof TranslationDict)}>
          {PROVIDER_PRESETS.filter(p => p.group === g.key).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  )

  const modelDatalist = (
    <datalist id={datalistId}>
      {suggestions.map(m => <option key={m} value={m} />)}
    </datalist>
  )

  /** Single entry point for models: opens the list (catalog + vendor live). */
  const fetchButton = (
    <button
      type="button"
      onClick={() => setShowProbe(true)}
      aria-label={t('probeModels')}
      title={t('probeModels')}
      className="w-10 h-10 shrink-0 flex items-center justify-center rounded-field border transition-colors duration-150 ease-out-quart active:scale-[0.97]"
      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
    >
      <Download size={15} />
    </button>
  )

  const modelInput = (className = '') => (
    <>
      <TextInput
        type="text"
        list={datalistId}
        value={section.model}
        onChange={(e) => onPatch({ model: e.target.value })}
        placeholder={t(modelPlaceholderKey)}
        className={className}
        theme={theme}
      />
      {modelDatalist}
    </>
  )

  const content = (
    <div className="space-y-3.5">
      {providerSelect}

      <div>
        <FieldLabel theme={theme}>{t('baseUrl')}</FieldLabel>
        <MonoInput
          type="text"
          value={section.baseUrl}
          onChange={(e) => onPatch({ baseUrl: e.target.value })}
          theme={theme}
        />
      </div>

      {type !== 'ocr' ? (
        <div>
          <FieldLabel theme={theme}>{t('modelName')}</FieldLabel>
          <div className="flex gap-2">
            <div className="flex-[1.4] min-w-0">{modelInput()}</div>
            {fetchButton}
            {testStyle === 'inline'
              ? <TestButton status={testStatus} onClick={onTest} label={t('test')} theme={theme} />
              : null}
          </div>
          <TestStatusText status={testStatus} message={testMessage} />
        </div>
      ) : (
        <div>
          <FieldLabel theme={theme}>{t('modelName')}</FieldLabel>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">{modelInput()}</div>
            {fetchButton}
          </div>
        </div>
      )}

      {type !== 'ocr' ? (
        <div>
          <FieldLabel theme={theme}>{t('apiKey')}</FieldLabel>
          <PasswordInput
            value={section.apiKey}
            onChange={(v) => onPatch({ apiKey: v })}
            show={showApiKey}
            onToggleShow={onToggleApiKey}
            placeholder={t('placeholderApiKey')}
            label={t('showHideKey')}
            theme={theme}
          />
        </div>
      ) : (
        <div>
          <FieldLabel theme={theme}>{t('apiKey')}</FieldLabel>
          <div className="flex gap-2">
            <PasswordInput
              value={section.apiKey}
              onChange={(v) => onPatch({ apiKey: v })}
              show={showApiKey}
              onToggleShow={onToggleApiKey}
              placeholder={t('ocrApiKeyPlaceholder')}
              label={t('showHideKey')}
              theme={theme}
            />
            {type === 'ocr' && testStyle === 'inline'
              ? <TestButton status={testStatus} onClick={onTest} label={t('test')} theme={theme} />
              : null}
          </div>
          <TestStatusText status={testStatus} message={testMessage} />
        </div>
      )}

      {fields.map(field => {
        const meta = FIELD_META[field]
        return (
          <div key={field}>
            <FieldLabel theme={theme}>{t(meta.labelKey)}</FieldLabel>
            <TextArea
              value={section[field] || ''}
              onChange={(e) => onPatch({ [field]: e.target.value })}
              rows={meta.rows}
              placeholder={t(meta.placeholderKey)}
              theme={theme}
            />
          </div>
        )
      })}

      {testStyle === 'full' && (
        <div className="space-y-2">
          <TestButton status={testStatus} onClick={onTest} label={t(testLabelKey)} full theme={theme} />
          <TestStatusText status={testStatus} message={testMessage} />
        </div>
      )}

      {showProbe && (
        <ModelProbe
          config={{ provider: section.provider, apiKey: section.apiKey, baseUrl: section.baseUrl }}
          mdIds={preset?.mdIds || []}
          current={section.model}
          onPick={(m) => { onPatch({ model: m }); setShowProbe(false) }}
          onClose={() => setShowProbe(false)}
          theme={theme}
          t={t}
        />
      )}
    </div>
  )

  if (!collapsible) {
    return (
      <section className="space-y-2.5 animate-rise">
        <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t(titleKey)}</h2>
        <Card theme={theme}>{content}</Card>
      </section>
    )
  }

  return (
    <section className="rounded-card border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.hairline }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors duration-150 ease-out-quart"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.text, theme.card, 0.03) }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <span
          className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: tint(toneColor, theme.card, 0.16), color: toneColor }}
        >
          {step}
        </span>
        <span className="flex-1 text-[12.5px] font-semibold" style={{ color: theme.text }}>{t(titleKey)}</span>
        <ChevronDown
          size={15}
          className="shrink-0 transition-transform duration-base ease-out-quart"
          style={{ color: theme.textMuted, transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: theme.hairline }}>
          {content}
        </div>
      )}
    </section>
  )
}

export default ProviderConfigSection
