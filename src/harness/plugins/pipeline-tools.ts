/**
 * Pipeline tools — one tool per configured pipeline, so the agent can drive
 * every pipeline the user has set up ("不同管道不同做法"). Each execute reads
 * the live settings, so reconfiguring a pipeline re-aims its tool without a
 * reload. Unconfigured pipelines still register but report what's missing —
 * schema stability for the model beats conditional catalog churn.
 */
import type { Plugin } from '@cordisjs/core'
import { freshCapture } from './builtin-tools'
import type { ToolDef } from '../services'

function pipelineConfigs(s: any) {
  return {
    vlm: { provider: s?.vlmProvider || 'ollama', apiKey: s?.vlmApiKey || '', baseUrl: s?.vlmBaseUrl || '', model: s?.vlmModel || '' },
    ocr: {
      provider: s?.ocrProvider === 'local' ? 'ollama' : (s?.ocrProvider || 'ollama'),
      apiKey: s?.ocrApiKey || '', baseUrl: s?.ocrBaseUrl || '', model: s?.ocrModel || '',
    },
    llm: { provider: s?.llmProvider || 'ollama', apiKey: s?.llmApiKey || '', baseUrl: s?.llmBaseUrl || '', model: s?.llmModel || '' },
    vlm2: { provider: s?.vlm2Provider || 'ollama', apiKey: s?.vlm2ApiKey || '', baseUrl: s?.vlm2BaseUrl || '', model: s?.vlm2Model || '' },
    llm2: { provider: s?.llm2Provider || 'ollama', apiKey: s?.llm2ApiKey || '', baseUrl: s?.llm2BaseUrl || '', model: s?.llm2Model || '' },
  }
}

const missingModel = (name: string, where: string): { content: string } => ({
  content: JSON.stringify({ error: 'PIPELINE_NOT_CONFIGURED', message: `${name} 管道未配置模型，请在设置的${where}中填写模型名称。` }),
})

export const PipelineTools: Plugin.Object = {
  name: 'pipeline-tools',
  inject: ['tools', 'llm', 'sessions'],
  apply(ctx) {
    const defs: ToolDef[] = [
      {
        name: 'vlm_analyze',
        description: 'VLM 视觉管道：截取当前屏幕，用已配置的视觉模型针对该图回答问题或执行翻译/解释。参数 question。',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string', description: '对屏幕内容的要求或问题' } },
          required: ['question'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const question = String(args.question || '详细描述这张图片的内容。')
          const s = await (window.ipcRenderer as any).getSettings()
          const cfg = pipelineConfigs(s).vlm
          if (!cfg.model.trim()) return missingModel('VLM', '模型页')
          const image = await freshCapture(true)
          const r = await ctx.llm.chat(cfg, { prompt: question, images: [image] }, () => {})
          return { content: r.content }
        },
      },
      {
        name: 'ocr_llm_pipeline',
        description: 'OCR+LLM 文字管道：截取当前屏幕，先 OCR 识别文字，再用对话模型整理润色，返回整理后的文字。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const s = await (window.ipcRenderer as any).getSettings()
          const cfgs = pipelineConfigs(s)
          if (!cfgs.llm.model.trim()) return missingModel('OCR+LLM', '对话模型')
          const image = await freshCapture(true)
          const text = await ctx.llm.ocr({ ...cfgs.ocr, provider: cfgs.ocr.provider === 'custom' ? 'custom' : cfgs.ocr.provider }, image)
          const r = await ctx.llm.chat(cfgs.llm, { prompt: `请整理以下识别出的屏幕文字，保持原意、修正识别错误：\n\n${text}` }, () => {})
          return { content: r.content || text }
        },
      },
      {
        name: 'vlm2_llm_pipeline',
        description: 'VLM+LLM 描述管道：截取当前屏幕，先用视觉模型产出结构化描述，再由第二个对话模型改写成流畅的中文分析。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const s = await (window.ipcRenderer as any).getSettings()
          const cfgs = pipelineConfigs(s)
          if (!cfgs.vlm2.model.trim() || !cfgs.llm2.model.trim()) return missingModel('VLM+LLM', 'VLM+LLM 管道')
          const image = await freshCapture(true)
          const json = await ctx.llm.chat(cfgs.vlm2, { prompt: s?.vlm2JsonPrompt || '将图片内容整理为结构化描述。', images: [image] }, () => {})
          const polishPrompt = (s?.llm2TranslatePrompt || '基于以下图片描述给出详细分析：\n\n{input}').replace('{json_data}', '{input}')
          const prompt = polishPrompt.includes('{input}') ? polishPrompt.replace('{input}', json.content) : `${polishPrompt}\n\n${json.content}`
          const r = await ctx.llm.chat(cfgs.llm2, { prompt }, () => {})
          return { content: r.content || json.content }
        },
      },
      {
        name: 'text_chat',
        description: 'TEXT 纯文本管道：不截图，直接用已配置的对话模型回答问题。参数 question。',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string', description: '要问的问题' } },
          required: ['question'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const question = String(args.question || '').trim()
          if (!question) return { content: JSON.stringify({ error: 'INVALID_ARGS', message: 'question 不能为空' }) }
          const s = await (window.ipcRenderer as any).getSettings()
          const cfg = pipelineConfigs(s).llm
          if (!cfg.model.trim()) return missingModel('TEXT', '对话模型')
          const r = await ctx.llm.chat(cfg, { prompt: question }, () => {})
          return { content: r.content }
        },
      },
    ]
    const disposers = defs.map(def => ctx.tools.register(def))
    ctx.collect('pipeline-tools', () => disposers.forEach(d => d()))
  },
}
