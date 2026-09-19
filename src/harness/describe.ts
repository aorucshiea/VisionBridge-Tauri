/**
 * Live description of the harness topology: the cordis core, the services it
 * holds, the plugins around it, their consumers, and the planned extension
 * slots. Consumed by the 系统 (SystemMap) settings page.
 *
 * Plugin authors: register the plugin in harness/index.ts AND add a row here
 * so the map stays truthful.
 */
import { harness } from './index'
import { Capture } from './plugins/capture'
import { Llm } from './plugins/llm'
import { Sessions } from './plugins/sessions'
import type { TranslationDict } from '../i18n'

export interface ServiceInfo {
  key: 'llm' | 'capture' | 'sessions'
  labelKey: keyof TranslationDict
  live: boolean
  detail?: string
}

export interface PluginInfo {
  id: string
  labelKey: keyof TranslationDict
  kind: 'builtin' | 'platform'
  live: boolean
  provides: Array<ServiceInfo['key']>
  dependsOn: string[]
  descKey: keyof TranslationDict
}

export interface ConsumerInfo {
  id: string
  labelKey: keyof TranslationDict
  uses: Array<ServiceInfo['key']>
}

export interface ExtensionInfo {
  id: string
  labelKey: keyof TranslationDict
  milestone: string
  plugsInto: Array<ServiceInfo['key'] | 'core'>
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
      detail: 'chat · ocr · tts · asr · imagegen · listModels',
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
  ]

  const plugins: PluginInfo[] = [
    {
      id: 'sessions', labelKey: 'systemPlugSessions', kind: 'builtin',
      live: registry.has(Sessions), provides: ['sessions'], dependsOn: [],
      descKey: 'systemPlugSessionsDesc',
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
      id: 'platform-bridge', labelKey: 'systemPlugBridge', kind: 'platform',
      live: !!window.ipcRenderer, provides: [], dependsOn: [],
      descKey: 'systemPlugBridgeDesc',
    },
  ]

  const consumers: ConsumerInfo[] = [
    { id: 'pipeline', labelKey: 'systemConsPipeline', uses: ['llm'] },
    { id: 'app', labelKey: 'systemConsApp', uses: ['capture', 'sessions'] },
    { id: 'result', labelKey: 'systemConsResult', uses: ['llm', 'sessions'] },
    { id: 'probe', labelKey: 'systemConsProbe', uses: ['llm'] },
    { id: 'records', labelKey: 'systemConsRecords', uses: ['sessions'] },
  ]

  const extensions: ExtensionInfo[] = [
    { id: 'agent', labelKey: 'systemExtAgent', milestone: 'M2', plugsInto: ['llm'] },
    { id: 'providers', labelKey: 'systemExtProviders', milestone: 'M2', plugsInto: ['llm'] },
    { id: 'tools', labelKey: 'systemExtTools', milestone: 'M3', plugsInto: ['llm'] },
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
