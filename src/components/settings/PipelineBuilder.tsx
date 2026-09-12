import React, { useState } from 'react'
import {
  Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, Check, Layers, Pencil, Puzzle, Download,
} from 'lucide-react'
import type { AppSettings, CustomNodeKind, NodeApi, Pipeline, PipelineNode, ThemeConfig, TestStatus } from '../../types'
import type { TranslationDict } from '../../i18n'
import { paletteKinds, kindMeta, customKindLabel, createNode, createPipeline, moveNode } from '../../lib/pipeline'
import { PROVIDER_PRESETS, PROVIDER_GROUPS, GROUP_LABEL_KEY, presetOf } from '../../lib/providers'
import { tint } from '../../theme/themes'
import ModelProbe from '../ModelProbe'
import {
  Card, FieldLabel, MonoInput, PasswordInput, Select, TextArea, TextInput,
  TestButton, TestStatusText, type TFunc,
} from './ui'

interface Props {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => void
  onNotify: (text: string, tone?: 'info' | 'error') => void
  theme: ThemeConfig
  t: TFunc
}

const API_OPTIONS: Array<{ value: NodeApi; label: string }> = [
  { value: 'chat-vision', label: 'chat + vision' },
  { value: 'chat', label: 'chat' },
  { value: 'ocr', label: 'OCR' },
  { value: 'imagegen', label: 'images/generations' },
  { value: 'tts', label: 'audio/speech' },
  { value: 'asr', label: 'audio/transcriptions' },
]

const PROVIDER_GROUPS_UI = PROVIDER_GROUPS

/**
 * Advanced-mode workspace: compose nodes (VLM / LLM / OCR / ASR / TTS /
 * imagegen / user-defined kinds) into ordered pipelines, single or multi node.
 */
const PipelineBuilder: React.FC<Props> = ({ settings, onPatch, onNotify, theme, t }) => {
  const pipelines = settings.pipelines || []
  const customKinds = settings.customNodeKinds || []

  const [draft, setDraft] = useState<Pipeline | null>(null)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [nodeTest, setNodeTest] = useState<Record<string, { status: TestStatus; message: string }>>({})
  const [probeNode, setProbeNode] = useState<PipelineNode | null>(null)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [newKindOpen, setNewKindOpen] = useState(false)
  const [newKindLabel, setNewKindLabel] = useState('')
  const [newKindApi, setNewKindApi] = useState<NodeApi>('chat')

  const isActive = (id: string) => settings.mode === 'CUSTOM' && settings.activePipelineId === id

  // ------------------------------------------------------------------ kinds
  const addCustomKind = () => {
    const label = newKindLabel.trim()
    if (!label) return
    const id = `k${Date.now().toString(36)}`
    const kind: CustomNodeKind = { id, label, api: newKindApi }
    onPatch({ customNodeKinds: [...customKinds, kind] })
    setNewKindLabel('')
    setNewKindOpen(false)
  }

  // --------------------------------------------------------------- pipeline
  const startNew = () => {
    setDraft(createPipeline('', [createNode('vlm', customKinds)]))
    setExpandedNode(null)
  }

  const startEdit = (p: Pipeline) => {
    setDraft({ ...p, nodes: p.nodes.map(n => ({ ...n })) })
    setExpandedNode(null)
  }

  const saveDraft = () => {
    if (!draft) return
    if (!draft.name.trim()) { onNotify(t('pipelineNeedsName'), 'error'); return }
    if (!draft.nodes.some(n => n.enabled)) { onNotify(t('pipelineNeedsNode'), 'error'); return }
    const exists = pipelines.some(p => p.id === draft.id)
    const next = exists ? pipelines.map(p => (p.id === draft.id ? draft : p)) : [...pipelines, draft]
    onPatch({ pipelines: next })
    onNotify(t('pipelineSaved'))
    setDraft(null)
  }

  const removePipeline = (id: string) => {
    if (!window.confirm(t('confirmDeletePipeline'))) return
    const next = pipelines.filter(p => p.id !== id)
    const patch: Partial<AppSettings> = { pipelines: next }
    if (isActive(id)) { patch.mode = 'VLM'; patch.activePipelineId = null }
    onPatch(patch)
  }

  const activate = (id: string) => onPatch({ mode: 'CUSTOM', activePipelineId: id })

  // ------------------------------------------------------------------- nodes
  const patchNode = (id: string, patch: Partial<PipelineNode>) => {
    if (!draft) return
    setDraft({ ...draft, nodes: draft.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) })
  }

  const addNode = (kindId: string) => {
    if (!draft) return
    const node = createNode(kindId, customKinds)
    setDraft({ ...draft, nodes: [...draft.nodes, node] })
    setExpandedNode(node.id)
  }

  const removeNode = (id: string) => {
    if (!draft) return
    setDraft({ ...draft, nodes: draft.nodes.filter(n => n.id !== id) })
  }

  const testNode = async (node: PipelineNode) => {
    setNodeTest(prev => ({ ...prev, [node.id]: { status: 'testing', message: t('testing') } }))
    try {
      const result = await window.ipcRenderer.testConnection(
        { provider: node.provider, apiKey: node.apiKey, baseUrl: node.baseUrl, model: node.model },
        'vlm',
      )
      setNodeTest(prev => ({
        ...prev,
        [node.id]: { status: result.success && result.available ? 'success' : 'error', message: result.message },
      }))
    } catch (error: any) {
      setNodeTest(prev => ({ ...prev, [node.id]: { status: 'error', message: `${t('testFailed')} ${error.message}` } }))
    } finally {
      window.setTimeout(() => setNodeTest(prev => ({ ...prev, [node.id]: { status: 'idle', message: '' } })), 5000)
    }
  }

  // ------------------------------------------------------------------ render
  const nodeLabel = (node: PipelineNode): string => {
    const custom = customKindLabel(node.kind, customKinds)
    if (node.name) return node.name
    if (custom) return custom
    return t(kindMeta(node.kind, customKinds).labelKey)
  }

  const renderNodeCard = (node: PipelineNode, index: number) => {
    const meta = kindMeta(node.kind, customKinds)
    const Icon = meta.icon
    const expanded = expandedNode === node.id
    const test = nodeTest[node.id] || { status: 'idle' as TestStatus, message: '' }
    const toneColor = meta.produces === 'audio' ? theme.accent : theme.primary

    return (
      <div key={node.id} className="rounded-[11px] border overflow-hidden" style={{ borderColor: theme.hairline }}>
        <button
          type="button"
          onClick={() => setExpandedNode(expanded ? null : node.id)}
          aria-expanded={expanded}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
            style={{ backgroundColor: tint(theme.text, theme.card, 0.08), color: theme.textSecondary }}>
            {index + 1}
          </span>
          <span className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center"
            style={{ backgroundColor: tint(toneColor, theme.card, 0.14), color: toneColor }}>
            <Icon size={13} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12px] font-semibold truncate" style={{ color: theme.text }}>
              {nodeLabel(node)}
            </span>
            <span className="block text-[10.5px] font-mono truncate" style={{ color: theme.textMuted }}>
              {node.model || t('modelName')}
            </span>
          </span>
          <span
            role="switch"
            aria-checked={node.enabled}
            aria-label={t('addNode')}
            onClick={(e) => { e.stopPropagation(); patchNode(node.id, { enabled: !node.enabled }) }}
            className="relative w-8 h-[18px] rounded-full border shrink-0 transition-colors duration-fast ease-out-quart"
            style={{ backgroundColor: node.enabled ? theme.primary : theme.inputBg, borderColor: node.enabled ? theme.primary : theme.inputBorder }}
          >
            <span className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-[left,background-color] duration-fast ease-out-quart"
              style={{ left: node.enabled ? '17px' : '2px', backgroundColor: node.enabled ? theme.onPrimary : theme.textMuted }} />
          </span>
          <ChevronDown size={14} className="shrink-0 transition-transform duration-base ease-out-quart"
            style={{ color: theme.textMuted, transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: theme.hairline }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel theme={theme}>{t('apiProvider')}</FieldLabel>
                <Select
                  value={node.provider}
                  onChange={(e) => {
                    const id = e.target.value
                    const target = presetOf(id)
                    patchNode(node.id, target && target.baseUrl ? { provider: id, baseUrl: target.baseUrl } : { provider: id })
                  }}
                  theme={theme}
                >
                  {PROVIDER_GROUPS_UI.map(g => (
                    <optgroup key={g.key} label={t(GROUP_LABEL_KEY[g.key] as keyof TranslationDict)}>
                      {PROVIDER_PRESETS.filter(p => p.group === g.key).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel theme={theme}>{t('apiProvider')} API</FieldLabel>
                <Select value={node.api} onChange={(e) => patchNode(node.id, { api: e.target.value as NodeApi })} theme={theme}>
                  {API_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <FieldLabel theme={theme}>{t('baseUrl')}</FieldLabel>
              <MonoInput value={node.baseUrl} onChange={(e) => patchNode(node.id, { baseUrl: e.target.value })} theme={theme} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel theme={theme}>{t('modelName')}</FieldLabel>
                <div className="flex gap-1.5">
                  <div className="flex-1 min-w-0">
                    <TextInput
                      value={node.model}
                      onChange={(e) => patchNode(node.id, { model: e.target.value })}
                      placeholder={t('placeholderModel')}
                      list={`models-node-${node.id}`}
                      theme={theme}
                    />
                    <datalist id={`models-node-${node.id}`}>
                      {(presetOf(node.provider)?.models || []).map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  {/* single entry point: the model list (catalog + live) */}
                  <button
                    type="button"
                    onClick={() => setProbeNode(node)}
                    aria-label={t('probeModels')}
                    title={t('probeModels')}
                    className="w-8 h-10 shrink-0 flex items-center justify-center rounded-field border transition-colors duration-150 ease-out-quart"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel theme={theme}>{t('apiKey')}</FieldLabel>
                <PasswordInput
                  value={node.apiKey}
                  onChange={(v) => patchNode(node.id, { apiKey: v })}
                  show={!!showApiKey[node.id]}
                  onToggleShow={() => setShowApiKey(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
                  placeholder={t('placeholderApiKey')}
                  theme={theme}
                />
              </div>
            </div>

            {node.api === 'tts' && (
              <div>
                <FieldLabel theme={theme}>{t('voice')}</FieldLabel>
                <TextInput value={node.voice || ''} onChange={(e) => patchNode(node.id, { voice: e.target.value })} placeholder="alloy" theme={theme} />
              </div>
            )}

            {node.api !== 'tts' && node.api !== 'asr' && (
              <>
                <div>
                  <FieldLabel theme={theme}>{t('nodePrompt')}</FieldLabel>
                  <TextArea
                    value={node.prompt}
                    onChange={(e) => patchNode(node.id, { prompt: e.target.value })}
                    rows={3}
                    placeholder={t('nodePromptHint')}
                    theme={theme}
                  />
                </div>
                <div>
                  <FieldLabel theme={theme}>{t('nodePromptExplain')}</FieldLabel>
                  <TextArea
                    value={node.promptExplain || ''}
                    onChange={(e) => patchNode(node.id, { promptExplain: e.target.value })}
                    rows={2}
                    placeholder={t('nodePromptHint')}
                    theme={theme}
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => { if (!draft) return; setDraft({ ...draft, nodes: moveNode(draft.nodes, index, -1) }) }}
                disabled={index === 0}
                aria-label={t('moveUp')}
                title={t('moveUp')}
                className="w-8 h-8 flex items-center justify-center rounded-[9px] border transition-colors duration-fast ease-out-quart disabled:opacity-35"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => { if (!draft) return; setDraft({ ...draft, nodes: moveNode(draft.nodes, index, 1) }) }}
                disabled={index === (draft?.nodes.length ?? 0) - 1}
                aria-label={t('moveDown')}
                title={t('moveDown')}
                className="w-8 h-8 flex items-center justify-center rounded-[9px] border transition-colors duration-fast ease-out-quart disabled:opacity-35"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
              >
                <ArrowDown size={13} />
              </button>
              <div className="flex-1" />
              <TestButton status={test.status} onClick={() => testNode(node)} label={t('test')} theme={theme} />
              <button
                type="button"
                onClick={() => removeNode(node.id)}
                aria-label={t('delete')}
                title={t('delete')}
                className="w-8 h-8 flex items-center justify-center rounded-[9px] border transition-colors duration-fast ease-out-quart"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.danger }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <TestStatusText status={test.status} message={test.message} />
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-3 animate-rise">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t('customPipelines')}</h2>
        {draft ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-7 px-3 rounded-[9px] text-[11px] font-semibold border"
              style={{ borderColor: theme.inputBorder, color: theme.textSecondary, backgroundColor: theme.card }}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="h-7 px-3 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 transition-[filter,transform] duration-fast ease-out-quart hover:brightness-[1.06] active:scale-[0.97]"
              style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
            >
              <Check size={13} />
              {t('savePipeline')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startNew}
            className="h-7 px-3 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 border transition-colors duration-fast ease-out-quart"
            style={{ borderColor: tint(theme.primary, theme.card, 0.3), color: theme.primary, backgroundColor: tint(theme.primary, theme.card, 0.08) }}
          >
            <Plus size={13} />
            {t('newPipeline')}
          </button>
        )}
      </div>

      {/* ------------------------------------------------ editor (draft) */}
      {draft ? (
        <Card theme={theme} className="space-y-3.5">
          <div>
            <FieldLabel theme={theme}>{t('pipelineName')}</FieldLabel>
            <TextInput
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t('placeholderPipelineName')}
              theme={theme}
            />
          </div>

          <div className="space-y-2">
            <p className="eyebrow" style={{ color: theme.textMuted }}>{t('addNode')}</p>
            {draft.nodes.map((node, i) => renderNodeCard(node, i))}
          </div>

          <div className="pt-1 border-t" style={{ borderColor: theme.hairline }}>
            <p className="eyebrow mb-2" style={{ color: theme.textMuted }}>{t('nodeCategories')}</p>
            <div className="flex flex-wrap gap-1.5">
              {paletteKinds(customKinds).map(meta => {
                const Icon = meta.icon
                const label = meta.kind === 'custom' || customKinds.some(k => k.id === meta.kind)
                  ? customKindLabel(meta.kind, customKinds) || t('kindCustom')
                  : t(meta.labelKey)
                return (
                  <button
                    key={meta.kind}
                    type="button"
                    onClick={() => addNode(meta.kind)}
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border text-[11px] font-semibold transition-colors duration-fast ease-out-quart"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
                  >
                    <Icon size={12} />
                    {label}
                    <Plus size={11} style={{ color: theme.textMuted }} />
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setNewKindOpen(!newKindOpen)}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border text-[11px] font-semibold border-dashed"
                style={{ backgroundColor: 'transparent', borderColor: theme.inputBorder, color: theme.textMuted }}
              >
                <Puzzle size={12} />
                {t('newNodeKind')}
              </button>
            </div>

            {newKindOpen && (
              <div className="mt-2.5 p-3 rounded-[10px] border space-y-2.5" style={{ borderColor: theme.hairline, backgroundColor: theme.inputBg }}>
                <div>
                  <FieldLabel theme={theme}>{t('newNodeKindLabel')}</FieldLabel>
                  <TextInput value={newKindLabel} onChange={(e) => setNewKindLabel(e.target.value)} placeholder={t('placeholderPipelineName')} theme={theme} />
                </div>
                <div>
                  <FieldLabel theme={theme}>{t('newNodeKindApi')}</FieldLabel>
                  <Select value={newKindApi} onChange={(e) => setNewKindApi(e.target.value as NodeApi)} theme={theme}>
                    {API_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={addCustomKind}
                  className="h-8 px-3 rounded-[9px] text-[11px] font-semibold"
                  style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
                >
                  {t('add')}
                </button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* ------------------------------------------------- pipeline list */
        <div className="space-y-2.5">
          {pipelines.length === 0 && (
            <Card theme={theme}>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 shrink-0 rounded-[10px] flex items-center justify-center"
                  style={{ backgroundColor: tint(theme.primary, theme.card, 0.1), color: theme.primary }}>
                  <Layers size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold" style={{ color: theme.text }}>{t('noPipelines')}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: theme.textSecondary }}>{t('noPipelinesHint')}</p>
                </div>
              </div>
            </Card>
          )}

          {pipelines.map(p => {
            const active = isActive(p.id)
            return (
              <div
                key={p.id}
                className="rounded-card border px-4 py-3.5 space-y-2.5"
                style={{
                  backgroundColor: theme.card,
                  borderColor: active ? tint(theme.primary, theme.card, 0.4) : theme.hairline,
                  boxShadow: active ? `0 0 0 3px ${tint(theme.primary, theme.card, 0.88)}` : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={{ color: theme.text }}>
                    {p.name}
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
                      onClick={() => activate(p.id)}
                      className="h-6 px-2.5 rounded-full text-[10.5px] font-bold border transition-colors duration-fast ease-out-quart"
                      style={{ borderColor: tint(theme.primary, theme.card, 0.3), color: theme.primary, backgroundColor: tint(theme.primary, theme.card, 0.08) }}
                    >
                      {t('usePipeline')}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {p.nodes.filter(n => n.enabled).map((n, i) => {
                    const meta = kindMeta(n.kind, customKinds)
                    const Icon = meta.icon
                    return (
                      <React.Fragment key={n.id}>
                        {i > 0 && <span aria-hidden className="text-[10px]" style={{ color: theme.textMuted }}>→</span>}
                        <span className="flex items-center gap-1 h-6 px-2 rounded-full border text-[10.5px] font-medium"
                          style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}>
                          <Icon size={10} />
                          {nodeLabel(n)}
                        </span>
                      </React.Fragment>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="h-7 px-2.5 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 border"
                    style={{ borderColor: theme.inputBorder, color: theme.textSecondary, backgroundColor: theme.inputBg }}
                  >
                    <Pencil size={11} />
                    {t('editPipeline')}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => removePipeline(p.id)}
                    aria-label={t('delete')}
                    title={t('delete')}
                    className="w-7 h-7 flex items-center justify-center rounded-[9px] border"
                    style={{ borderColor: theme.inputBorder, color: theme.danger, backgroundColor: theme.inputBg }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {probeNode && (
        <ModelProbe
          config={{ provider: probeNode.provider, apiKey: probeNode.apiKey, baseUrl: probeNode.baseUrl }}
          mdIds={presetOf(probeNode.provider)?.mdIds || []}
          current={probeNode.model}
          onPick={(m) => { patchNode(probeNode.id, { model: m }); setProbeNode(null) }}
          onClose={() => setProbeNode(null)}
          theme={theme}
          t={t}
        />
      )}
    </section>
  )
}

export default PipelineBuilder
