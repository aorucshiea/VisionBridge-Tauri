import type {
  AppSettings, CustomNodeKind, NodeApi, Pipeline, PipelineNode, ToolbarAction,
} from '../types'
import type { TranslationDict } from '../i18n'
import {
  ScanEye, ScanText, BrainCircuit, Mic, Volume2, ImagePlus, Puzzle, type LucideIcon,
} from 'lucide-react'
import { DEFAULT_TOOLBAR_ACTIONS } from './defaults'

// ---------------------------------------------------------------------------
// Node kind registry
// ---------------------------------------------------------------------------

export interface KindMeta {
  kind: string
  labelKey: keyof TranslationDict
  icon: LucideIcon
  api: NodeApi
  /** What the node consumes. */
  accepts: 'image' | 'text' | 'audio'
  /** What the node adds to the chain. */
  produces: 'text' | 'image' | 'audio'
}

export const BUILTIN_KINDS: KindMeta[] = [
  { kind: 'vlm',      labelKey: 'kindVlm',      icon: ScanEye,     api: 'chat-vision', accepts: 'image', produces: 'text' },
  { kind: 'ocr',      labelKey: 'kindOcr',      icon: ScanText,    api: 'ocr',         accepts: 'image', produces: 'text' },
  { kind: 'llm',      labelKey: 'kindLlm',      icon: BrainCircuit, api: 'chat',       accepts: 'text',  produces: 'text' },
  { kind: 'asr',      labelKey: 'kindAsr',      icon: Mic,         api: 'asr',         accepts: 'audio', produces: 'text' },
  { kind: 'tts',      labelKey: 'kindTts',      icon: Volume2,     api: 'tts',         accepts: 'text',  produces: 'audio' },
  { kind: 'imagegen', labelKey: 'kindImagegen', icon: ImagePlus,   api: 'imagegen',    accepts: 'text',  produces: 'image' },
]

export const CUSTOM_KIND_META: KindMeta = {
  kind: 'custom', labelKey: 'kindCustom', icon: Puzzle, api: 'chat', accepts: 'text', produces: 'text',
}

/** Resolve a kind id (builtin or user-defined) to its display metadata. */
export function kindMeta(kindId: string, customKinds: CustomNodeKind[]): KindMeta {
  const builtin = BUILTIN_KINDS.find(k => k.kind === kindId)
  if (builtin) return builtin
  const custom = customKinds.find(k => k.id === kindId)
  if (custom) {
    return {
      kind: custom.id,
      labelKey: 'kindCustom',
      icon: Puzzle,
      api: custom.api,
      accepts: custom.api === 'ocr' || custom.api === 'chat-vision' ? 'image'
        : custom.api === 'asr' ? 'audio' : 'text',
      produces: custom.api === 'imagegen' ? 'image' : custom.api === 'tts' ? 'audio' : 'text',
    }
  }
  return { ...CUSTOM_KIND_META, kind: kindId }
}

/** Palette entries: builtin kinds plus every user-defined category. */
export function paletteKinds(customKinds: CustomNodeKind[]): KindMeta[] {
  return [...BUILTIN_KINDS, ...customKinds.map(k => kindMeta(k.id, customKinds))]
}

export function customKindLabel(kindId: string, customKinds: CustomNodeKind[]): string | null {
  return customKinds.find(k => k.id === kindId)?.label ?? null
}

// ---------------------------------------------------------------------------
// Defaults & prompt resolution
// ---------------------------------------------------------------------------

export const DEFAULT_OCR_PROMPT = "识别图片中的所有文字，只输出文字内容，不要添加任何解释或说明。如果图片中没有文字，输出'无'。"

export interface TaskPrompts { translate: string; explain: string }

/** Markers embedded in result content; ResultView renders these as images. */
export const IMAGE_MARKER_RE = /\[\[vbimg:(.+?)\]\]/g
export const imageMarker = (src: string): string => `\n\n[[vbimg:${src}]]`

function defaultPromptFor(node: PipelineNode, task: 'translate' | 'explain', taskPrompts: TaskPrompts): string {
  switch (node.api) {
    case 'ocr': return DEFAULT_OCR_PROMPT
    case 'tts': return ''
    case 'asr': return ''
    default: return taskPrompts[task]
  }
}

/**
 * Resolve a node's prompt against the chain state. The explain task prefers
 * `promptExplain` when set. A toolbar-action `override` beats everything.
 * `{input}` is replaced with the previous text output; when the template
 * lacks the placeholder the input is appended after a blank line so text
 * never silently disappears.
 */
export function resolvePrompt(
  node: PipelineNode,
  task: 'translate' | 'explain',
  taskPrompts: TaskPrompts,
  lastText: string,
  override?: string,
): string {
  let template = node.prompt
  if (override && override.trim() !== '') {
    template = override
  } else {
    if (task === 'explain' && node.promptExplain && node.promptExplain.trim() !== '') template = node.promptExplain
    if (template.trim() === '') template = defaultPromptFor(node, task, taskPrompts)
  }
  if (!template) return lastText
  if (template.includes('{input}')) return template.replace('{input}', lastText)
  return lastText ? `${template}\n\n${lastText}` : template
}

// ---------------------------------------------------------------------------
// Node factory helpers
// ---------------------------------------------------------------------------

let nodeSeq = 0
export function createNode(kindId: string, customKinds: CustomNodeKind[]): PipelineNode {
  const meta = kindMeta(kindId, customKinds)
  nodeSeq += 1
  return {
    id: `n${Date.now().toString(36)}${nodeSeq}`,
    kind: kindId,
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: '',
    apiKey: '',
    api: meta.api,
    prompt: '',
    promptExplain: '',
    voice: meta.api === 'tts' ? 'alloy' : undefined,
    enabled: true,
  }
}

export function createPipeline(name: string, nodes: PipelineNode[]): Pipeline {
  return { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, nodes, createdAt: new Date().toISOString() }
}

export function moveNode(nodes: PipelineNode[], index: number, delta: -1 | 1): PipelineNode[] {
  const next = [...nodes]
  const target = index + delta
  if (target < 0 || target >= next.length) return nodes
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// ---------------------------------------------------------------------------
// Active chain resolution: presets from the legacy flat fields, or a stored
// custom pipeline. Single-node and multi-node chains are both valid.
// ---------------------------------------------------------------------------

/**
 * The three presets, expressed as node chains over the legacy flat settings
 * fields — so existing users keep their exact prompts, keys and endpoints.
 */
export function presetNodes(settings: AppSettings): Record<'VLM' | 'OCR+LLM' | 'VLM+LLM', PipelineNode[]> {
  return {
    VLM: [{
      id: 'preset-vlm', kind: 'vlm', provider: settings.vlmProvider, baseUrl: settings.vlmBaseUrl,
      model: settings.vlmModel, apiKey: settings.vlmApiKey, api: 'chat-vision',
      prompt: settings.vlmTranslatePrompt, promptExplain: settings.vlmExplainPrompt, enabled: true,
    }],
    'OCR+LLM': [
      {
        id: 'preset-ocr', kind: 'ocr', provider: settings.ocrProvider === 'local' ? 'ollama' : settings.ocrProvider,
        baseUrl: settings.ocrBaseUrl, model: settings.ocrModel, apiKey: settings.ocrApiKey,
        api: 'ocr', prompt: '', promptExplain: '', enabled: true,
      },
      {
        id: 'preset-llm', kind: 'llm', provider: settings.llmProvider, baseUrl: settings.llmBaseUrl,
        model: settings.llmModel, apiKey: settings.llmApiKey, api: 'chat',
        prompt: settings.llmTranslatePrompt, promptExplain: settings.llmExplainPrompt, enabled: true,
      },
    ],
    'VLM+LLM': [
      {
        id: 'preset-vlm2', kind: 'vlm', provider: settings.vlm2Provider, baseUrl: settings.vlm2BaseUrl,
        model: settings.vlm2Model, apiKey: settings.vlm2ApiKey, api: 'chat-vision',
        prompt: settings.vlm2JsonPrompt, promptExplain: '', enabled: true,
      },
      {
        id: 'preset-llm2', kind: 'llm', provider: settings.llm2Provider, baseUrl: settings.llm2BaseUrl,
        model: settings.llm2Model, apiKey: settings.llm2ApiKey, api: 'chat',
        prompt: settings.llm2TranslatePrompt.replace('{json_data}', '{input}'),
        promptExplain: settings.llm2ExplainPrompt.replace('{json_data}', '{input}'),
        enabled: true,
      },
    ],
  }
}

/** The node chain the current settings point at, or null when nothing applies. */
export function getActiveNodes(settings: AppSettings): PipelineNode[] | null {
  if (settings.mode === 'TEXT') return null // text mode never runs screenshot chains
  if (settings.mode === 'CUSTOM') {
    const pipeline = (settings.pipelines || []).find(p => p.id === settings.activePipelineId)
    if (!pipeline) return null
    const nodes = (pipeline.nodes || []).filter(n => n.enabled)
    return nodes.length > 0 ? nodes : null
  }
  return presetNodes(settings)[settings.mode]
}

export function activePipeline(settings: AppSettings): Pipeline | null {
  if (settings.mode !== 'CUSTOM') return null
  return (settings.pipelines || []).find(p => p.id === settings.activePipelineId) || null
}

/** Human-readable name for the current mode (footer, translate tab). */
export function modeLabel(settings: AppSettings, t: (k: keyof TranslationDict) => string): string {
  if (settings.mode === 'CUSTOM') return activePipeline(settings)?.name || 'CUSTOM'
  if (settings.mode === 'TEXT') return t('textMode')
  if (settings.mode === 'VLM') return t('multimodal')
  return settings.mode
}

export function taskPromptsOf(settings: AppSettings): TaskPrompts {
  return { translate: settings.llmTranslatePrompt, explain: settings.llmExplainPrompt }
}

/** Enabled toolbar buttons, with sane fallbacks when the list is empty. */
export function enabledToolbarActions(settings: Pick<AppSettings, 'toolbarActions'>): ToolbarAction[] {
  const list = (settings.toolbarActions || []).filter(a => a.enabled)
  if (list.length > 0) return list
  return DEFAULT_TOOLBAR_ACTIONS.filter(a => a.enabled)
}

/**
 * Resolve a toolbar action id to a chain task + optional prompt override.
 * 'translate' / 'explain' map to the builtin tasks; anything else is looked
 * up in the user's toolbar buttons.
 */
export function resolveAction(actionId: string, settings: Pick<AppSettings, 'toolbarActions'>): {
  task: 'translate' | 'explain'
  promptOverride?: string
  label: string
} {
  if (actionId === 'translate') return { task: 'translate', label: '翻译' }
  if (actionId === 'explain') return { task: 'explain', label: '解释' }
  const a = (settings.toolbarActions || []).find(x => x.id === actionId)
  if (a) return { task: 'translate', promptOverride: a.prompt || undefined, label: a.label }
  return { task: 'translate', label: actionId }
}

// ---------------------------------------------------------------------------
// The engine: run a node chain sequentially.
//
// Routing rules
//   image  → vision nodes (chat-vision / ocr) always receive the screenshot
//   text   → flows node to node; text nodes read the previous output
//   audio  → produced by tts, consumed by asr
// A text node with no upstream text simply runs its task prompt; a node whose
// required input is missing raises an actionable error instead of hanging.
// ---------------------------------------------------------------------------

export interface ChainRunResult {
  content: string
  audioBase64: string | null
  images: string[]
  /** Thinking text of the last text-producing node, when the model exposes it. */
  reasoning: string
}

export interface ChainRunOptions {
  nodes: PipelineNode[]
  image: string | null
  task: 'translate' | 'explain'
  taskPrompts: TaskPrompts
  /** Toolbar-action prompt — overrides node prompts for this run. */
  promptOverride?: string
  /** Streaming callback: fires per delta for chat / chat-vision nodes. */
  onDelta?: (d: { content?: string; reasoning?: string }) => void
}

/**
 * One chat node run, streaming when the host IPC contract supports it
 * (Electron preload / Tauri shim both expose callAIStream). Falls back to the
 * plain non-streaming call on older contracts.
 */
async function runChatNode(
  cfg: { provider: string; apiKey: string; baseUrl: string; model: string },
  payload: { prompt: string; images?: string[] },
  onDelta?: ChainRunOptions['onDelta'],
): Promise<{ content: string; reasoning: string }> {
  const ipc = window.ipcRenderer as any
  if (typeof ipc.callAIStream === 'function') {
    return await ipc.callAIStream(cfg, payload, onDelta)
  }
  return { content: await ipc.callAI(cfg, payload), reasoning: '' }
}

export async function runNodeChain(opts: ChainRunOptions): Promise<ChainRunResult> {
  const { nodes, image, task, taskPrompts, promptOverride, onDelta } = opts
  const ipc = window.ipcRenderer

  let lastText = ''
  let lastReasoning = ''
  let lastAudio: string | null = null
  const producedImages: string[] = []

  for (const node of nodes) {
    const cfg = { provider: node.provider, apiKey: node.apiKey, baseUrl: node.baseUrl, model: node.model }
    const prompt = resolvePrompt(node, task, taskPrompts, lastText, promptOverride)

    switch (node.api) {
      case 'chat-vision': {
        if (!image) throw new Error('该节点需要图片输入：请把视觉类节点放在管道最前，或在它之前接入生图节点。')
        const r = await runChatNode(cfg, { prompt, images: [image] }, onDelta)
        lastText = r.content
        lastReasoning = r.reasoning || ''
        break
      }
      case 'ocr': {
        if (!image) throw new Error('OCR 节点需要图片输入：请把 OCR 节点放在管道最前。')
        const text = await ipc.callOCR(cfg, image)
        if (!text || text.trim().length === 0) throw new Error('OCR 未能识别到选区内的文字。')
        lastText = text
        lastReasoning = ''
        break
      }
      case 'chat': {
        const r = await runChatNode(cfg, { prompt }, onDelta)
        lastText = r.content
        lastReasoning = r.reasoning || ''
        break
      }
      case 'imagegen': {
        const src = await ipc.callImageGen(cfg, prompt || lastText || task)
        producedImages.push(src)
        break
      }
      case 'tts': {
        const spoken = lastText.trim() !== '' ? lastText : prompt
        if (!spoken.trim()) throw new Error('语音合成节点需要前序节点产出文字。')
        lastAudio = await ipc.callTTS({ ...cfg, voice: node.voice }, spoken)
        break
      }
      case 'asr': {
        if (!lastAudio) throw new Error('语音识别节点需要音频输入：请在前方接入一个语音合成节点。')
        lastText = await ipc.callASR(cfg, lastAudio)
        break
      }
      default:
        throw new Error(`未知的节点接口类型：${node.api}`)
    }
  }

  // The renderer owns audio playback, so speak the chain's audio here.
  if (lastAudio) {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${lastAudio}`)
      void audio.play().catch(() => { /* autoplay blocked — ignore */ })
    } catch { /* ignore */ }
  }

  let content = lastText
  for (const src of producedImages) content += imageMarker(src)
  return { content, audioBase64: lastAudio, images: producedImages, reasoning: lastReasoning }
}
