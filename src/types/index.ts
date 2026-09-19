export type PipelineMode = 'VLM' | 'TEXT' | 'OCR+LLM' | 'VLM+LLM' | 'CUSTOM'

/**
 * How a node talks to its endpoint. Drives both the wire format in the main
 * process and which input the node consumes from the chain.
 */
export type NodeApi = 'chat-vision' | 'chat' | 'ocr' | 'imagegen' | 'tts' | 'asr'

export type BuiltinNodeKind = 'vlm' | 'llm' | 'ocr' | 'asr' | 'tts' | 'imagegen'

export interface PipelineNode {
  id: string
  /** Builtin kind id, or a CustomNodeKind id. */
  kind: string
  /** Optional display override; falls back to the kind label. */
  name?: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  api: NodeApi
  /**
   * Prompt template. `{input}` is replaced with the previous node's text
   * output; when absent the input is appended after a blank line.
   * Empty string → the kind's default prompt for the current task.
   */
  prompt: string
  /** Prompt override used for the "explain" task; empty → falls back to `prompt`. */
  promptExplain?: string
  /** Voice name for TTS nodes (OpenAI-compatible `/v1/audio/speech`). */
  voice?: string
  enabled: boolean
}

export interface Pipeline {
  id: string
  name: string
  nodes: PipelineNode[]
  createdAt: string
}

/** A user-defined node category, so the palette can grow beyond the builtins. */
export interface CustomNodeKind {
  id: string
  label: string
  api: NodeApi
}

export type ProviderOption = 'ollama' | 'openai' | 'anthropic' | 'custom'

export type OcrProviderOption = 'local' | 'ollama' | 'baidu' | 'google' | 'custom'

export type ThemeName = 'light' | 'dark' | 'moonlight' | 'arctic'

export type Language = 'zh' | 'en'

export type TestTarget = 'vlm' | 'ocr' | 'llm' | 'vlm2' | 'llm2'

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export type SaveStatus = 'idle' | 'saving' | 'saved'

/** A button on the screenshot / selection toolbars, with its own prompt. */
export interface ToolbarAction {
  id: string
  label: string
  /** Prompt template; `{input}` receives the selected text. Empty → task default. */
  prompt: string
  builtin?: boolean
  enabled: boolean
}

export interface AppSettings {
  vlmProvider: ProviderOption
  vlmModel: string
  vlmApiKey: string
  vlmBaseUrl: string
  vlmTranslatePrompt: string
  vlmExplainPrompt: string
  mode: PipelineMode
  ocrProvider: OcrProviderOption
  ocrApiKey: string
  ocrBaseUrl: string
  ocrModel: string
  llmProvider: ProviderOption
  llmModel: string
  llmApiKey: string
  llmBaseUrl: string
  llmTranslatePrompt: string
  llmExplainPrompt: string
  vlm2Provider: ProviderOption
  vlm2Model: string
  vlm2ApiKey: string
  vlm2BaseUrl: string
  vlm2JsonPrompt: string
  llm2Provider: ProviderOption
  llm2Model: string
  llm2ApiKey: string
  llm2BaseUrl: string
  llm2TranslatePrompt: string
  llm2ExplainPrompt: string
  enableTextSelection: boolean
  /** How selected text is picked up: automatic on selection, or hotkey only. */
  selectionTrigger: 'auto' | 'hotkey'
  // System assistant (小V)
  assistantName: string
  soulPrompt: string

  theme: ThemeName
  language: Language
  trayIconPath: string
  savedConfigurations: SavedConfiguration[]
  /** What the window close button does: hide to tray (default) or quit. */
  closeAction: 'tray' | 'quit'
  // --- Node-based pipelines (advanced mode) -------------------------------
  /** When off, settings show only the three presets. */
  advancedMode: boolean
  /** User-composed pipelines; used when `mode` is 'CUSTOM'. */
  pipelines: Pipeline[]
  /** Which custom pipeline is active. */
  activePipelineId: string | null
  /** Extra node categories added by the user. */
  customNodeKinds: CustomNodeKind[]
  /** Buttons shown on the screenshot / selection toolbars. */
  toolbarActions: ToolbarAction[]
}

export interface SavedConfiguration {
  id: string
  name: string
  pipeline: PipelineMode
  createdAt: string
  tags: string[]
  config: {
    vlmProvider?: string
    vlmModel?: string
    vlmBaseUrl?: string
    vlmApiKey?: string
    ocrProvider?: string
    ocrModel?: string
    ocrBaseUrl?: string
    ocrApiKey?: string
    llmProvider?: string
    llmModel?: string
    llmBaseUrl?: string
    llmApiKey?: string
    vlm2Provider?: string
    vlm2Model?: string
    vlm2BaseUrl?: string
    vlm2ApiKey?: string
    vlm2JsonPrompt?: string
    llm2Provider?: string
    llm2Model?: string
    llm2BaseUrl?: string
    llm2ApiKey?: string
    llm2TranslatePrompt?: string
    llm2ExplainPrompt?: string
  }
}

export interface ThemeConfig {
  name: string
  nameEn: string
  primary: string
  /** Text/icon colour that sits on top of `primary`. */
  onPrimary: string
  background: string
  card: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  /** Low-contrast separator for inner lists / group boundaries. */
  hairline: string
  accent: string
  success: string
  danger: string
  surface: string
  /** Slightly raised surface for nested panels. */
  elevated: string
  inputBg: string
  inputBorder: string
  inputFocus: string
  /** Translucent surface for floating layers (result card, overlay toolbar). */
  glassBg: string
  glassBorder: string
  /** Backdrop colour behind the capture selection. */
  overlay: string
}

export interface TestConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

export interface ScreenshotRegion {
  x: number
  y: number
  width: number
  height: number
}

export type ProcessMode = 'translate' | 'explain'

declare global {
  interface Window {
    ipcRenderer: import('../lib/ipc').IpcApi
    currentAbortController: AbortController | null
    /**
     * Injected by Rust (`init_script` in main.rs) before any script runs —
     * the authoritative window identity, since Tauri drops the `?window=`
     * query from the asset URL.
     */
    __VB_WINDOW__?: string
    __VB_ERRORS__?: string[]
    __VB_BUNDLE_LOADED__?: boolean
    /** Set by the injected script when the app was started with `VB_DIAG=1`. */
    __VB_DIAG__?: boolean
  }
}
