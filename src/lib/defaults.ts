import type { AppSettings, ToolbarAction } from '../types'

export const DEFAULT_TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: 'translate', label: '翻译', prompt: '', builtin: true, enabled: true },
  { id: 'explain', label: '解释', prompt: '', builtin: true, enabled: true },
]

export const DEFAULT_SETTINGS: AppSettings = {
  vlmProvider: 'ollama',
  vlmModel: 'deepseek-ocr:3b',
  vlmApiKey: '',
  vlmBaseUrl: 'http://127.0.0.1:11434',
  vlmTranslatePrompt: 'Translate the text in the image to natural, fluent Chinese. Output ONLY the translated text, nothing else.',
  vlmExplainPrompt: 'Analyze the image and explain the content in detail in Chinese. Output ONLY the explanation, nothing else.',
  mode: 'VLM',
  ocrProvider: 'ollama',
  ocrApiKey: '',
  ocrBaseUrl: 'http://127.0.0.1:11434',
  ocrModel: 'deepseek-ocr:3b',
  llmProvider: 'ollama',
  llmModel: 'rnj-1:8b-instruct-q8_0',
  llmApiKey: '',
  llmBaseUrl: 'http://127.0.0.1:11434',
  llmTranslatePrompt: 'Translate the following text to Chinese. Output ONLY the translation, nothing else.',
  llmExplainPrompt: 'Explain the following text in detail in Chinese. Output ONLY the explanation, nothing else.',
  vlm2Provider: 'ollama',
  vlm2Model: 'qwen2-vl:7b',
  vlm2ApiKey: '',
  vlm2BaseUrl: 'http://127.0.0.1:11434',
  vlm2JsonPrompt: '将以下图片转换为结构化的JSON格式。请提取图片中的所有关键信息，包括：\n1. 主要对象和元素\n2. 文字内容（如果有）\n3. 颜色和布局\n4. 任何其他重要细节\n\n输出格式：\n{\n  "main_objects": [],\n  "text_content": "",\n  "colors": [],\n  "layout": "",\n  "other_details": ""\n}',
  llm2Provider: 'ollama',
  llm2Model: 'qwen2:7b',
  llm2ApiKey: '',
  llm2BaseUrl: 'http://127.0.0.1:11434',
  llm2TranslatePrompt: '图片描述：\n{json_data}\n\n请根据以上图片描述进行翻译。直接输出翻译结果，不要说冗余的话。',
  llm2ExplainPrompt: '图片描述：\n{json_data}\n\n请根据以上图片描述进行详细解释。直接输出解释内容，不要说冗余的话。',
  enableTextSelection: false,
  selectionTrigger: 'auto',
  assistantName: '小V',
  soulPrompt: '称呼我为小V。我说话简洁直接、乐于动手：能调用工具解决的事就直接去做，不空谈。',

  theme: 'light',
  language: 'zh',
  trayIconPath: '',
  savedConfigurations: [],
  closeAction: 'tray',
  // Node-based pipelines. The default pipeline stays the plain multimodal
  // (VLM) preset — the builder only appears in advanced mode.
  advancedMode: false,
  pipelines: [],
  activePipelineId: null,
  customNodeKinds: [],
  toolbarActions: DEFAULT_TOOLBAR_ACTIONS,
}
