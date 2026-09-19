/**
 * Live description of the harness topology: the cordis core, the services it
 * holds, the plugins around it, their consumers, and the planned extension
 * slots. Consumed by the 系统 (SystemMap) settings page.
 *
 * Plugin authors: register the plugin in harness/index.ts AND add a row here
 * so the map stays truthful.
 */
import { harness } from './index'
import { Agents } from './plugins/agents'
import { Knowledge } from './plugins/knowledge'
import { PipelineTools } from './plugins/pipeline-tools'
import { Capture } from './plugins/capture'
import { Llm } from './plugins/llm'
import { Sessions } from './plugins/sessions'
import { Tools } from './plugins/tools'
import { BuiltinTools } from './plugins/builtin-tools'
import type { TranslationDict } from '../i18n'

export type ServiceKey = 'llm' | 'capture' | 'sessions' | 'tools' | 'agents' | 'knowledge'

export interface ServiceInfo {
  key: ServiceKey
  labelKey: keyof TranslationDict
  live: boolean
  detail?: string
}

export interface PluginInfo {
  id: string
  labelKey: keyof TranslationDict
  kind: 'builtin' | 'platform'
  live: boolean
  provides: ServiceKey[]
  dependsOn: string[]
  descKey: keyof TranslationDict
}

export interface ConsumerInfo {
  id: string
  labelKey: keyof TranslationDict
  uses: ServiceKey[]
}

export interface ExtensionInfo {
  id: string
  labelKey: keyof TranslationDict
  milestone: string
  plugsInto: Array<ServiceKey | 'core'>
}

export interface HarnessMap {
  core: { name: string; pluginCount: number; eventCount: number }
  services: ServiceInfo[]
  plugins: PluginInfo[]
  consumers: ConsumerInfo[]
  extensions: ExtensionInfo[]
}

export function describeHarness(): HarnessMap {
  const ctx = harness()
  const registry = ctx.registry

  const services: ServiceInfo[] = [
    {
      key: 'llm',
      labelKey: 'systemSvcLlm',
      live: typeof ctx.llm?.chat === 'function',
      detail: 'chat · tools · ocr · tts · asr',
    },
    {
      key: 'capture',
      labelKey: 'systemSvcCapture',
      live: typeof ctx.capture?.region === 'function',
    },
    {
      key: 'sessions',
      labelKey: 'systemSvcSessions',
      live: typeof ctx.sessions?.listCalls === 'function',
      detail: `${ctx.sessions.listCalls().length} / ${ctx.sessions.listSessions().length}`,
    },
    {
      key: 'tools',
      labelKey: 'systemSvcTools',
      live: typeof ctx.tools?.list === 'function',
      detail: String(ctx.tools.list().length),
    },
    {
      key: 'agents',
      labelKey: 'systemSvcAgents',
      live: typeof ctx.agents?.run === 'function',
    },
    {
      key: 'knowledge',
      labelKey: 'systemSvcKnowledge',
      live: typeof ctx.knowledge?.listMemory === 'function',
      detail: String(ctx.knowledge.listMemory().length),
    },
  ]

  const plugins: PluginInfo[] = [
    {
      id: 'sessions', labelKey: 'systemPlugSessions', kind: 'builtin',
      live: registry.has(Sessions), provides: ['sessions'], dependsOn: [],
      descKey: 'systemPlugSessionsDesc',
    },
    {
      id: 'tools-registry', labelKey: 'systemPlugTools', kind: 'builtin',
      live: registry.has(Tools), provides: ['tools'], dependsOn: ['sessions'],
      descKey: 'systemPlugToolsDesc',
    },
    {
      id: 'llm', labelKey: 'systemPlugLlm', kind: 'builtin',
      live: registry.has(Llm), provides: ['llm'], dependsOn: ['sessions', 'platform-bridge'],
      descKey: 'systemPlugLlmDesc',
    },
    {
      id: 'capture', labelKey: 'systemPlugCapture', kind: 'builtin',
      live: registry.has(Capture), provides: ['capture'], dependsOn: [],
      descKey: 'systemPlugCaptureDesc',
    },
    {
      id: 'builtin-tools', labelKey: 'systemPlugBuiltin', kind: 'builtin',
      live: registry.has(BuiltinTools), provides: [], dependsOn: ['tools', 'llm', 'sessions'],
      descKey: 'systemPlugBuiltinDesc',
    },
    {
      id: 'pipeline-tools', labelKey: 'systemPlugPipelineTools', kind: 'builtin',
      live: registry.has(PipelineTools), provides: [], dependsOn: ['tools', 'llm', 'sessions'],
      descKey: 'systemPlugPipelineToolsDesc',
    },
    {
      id: 'knowledge', labelKey: 'systemPlugKnowledge', kind: 'builtin',
      live: registry.has(Knowledge), provides: ['knowledge'], dependsOn: ['tools', 'sessions'],
      descKey: 'systemPlugKnowledgeDesc',
    },
    {
      id: 'agents', labelKey: 'systemPlugAgents', kind: 'builtin',
      live: registry.has(Agents), provides: ['agents'], dependsOn: ['tools', 'llm', 'knowledge', 'sessions'],
      descKey: 'systemPlugAgentsDesc',
    },
    {
      id: 'platform-bridge', labelKey: 'systemPlugBridge', kind: 'platform',
      live: !!window.ipcRenderer, provides: [], dependsOn: [],
      descKey: 'systemPlugBridgeDesc',
    },
  ]

  const consumers: ConsumerInfo[] = [
    { id: 'pipeline', labelKey: 'systemConsPipeline', uses: ['llm'] },
    { id: 'app', labelKey: 'systemConsApp', uses: ['capture', 'sessions'] },
    { id: 'result', labelKey: 'systemConsResult', uses: ['llm', 'agents', 'sessions'] },
    { id: 'probe', labelKey: 'systemConsProbe', uses: ['llm'] },
    { id: 'records', labelKey: 'systemConsRecords', uses: ['sessions'] },
    { id: 'xv', labelKey: 'systemConsXv', uses: ['agents', 'tools', 'knowledge', 'sessions'] },
  ]

  const extensions: ExtensionInfo[] = [
    { id: 'providers', labelKey: 'systemExtProviders', milestone: 'M2', plugsInto: ['tools'] },
    { id: 'skills', labelKey: 'systemExtSkills', milestone: 'M2', plugsInto: ['tools', 'agents'] },
    { id: 'mcp', labelKey: 'systemExtMcp', milestone: 'M2', plugsInto: ['tools'] },
    { id: 'profiles', labelKey: 'systemExtProfiles', milestone: 'M3', plugsInto: ['sessions'] },
  ]

  return {
    core: { name: 'cordis Context', pluginCount: registry.size, eventCount: 1 },
    services,
    plugins,
    consumers,
    extensions,
  }
}
