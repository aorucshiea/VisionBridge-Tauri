/**
 * Provider catalog — curated vendor presets à la opencode / Cherry Studio.
 * Pure data (no DOM, no imports) so the Electron main bundle can use it too.
 *
 * `wire` is the request format the existing callAI implementation speaks:
 *   openai   → POST {base}/v1/chat/completions
 *   anthropic→ POST {base}/v1/messages
 *   ollama   → POST {base}/api/chat
 */
export type WireFormat = 'openai' | 'anthropic' | 'ollama' | 'custom'

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  wire: WireFormat
  group: 'cn' | 'global' | 'local'
  models: string[]
  /** Candidate ids on models.dev, resolved first-match for the capability catalog. */
  mdIds?: string[]
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ---- 国内服务 ------------------------------------------------------------
  {
    id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', wire: 'openai', group: 'cn',
    mdIds: ['deepseek'],
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'siliconflow', name: '硅基流动 SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', wire: 'openai', group: 'cn',
    mdIds: ['siliconflow', 'siliconflow-cn'],
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-VL-72B-Instruct', 'Pro/deepseek-ai/DeepSeek-VL2'],
  },
  {
    id: 'dashscope', name: '阿里云百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', wire: 'openai', group: 'cn',
    mdIds: ['alibaba', 'alibaba-cn'],
    models: ['qwen3-vl-plus', 'qwen-vl-max', 'qwen-vl-plus', 'qwen-plus', 'qwen-turbo'],
  },
  {
    id: 'moonshot', name: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1', wire: 'openai', group: 'cn',
    mdIds: ['moonshotai', 'moonshotai-cn'],
    models: ['kimi-latest', 'moonshot-v1-8k-vision-preview', 'moonshot-v1-32k-vision-preview'],
  },
  {
    id: 'zhipu', name: '智谱 BigModel', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', wire: 'openai', group: 'cn',
    mdIds: ['zhipuai', 'zhipuai-cn'],
    models: ['glm-4.5v', 'glm-4v-plus', 'glm-4v-flash', 'glm-4-plus'],
  },
  {
    id: 'volcengine', name: '火山方舟 · 豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', wire: 'openai', group: 'cn',
    mdIds: ['volcengine'],
    models: ['doubao-seed-1-6-vision-250815', 'doubao-1-5-vision-pro-32k', 'doubao-1-5-pro-32k'],
  },
  {
    id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', wire: 'openai', group: 'cn',
    mdIds: ['minimax'],
    models: ['MiniMax-Text-01', 'abab6.5s-chat'],
  },
  // ---- 国际服务 ------------------------------------------------------------
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', wire: 'openai', group: 'global',
    mdIds: ['openai'],
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', wire: 'anthropic', group: 'global',
    mdIds: ['anthropic'],
    models: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  },
  {
    id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', wire: 'openai', group: 'global',
    mdIds: ['google'],
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', wire: 'openai', group: 'global',
    mdIds: ['openrouter'],
    models: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.7-sonnet', 'deepseek/deepseek-chat', 'qwen/qwen2.5-vl-72b-instruct'],
  },
  {
    id: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', wire: 'openai', group: 'global',
    mdIds: ['xai'],
    models: ['grok-2-vision-1212', 'grok-2-1212'],
  },
  {
    id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', wire: 'openai', group: 'global',
    mdIds: ['groq'],
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile'],
  },
  // ---- 本地与自定义 ----------------------------------------------------------
  {
    id: 'ollama', name: 'Ollama (本地)', baseUrl: 'http://127.0.0.1:11434', wire: 'ollama', group: 'local',
    models: ['qwen2.5vl:7b', 'llama3.2-vision:11b', 'deepseek-r1:8b'],
  },
  {
    id: 'lmstudio', name: 'LM Studio (本地)', baseUrl: 'http://127.0.0.1:1234/v1', wire: 'openai', group: 'local',
    mdIds: ['lmstudio'],
    models: [],
  },
  {
    id: 'custom', name: '自定义端点', baseUrl: '', wire: 'custom', group: 'local',
    models: [],
  },
]

/** Preset id → request wire format. Unknown ids (legacy values) pass through. */
export const WIRE_FORMAT: Record<string, WireFormat> = Object.fromEntries(
  PROVIDER_PRESETS.map(p => [p.id, p.wire]),
)

export function wireOf(providerId: string): WireFormat {
  return WIRE_FORMAT[providerId] || (providerId as WireFormat) || 'custom'
}

export function presetOf(providerId: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === providerId)
}

export const GROUP_LABEL_KEY: Record<ProviderPreset['group'], string> = {
  cn: 'providerGroupCn',
  global: 'providerGroupGlobal',
  local: 'providerGroupLocal',
} as const

export const PROVIDER_GROUPS: Array<{ key: ProviderPreset['group'] }> = [
  { key: 'cn' },
  { key: 'global' },
  { key: 'local' },
]
