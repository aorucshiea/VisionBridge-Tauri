import { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Settings as SettingsIcon, ScanLine, MessageSquare, Save, Check, Minus, Square, X as CloseIcon, Cpu, Workflow, SlidersHorizontal, FolderOpen, History, Boxes, Bot } from 'lucide-react'
import ScreenshotMask from './components/ScreenshotMask'
import ResultView from './components/ResultView'
import TextChat from './components/TextChat'
import SelectionToolbar from './components/SelectionToolbar'
import PipelineSelector, { AdvancedModeCard } from './components/settings/PipelineSelector'
import PipelineBuilder from './components/settings/PipelineBuilder'
import OfficialPresets from './components/settings/OfficialPresets'
import ProviderConfigSection, { type SectionModel } from './components/settings/ProviderConfigSection'
import ValidationCard from './components/settings/ValidationCard'
import SavedConfigs from './components/settings/SavedConfigs'
import RecordsSection from './components/settings/RecordsSection'
import SystemMapSection from './components/settings/SystemMapSection'
import XiaoVView from './components/XiaoVView'
import AppearanceSection from './components/settings/AppearanceSection'
import ToolbarActionsSection from './components/settings/ToolbarActionsSection'
import { translations, type TranslationDict } from './i18n'
import { themes, tint } from './theme/themes'
import { DEFAULT_SETTINGS } from './lib/defaults'
import { startHarness } from './harness'
import { getActiveNodes, runNodeChain, taskPromptsOf, modeLabel, resolveAction } from './lib/pipeline'
import type { AppSettings, SavedConfiguration, TestTarget, TestStatus } from './types'

type SectionType = 'vlm' | 'ocr' | 'llm' | 'vlm2' | 'llm2'

interface SectionVariant {
  step?: '1' | '2'
  /** Which theme colour the step badge borrows. */
  tone: 'primary' | 'accent'
  titleKey: keyof TranslationDict
  collapsible: boolean
  fields: Array<'translatePrompt' | 'explainPrompt' | 'jsonPrompt'>
  testStyle: 'inline' | 'full'
  testLabelKey: keyof TranslationDict
  modelPlaceholderKey: keyof TranslationDict
}

const SECTION_VARIANTS: Record<SectionType, SectionVariant> = {
  vlm: {
    step: undefined, tone: 'primary', titleKey: 'vlmConfig', collapsible: false,
    fields: ['translatePrompt', 'explainPrompt'],
    testStyle: 'inline', testLabelKey: 'test', modelPlaceholderKey: 'placeholderModel',
  },
  ocr: {
    step: '1', tone: 'primary', titleKey: 'ocrEngine', collapsible: true,
    fields: [],
    testStyle: 'inline', testLabelKey: 'test', modelPlaceholderKey: 'ocrModelPlaceholder',
  },
  llm: {
    step: '2', tone: 'accent', titleKey: 'languageModel', collapsible: true,
    fields: [],
    testStyle: 'full', testLabelKey: 'testLlmConnection', modelPlaceholderKey: 'llmModelPlaceholder',
  },
  vlm2: {
    step: '1', tone: 'primary', titleKey: 'vlmJson', collapsible: true,
    fields: ['jsonPrompt'],
    testStyle: 'full', testLabelKey: 'testVlmConnection', modelPlaceholderKey: 'placeholderModel',
  },
  llm2: {
    step: '2', tone: 'accent', titleKey: 'llmJson', collapsible: true,
    fields: ['translatePrompt', 'explainPrompt'],
    testStyle: 'full', testLabelKey: 'testLlmConnection', modelPlaceholderKey: 'placeholderModel',
  },
}

const SECTION_KEYS: Record<SectionType, Record<keyof SectionModel, keyof AppSettings>> = {
  vlm: { provider: 'vlmProvider', baseUrl: 'vlmBaseUrl', model: 'vlmModel', apiKey: 'vlmApiKey', translatePrompt: 'vlmTranslatePrompt', explainPrompt: 'vlmExplainPrompt', jsonPrompt: 'vlm2JsonPrompt' },
  ocr: { provider: 'ocrProvider', baseUrl: 'ocrBaseUrl', model: 'ocrModel', apiKey: 'ocrApiKey', translatePrompt: 'llmTranslatePrompt', explainPrompt: 'llmExplainPrompt', jsonPrompt: 'vlm2JsonPrompt' },
  llm: { provider: 'llmProvider', baseUrl: 'llmBaseUrl', model: 'llmModel', apiKey: 'llmApiKey', translatePrompt: 'llmTranslatePrompt', explainPrompt: 'llmExplainPrompt', jsonPrompt: 'vlm2JsonPrompt' },
  vlm2: { provider: 'vlm2Provider', baseUrl: 'vlm2BaseUrl', model: 'vlm2Model', apiKey: 'vlm2ApiKey', translatePrompt: 'llm2TranslatePrompt', explainPrompt: 'llm2ExplainPrompt', jsonPrompt: 'vlm2JsonPrompt' },
  llm2: { provider: 'llm2Provider', baseUrl: 'llm2BaseUrl', model: 'llm2Model', apiKey: 'llm2ApiKey', translatePrompt: 'llm2TranslatePrompt', explainPrompt: 'llm2ExplainPrompt', jsonPrompt: 'vlm2JsonPrompt' },
}

type SettingsSectionId = 'model' | 'pipeline' | 'general' | 'config' | 'records' | 'system'

const SETTINGS_SECTIONS: Array<{ id: SettingsSectionId; icon: ReactNode; labelKey: 'sectionModel' | 'sectionPipeline' | 'sectionGeneral' | 'sectionConfig' | 'sectionRecords' | 'sectionSystem' }> = [
  { id: 'model', icon: <Cpu size={17} />, labelKey: 'sectionModel' },
  { id: 'pipeline', icon: <Workflow size={17} />, labelKey: 'sectionPipeline' },
  { id: 'general', icon: <SlidersHorizontal size={17} />, labelKey: 'sectionGeneral' },
  { id: 'config', icon: <FolderOpen size={17} />, labelKey: 'sectionConfig' },
  { id: 'records', icon: <History size={17} />, labelKey: 'sectionRecords' },
  { id: 'system', icon: <Boxes size={17} />, labelKey: 'sectionSystem' },
]

const TEST_STATUS_INIT: Record<TestTarget, TestStatus> = { vlm: 'idle', ocr: 'idle', llm: 'idle', vlm2: 'idle', llm2: 'idle' }

/** Snapshot name for the current pipeline: its primary model. Empty for modes
 *  whose config is not captured by the saved-configuration snapshot. */
function deriveConfigName(s: AppSettings): string {
  switch (s.mode) {
    case 'OCR+LLM': return s.llmModel || s.ocrModel || ''
    case 'VLM+LLM': return s.llm2Model || s.vlm2Model || ''
    case 'VLM': return s.vlmModel || ''
    default: return ''
  }
}

/** Compare captured config objects ignoring empty fields, so re-saving the
 *  same configuration stays a no-op even if key sets differ slightly. */
function configEqual(a: SavedConfiguration['config'], b: SavedConfiguration['config']): boolean {
  const norm = (c: SavedConfiguration['config']) =>
    Object.entries(c || {}).filter(([, v]) => v !== undefined && v !== '')
  const ea = norm(a); const eb = norm(b)
  if (ea.length !== eb.length) return false
  return ea.every(([k, v]) => (eb.find(([k2]) => k2 === k)?.[1]) === v)
}

/** The app mark: a capture frame with a marker stroke through the middle. */
function CaptureMark({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7.5" fill={color} fillOpacity="0.14" />
      <g stroke={color} strokeWidth="1.9" strokeLinecap="round">
        <path d="M7.6 11.2V9.3a1.7 1.7 0 0 1 1.7-1.7h1.9" />
        <path d="M16.8 7.6h1.9a1.7 1.7 0 0 1 1.7 1.7v1.9" />
        <path d="M20.4 16.8v1.9a1.7 1.7 0 0 1-1.7 1.7h-1.9" />
        <path d="M11.2 20.4H9.3a1.7 1.7 0 0 1-1.7-1.7v-1.9" />
      </g>
      <rect x="10.2" y="13.05" width="7.6" height="1.9" rx="0.95" fill={color} />
    </svg>
  )
}

function App() {
  const [windowType] = useState<string>(() => {
    // Tauri injects the window identity per window (init_script in main.rs)
    // and it is authoritative there: Tauri's asset resolver drops the
    // `?window=` query, so relying on the URL alone makes every popup (mask,
    // result card, selection toolbar) fall through to the main app and render
    // the whole UI inside a fullscreen window. Electron passes the identity
    // via the URL; `__VB_WINDOW__` is simply undefined in that harness.
    const injected = (window as any).__VB_WINDOW__
    if (typeof injected === 'string' && injected) return injected

    const params = new URLSearchParams(window.location.search)
    const windowParam = params.get('window')
    if (windowParam) return windowParam

    const hash = window.location.hash
    if (hash.includes('mask')) return 'mask'
    if (hash.includes('result')) return 'result'
    if (hash.includes('toolbar')) return 'selection-toolbar'
    return 'main'
  })

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<'translate' | 'settings'>('translate')
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('model')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [testStatus, setTestStatus] = useState<Record<TestTarget, TestStatus>>(TEST_STATUS_INIT)
  const [testMessage, setTestMessage] = useState<Record<TestTarget, string>>({ vlm: '', ocr: '', llm: '', vlm2: '', llm2: '' })
  const [showApiKeys, setShowApiKeys] = useState<Record<TestTarget, boolean>>({ vlm: false, ocr: false, llm: false, vlm2: false, llm2: false })
  const [savedConfigurations, setSavedConfigurations] = useState<SavedConfiguration[]>([])
  const [showSavedConfigs, setShowSavedConfigs] = useState(false)
  const [configName, setConfigName] = useState('')
  const [configTags, setConfigTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<SectionType, boolean>>({ vlm: true, ocr: true, llm: true, vlm2: true, llm2: true })
  /** Transient inline notice — replaces the native alert() dialogs. */
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)
  const isProcessingRef = useRef(false)
  const settingsLoadedRef = useRef(false)
  const processScreenshotRef = useRef<(region: { x: number; y: number; width: number; height: number }, actionId: string) => void>()
  const noticeTimer = useRef<number | null>(null)

  const t = (key: keyof TranslationDict) => {
    const lang = settings.language || 'zh'
    return translations[lang]?.[key] || translations.zh[key]
  }

  const tell = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setNotice({ text, tone })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3000)
  }, [])

  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current) }, [])

  // Toggling 划词翻译 must take effect immediately — the shortcut is re-armed
  // in the main process on save, so persist the change without waiting for
  // the save button.
  useEffect(() => {
    if (!settingsLoadedRef.current || windowType !== 'main') return
    window.ipcRenderer.saveSettings(settings).then((res) => {
      if (res?.success) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
      }
    }).catch(() => { /* transient — the save button still works */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enableTextSelection, settings.selectionTrigger, settings.closeAction, windowType])

  // Toolbar button edits persist with a short debounce — typing a prompt
  // fires many changes, so the write is throttled instead of per keystroke.
  useEffect(() => {
    if (!settingsLoadedRef.current || windowType !== 'main') return
    const timer = window.setTimeout(() => {
      window.ipcRenderer.saveSettings(settings).catch(() => { /* the save button still works */ })
    }, 800)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.toolbarActions, windowType])

  // Entering the 配置 page: offer the current pipeline's model name as the
  // snapshot name, so saving works without typing anything first.
  useEffect(() => {
    if (settingsSection !== 'config') return
    setConfigName(prev => prev || deriveConfigName(settings))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSection, settings.mode, settings.vlmModel, settings.ocrModel, settings.llmModel, settings.vlm2Model, settings.llm2Model])

  useEffect(() => {
    if (windowType !== 'main' && windowType !== 'xiao-v') {
      document.body.style.background = 'transparent'
      document.documentElement.style.background = windowType === 'xiao-v' ? '' : 'transparent'
    }

    if (window.ipcRenderer) {
      window.ipcRenderer.getSettings().then((res) => {
        if (res) setSettings(prev => ({ ...prev, ...res }))
        settingsLoadedRef.current = true
      }).catch((err) => {
        console.error('Failed to load settings:', err)
      })

      if (windowType === 'main') {
        // The harness runtime lives in the main window only; popups keep the
        // direct IPC contract.
        startHarness()
        window.ipcRenderer.getSavedConfigurations().then((configs) => {
          setSavedConfigurations(configs)
        }).catch((err) => {
          console.error('Failed to load saved configurations:', err)
        })
      }
    }
  }, [windowType])

  const handleCapture = useCallback((region: { x: number; y: number; width: number; height: number }, action: string) => {
    window.ipcRenderer.sendProcessScreenshot({ region, action })
    window.ipcRenderer.closeMask()
  }, [])

  const processScreenshot = useCallback(async (region: { x: number; y: number; width: number; height: number }, actionId: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    if (window.currentAbortController) {
      window.currentAbortController.abort()
    }
    const abortController = new AbortController()
    window.currentAbortController = abortController

    // Cancel any in-flight AI request in the main process
    window.ipcRenderer.cancelAiRequests()
    window.ipcRenderer.showResult({ x: region.x + region.width + 10, y: region.y, content: t('processing'), processing: true })

    let recordId: string | null = null
    try {
      if (settings.mode === 'TEXT') {
        throw new Error(t('textModeNoCapture'))
      }

      const croppedBase64 = await startHarness().capture.region(region)

      // Single execution path: presets resolve to node chains too, so a
      // two-node custom pipeline and the plain VLM preset share one engine.
      const nodes = getActiveNodes(settings)
      if (!nodes || nodes.length === 0) {
        throw new Error(t('pipelineNeedsNode'))
      }

      const { task, promptOverride, label: actionLabel } = resolveAction(actionId, settings)
      const sessions = startHarness().sessions
      const record = sessions.startSession({
        type: 'capture',
        title: actionLabel,
        mode: settings.mode,
        model: deriveConfigName(settings) || undefined,
      })
      recordId = record.id
      await sessions.appendUserMessage(record.id, actionLabel, croppedBase64)

      const { content: result, reasoning: resultReasoning } = await runNodeChain({
        nodes,
        image: croppedBase64,
        task,
        taskPrompts: taskPromptsOf(settings),
        promptOverride,
        // The main window runs the chain; the floating result card renders it.
        onDelta: (d) => { try { window.ipcRenderer.streamResultDelta?.(d) } catch { /* ignore */ } },
      })
      sessions.appendAssistantMessage(record.id, result, resultReasoning)

      if (!abortController.signal.aborted) {
        window.ipcRenderer.showResult({ x: region.x + region.width + 10, y: region.y, content: result })
      }
    } catch (error: any) {
      console.error('[App] Error during capture:', error)
      // Only hide the result window if this request is still the active one,
      // otherwise a newer request may already have shown its own result window.
      if (error?.name === 'AbortError' || abortController.signal.aborted) {
        if (window.currentAbortController === abortController) {
          window.ipcRenderer.hideResult()
        }
      } else {
        if (recordId) {
          try { startHarness().sessions.appendAssistantMessage(recordId, `Error: ${error.message}`) } catch { /* ignore */ }
        }
        window.ipcRenderer.showResult({ x: region.x + region.width + 10, y: region.y, content: `Error: ${error.message}` })
      }
    } finally {
      if (window.currentAbortController === abortController) {
        window.currentAbortController = null
      }
      isProcessingRef.current = false
    }
  }, [settings, t])

  processScreenshotRef.current = processScreenshot

  useEffect(() => {
    if (windowType === 'main' && window.ipcRenderer) {
      return window.ipcRenderer.onProcessScreenshot((data) => {
        processScreenshotRef.current?.(data.region, data.action)
      })
    }
  }, [windowType])

  /** Returns the first validation problem, or null when the names are fine. */
  const findModelNameProblem = (): string | null => {
    const modelNames = [settings.vlmModel, settings.ocrModel, settings.llmModel, settings.vlm2Model, settings.llm2Model]
    for (const modelName of modelNames) {
      if (modelName) {
        if (modelName !== modelName.trim()) return t('validation1')
        if (!/^[a-zA-Z0-9:_\-\.\/]+$/.test(modelName)) return t('validation2')
      }
    }
    return null
  }

  const handleSaveSettings = async () => {
    const problem = findModelNameProblem()
    if (problem) {
      tell(problem, 'error')
      return
    }

    setSaveStatus('saving')
    try {
      const result = await window.ipcRenderer.saveSettings(settings)
      if (result.success) {
        // The footer button is reachable from every settings page, so it also
        // refreshes the named configuration snapshot the user expects it to.
        await saveProfile()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        console.error('Failed to save settings:', result.error)
        tell(`${t('saveFailed')}${result.error ?? ''}`, 'error')
        setSaveStatus('idle')
      }
    } catch (error: any) {
      console.error('Error saving settings:', error)
      tell(`${t('saveFailed')}${error.message}`, 'error')
      setSaveStatus('idle')
    }
  }

  const handleTestConnection = async (type: TestTarget) => {
    setTestStatus(prev => ({ ...prev, [type]: 'testing' }))
    setTestMessage(prev => ({ ...prev, [type]: t('testing') }))

    const key = SECTION_KEYS[type]
    const config = {
      provider: settings[key.provider] as string,
      apiKey: settings[key.apiKey] as string,
      baseUrl: settings[key.baseUrl] as string,
      model: settings[key.model] as string,
    }

    try {
      const result = await window.ipcRenderer.testConnection(config, type)
      if (result.success && result.available) {
        setTestStatus(prev => ({ ...prev, [type]: 'success' }))
        setTestMessage(prev => ({ ...prev, [type]: result.message }))
      } else {
        setTestStatus(prev => ({ ...prev, [type]: 'error' }))
        setTestMessage(prev => ({ ...prev, [type]: result.message }))
      }
    } catch (error: any) {
      setTestStatus(prev => ({ ...prev, [type]: 'error' }))
      setTestMessage(prev => ({ ...prev, [type]: `${t('testFailed')} ${error.message}` }))
    } finally {
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, [type]: 'idle' }))
        setTestMessage(prev => ({ ...prev, [type]: '' }))
      }, 5000)
    }
  }

  const patchSection = (type: SectionType, patch: Partial<SectionModel>) => {
    const keyMap = SECTION_KEYS[type]
    setSettings(prev => {
      const next: Partial<AppSettings> = {}
      for (const [field, value] of Object.entries(patch)) {
        next[keyMap[field as keyof SectionModel]] = value as never
      }
      return { ...prev, ...next }
    })
  }

  /** Upsert the current model config as a named snapshot. An unchanged config
   *  is a no-op and a same-name entry is replaced, so the always-visible
   *  保存配置 button can be clicked on any page without spamming the list. */
  const saveProfile = async (): Promise<boolean> => {
    const name = (configName.trim() || deriveConfigName(settings)).trim()
    if (!name) return false
    const configData = {
      name,
      pipeline: settings.mode as SavedConfiguration['pipeline'],
      tags: configTags,
      config: {
        vlmProvider: settings.vlmProvider, vlmModel: settings.vlmModel, vlmBaseUrl: settings.vlmBaseUrl, vlmApiKey: settings.vlmApiKey,
        ocrProvider: settings.ocrProvider, ocrModel: settings.ocrModel, ocrBaseUrl: settings.ocrBaseUrl, ocrApiKey: settings.ocrApiKey,
        llmProvider: settings.llmProvider, llmModel: settings.llmModel, llmBaseUrl: settings.llmBaseUrl, llmApiKey: settings.llmApiKey,
        vlm2Provider: settings.vlm2Provider, vlm2Model: settings.vlm2Model, vlm2BaseUrl: settings.vlm2BaseUrl, vlm2ApiKey: settings.vlm2ApiKey,
        vlm2JsonPrompt: settings.vlm2JsonPrompt,
        llm2Provider: settings.llm2Provider, llm2Model: settings.llm2Model, llm2BaseUrl: settings.llm2BaseUrl, llm2ApiKey: settings.llm2ApiKey,
        llm2TranslatePrompt: settings.llm2TranslatePrompt, llm2ExplainPrompt: settings.llm2ExplainPrompt,
      },
    }

    try {
      const existing = await window.ipcRenderer.getSavedConfigurations()
      const dups = existing.filter((c: SavedConfiguration) => c.name === name)
      if (
        dups.length === 1 &&
        dups[0].pipeline === configData.pipeline &&
        JSON.stringify([...(dups[0].tags || [])].sort()) === JSON.stringify([...configData.tags].sort()) &&
        configEqual(dups[0].config, configData.config)
      ) {
        return true
      }
      await window.ipcRenderer.saveConfiguration(configData)
      for (const dup of dups) await window.ipcRenderer.deleteConfiguration(dup.id)
      setSavedConfigurations(await window.ipcRenderer.getSavedConfigurations())
      setConfigName(name)
      return true
    } catch (error: any) {
      tell(`${t('saveFailed')}${error.message}`, 'error')
      return false
    }
  }

  const handleSaveConfiguration = async () => {
    if (!configName.trim() && !deriveConfigName(settings)) {
      tell(t('enterConfigName'), 'error')
      return
    }
    if (await saveProfile()) tell(t('configSaved'))
  }

  const handleLoadConfiguration = async (config: SavedConfiguration) => {
    const c = config.config
    setSettings(prev => ({
      ...prev,
      mode: config.pipeline,
      vlmProvider: (c.vlmProvider as AppSettings['vlmProvider']) || 'ollama', vlmModel: c.vlmModel || '', vlmBaseUrl: c.vlmBaseUrl || '', vlmApiKey: c.vlmApiKey || '',
      ocrProvider: (c.ocrProvider as AppSettings['ocrProvider']) || 'ollama', ocrModel: c.ocrModel || '', ocrBaseUrl: c.ocrBaseUrl || '', ocrApiKey: c.ocrApiKey || '',
      llmProvider: (c.llmProvider as AppSettings['llmProvider']) || 'ollama', llmModel: c.llmModel || '', llmBaseUrl: c.llmBaseUrl || '', llmApiKey: c.llmApiKey || '',
      vlm2Provider: (c.vlm2Provider as AppSettings['vlm2Provider']) || 'ollama', vlm2Model: c.vlm2Model || '', vlm2BaseUrl: c.vlm2BaseUrl || '', vlm2ApiKey: c.vlm2ApiKey || '',
      vlm2JsonPrompt: c.vlm2JsonPrompt || '',
      llm2Provider: (c.llm2Provider as AppSettings['llm2Provider']) || 'ollama', llm2Model: c.llm2Model || '', llm2BaseUrl: c.llm2BaseUrl || '', llm2ApiKey: c.llm2ApiKey || '',
      llm2TranslatePrompt: c.llm2TranslatePrompt || '', llm2ExplainPrompt: c.llm2ExplainPrompt || '',
    }))
    setShowSavedConfigs(false)
  }

  const handleDeleteConfiguration = async (id: string) => {
    if (confirm(t('confirmDelete'))) {
      try {
        await window.ipcRenderer.deleteConfiguration(id)
        const configs = await window.ipcRenderer.getSavedConfigurations()
        setSavedConfigurations(configs)
      } catch (error: any) {
        tell(`${t('deleteFailed')}${error.message}`, 'error')
      }
    }
  }

  const toggleSection = (section: SectionType) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  if (windowType === 'xiao-v') return <XiaoVView />
  if (windowType === 'result') return <ResultView />
  if (windowType === 'selection-toolbar') return (
    <div className="w-full h-full bg-transparent overflow-hidden no-drag">
      <SelectionToolbar />
    </div>
  )
  if (windowType === 'mask') return (
    <div className="w-screen h-screen bg-transparent overflow-hidden no-drag">
      <ScreenshotMask onCapture={handleCapture} onCancel={() => window.ipcRenderer.closeMask()} />
    </div>
  )

  const currentTheme = themes[settings.theme] || themes.light

  const pipelineLabel = modeLabel(settings, t)
  const chainNodes = getActiveNodes(settings) || []
  const activeModel = settings.mode === 'TEXT'
    ? settings.llmModel
    : chainNodes.map(n => n.model || n.kind).join(' → ')

  const renderSection = (type: SectionType) => {
    const v = SECTION_VARIANTS[type]
    const keyMap = SECTION_KEYS[type]
    return (
      <ProviderConfigSection
        key={type}
        type={type}
        step={v.step}
        tone={v.tone}
        titleKey={v.titleKey}
        collapsible={v.collapsible}
        expanded={expandedSections[type]}
        onToggle={() => toggleSection(type)}
        fields={v.fields}
        testStyle={v.testStyle}
        testLabelKey={v.testLabelKey}
        modelPlaceholderKey={v.modelPlaceholderKey}
        section={{
          provider: settings[keyMap.provider] as string,
          baseUrl: settings[keyMap.baseUrl] as string,
          model: settings[keyMap.model] as string,
          apiKey: settings[keyMap.apiKey] as string,
          translatePrompt: settings[keyMap.translatePrompt] as string | undefined,
          explainPrompt: settings[keyMap.explainPrompt] as string | undefined,
          jsonPrompt: settings[keyMap.jsonPrompt] as string | undefined,
        }}
        onPatch={(patch) => patchSection(type, patch)}
        testStatus={testStatus[type]}
        testMessage={testMessage[type]}
        showApiKey={showApiKeys[type]}
        onToggleApiKey={() => setShowApiKeys(prev => ({ ...prev, [type]: !prev[type] }))}
        onTest={() => handleTestConnection(type)}
        theme={currentTheme}
        t={t}
      />
    )
  }

  const rootVars = {
    backgroundColor: currentTheme.background,
    color: currentTheme.text,
    '--focus-ring': currentTheme.primary,
    '--scroll-thumb': `${currentTheme.textMuted}55`,
    '--scroll-thumb-hover': `${currentTheme.textMuted}88`,
    '--kbd-bg': tint(currentTheme.text, currentTheme.background, 0.06),
    '--kbd-border': currentTheme.hairline,
    '--kbd-fg': currentTheme.textSecondary,
    '--glass-bg': currentTheme.glassBg,
    '--glass-border': currentTheme.glassBorder,
    '--glass-solid': currentTheme.card,
    '--sweep-color': currentTheme.primary,
  } as CSSProperties

  const textMode = settings.mode === 'TEXT'

  const tabs: Array<{ id: 'translate' | 'settings'; icon: ReactNode; label: string }> = [
    textMode
      ? { id: 'translate', icon: <MessageSquare size={15} />, label: t('chat') }
      : { id: 'translate', icon: <ScanLine size={15} />, label: t('screenshot') },
    { id: 'settings', icon: <SettingsIcon size={15} />, label: t('settings') },
  ]

  return (
    <div className="h-screen flex flex-col font-body select-none overflow-hidden" style={rootVars}>
      {/* ------------------------------------------------------------------ */}
      {/* Title bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header
        className="h-12 shrink-0 flex items-center gap-2 pl-3 pr-1.5 border-b drag"
        style={{ backgroundColor: currentTheme.card, borderColor: currentTheme.hairline }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <CaptureMark color={currentTheme.primary} size={24} />
          <span className="text-[13px] font-bold tracking-tight" style={{ color: currentTheme.text }}>
            {t('title')}
          </span>
        </div>

        {/* Tab switcher — sits next to the mark, away from the window buttons */}
        <div
          role="tablist"
          aria-label={t('settings')}
          className="no-drag ml-2 flex gap-0.5 p-0.5 rounded-[10px] border"
          style={{ backgroundColor: currentTheme.inputBg, borderColor: currentTheme.inputBorder }}
        >
          {tabs.map(tab => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-base ease-out-quart active:scale-[0.98]"
                style={{
                  backgroundColor: selected ? currentTheme.card : 'transparent',
                  color: selected ? currentTheme.primary : currentTheme.textSecondary,
                  boxShadow: selected ? `0 1px 2px ${currentTheme.hairline}` : undefined,
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
          <button
            role="tab"
            aria-selected={false}
            onClick={() => { try { window.ipcRenderer.openXiaoV?.() } catch { /* ignore */ } }}
            title={settings?.assistantName || '小V'}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-base ease-out-quart active:scale-[0.98]"
            style={{ backgroundColor: 'transparent', color: currentTheme.accent }}
          >
            <Bot size={13} />
            <span>{settings?.assistantName || '小V'}</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 no-drag">
          <button
            onClick={() => window.ipcRenderer.minimizeWindow()}
            aria-label="Minimize"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-fast ease-out-quart hover:brightness-95"
            style={{ color: currentTheme.textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(currentTheme.text, currentTheme.card, 0.07) }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.ipcRenderer.maximizeWindow()}
            aria-label="Maximize"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-fast ease-out-quart"
            style={{ color: currentTheme.textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(currentTheme.text, currentTheme.card, 0.07) }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Square size={11} />
          </button>
          <button
            onClick={() => window.ipcRenderer.closeWindow()}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-fast ease-out-quart"
            style={{ color: currentTheme.textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(currentTheme.danger, currentTheme.card, 0.12); e.currentTarget.style.color = currentTheme.danger }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = currentTheme.textSecondary }}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                            */}
      {/* ------------------------------------------------------------------ */}
      <main
        className="flex-1 overflow-y-auto custom-scrollbar"
        style={{ backgroundColor: currentTheme.background }}
      >
        {activeTab === 'translate' ? (
          textMode ? (
            <div className="h-full flex flex-col px-4 pt-3 pb-3 animate-rise">
              <TextChat theme={currentTheme} t={t} />
            </div>
          ) : (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center px-7 animate-rise">
            <div
              className="w-full max-w-[268px] flex flex-col items-center text-center"
            >
              <CaptureMark color={currentTheme.primary} size={58} />

              <h2 className="mt-5 text-[17px] font-bold tracking-tight" style={{ color: currentTheme.text }}>
                {t('ready')}
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: currentTheme.textSecondary }}>
                {t('captureFrameHint')}
              </p>

              <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: currentTheme.textMuted }}>
                <span>{t('hotkeyLabel')}</span>
                <span className="kbd">Alt</span>
                <span>+</span>
                <span className="kbd">A</span>
              </div>

              <button
                onClick={() => window.ipcRenderer.openMask()}
                className="mt-7 w-full h-11 rounded-[11px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-[transform,box-shadow,filter] duration-base ease-out-quart hover:brightness-[1.06] active:scale-[0.98]"
                style={{
                  backgroundColor: currentTheme.primary,
                  color: currentTheme.onPrimary,
                  boxShadow: `0 6px 20px -6px ${currentTheme.primary}bb`,
                }}
              >
                <ScanLine size={16} />
                {t('startCapture')}
              </button>

              <div className="mt-6 w-full pt-4 border-t" style={{ borderColor: currentTheme.hairline }}>
                <p className="eyebrow mb-1.5" style={{ color: currentTheme.textMuted }}>{t('pipeline')}</p>
                <p className="text-[12px] font-semibold" style={{ color: currentTheme.text }}>{pipelineLabel}</p>
                <p className="mt-1 text-[11px] leading-relaxed truncate" style={{ color: currentTheme.textSecondary }} title={activeModel}>
                  {activeModel || '—'}
                </p>
              </div>
            </div>
          </div>
          )
        ) : (
          <div className="h-full flex animate-rise">
            {/* Left rail — the desktop-app settings pattern (Windows 11 设置 /
                VS Code style): one visible level of categories, no long hunt. */}
            <nav
              aria-label={t('settings')}
              className="w-[92px] shrink-0 border-r px-2.5 py-4 space-y-1"
              style={{ borderColor: currentTheme.hairline, backgroundColor: currentTheme.inputBg }}
            >
              {SETTINGS_SECTIONS.map(s => {
                const selected = settingsSection === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => setSettingsSection(s.id)}
                    className="w-full flex flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-[10px] transition-[background-color,color] duration-base ease-out-quart active:scale-[0.98]"
                    style={{
                      backgroundColor: selected ? currentTheme.card : 'transparent',
                      color: selected ? currentTheme.primary : currentTheme.textSecondary,
                      boxShadow: selected ? `0 1px 2px ${currentTheme.hairline}` : undefined,
                    }}
                  >
                    {s.icon}
                    <span className="text-[10.5px] font-semibold leading-none">{t(s.labelKey)}</span>
                  </button>
                )
              })}
            </nav>

            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
              {settingsSection === 'model' && (
                <>
                  <PipelineSelector
                    mode={settings.mode}
                    onSelect={(m) => setSettings(prev => ({ ...prev, mode: m }))}
                    theme={currentTheme}
                    t={t}
                  />

                  {/* Hybrid presets sit between basic modes and the advanced toggle. */}
                  <OfficialPresets
                    mode={settings.mode}
                    onSelect={(m) => setSettings(prev => ({ ...prev, mode: m }))}
                    theme={currentTheme}
                    t={t}
                  />

                  {settings.mode === 'VLM' && renderSection('vlm')}

                  {settings.mode === 'TEXT' && renderSection('llm')}

                  {settings.mode === 'OCR+LLM' && (
                    <div className="space-y-5">
                      {renderSection('ocr')}
                      {renderSection('llm')}
                    </div>
                  )}

                  {settings.mode === 'VLM+LLM' && (
                    <div className="space-y-5">
                      {renderSection('vlm2')}
                      {renderSection('llm2')}
                    </div>
                  )}

                  {settings.mode === 'CUSTOM' && (
                    <div
                      className="px-4 py-3 rounded-card border text-[11.5px] leading-relaxed"
                      style={{
                        backgroundColor: tint(currentTheme.primary, currentTheme.card, 0.06),
                        borderColor: tint(currentTheme.primary, currentTheme.card, 0.24),
                        color: currentTheme.textSecondary,
                      }}
                    >
                      {t('customPipelineActive')}
                    </div>
                  )}
                </>
              )}

              {settingsSection === 'pipeline' && (
                <>
                  <AdvancedModeCard
                    advancedMode={settings.advancedMode}
                    onToggle={(v) => setSettings(prev => ({ ...prev, advancedMode: v }))}
                    theme={currentTheme}
                    t={t}
                  />

                  {settings.advancedMode && (
                    <PipelineBuilder
                      settings={settings}
                      onPatch={(patch) => setSettings(prev => ({ ...prev, ...patch }))}
                      onNotify={tell}
                      theme={currentTheme}
                      t={t}
                    />
                  )}
                </>
              )}

              {settingsSection === 'general' && (
                <>
                  <AppearanceSection
                    settings={settings}
                    onPatch={(patch) => setSettings(prev => ({ ...prev, ...patch }))}
                    theme={currentTheme}
                    t={t}
                  />

                  <ToolbarActionsSection
                    settings={settings}
                    onPatch={(patch) => setSettings(prev => ({ ...prev, ...patch }))}
                    theme={currentTheme}
                    t={t}
                  />
                </>
              )}

              {settingsSection === 'config' && (
                <>
                  <ValidationCard theme={currentTheme} t={t} />

                  <SavedConfigs
                    show={showSavedConfigs}
                    onToggleShow={() => setShowSavedConfigs(!showSavedConfigs)}
                    configName={configName}
                    onConfigNameChange={setConfigName}
                    configTags={configTags}
                    customTagInput={customTagInput}
                    onCustomTagInputChange={setCustomTagInput}
                    onAddTag={(tag) => setConfigTags(prev => prev.includes(tag) ? prev : [...prev, tag])}
                    onRemoveTag={(tag) => setConfigTags(prev => prev.filter(x => x !== tag))}
                    onAddCustomTag={() => {
                      const tag = customTagInput.trim()
                      if (tag && !configTags.includes(tag)) {
                        setConfigTags(prev => [...prev, tag])
                        setCustomTagInput('')
                      }
                    }}
                    onSave={handleSaveConfiguration}
                    configurations={savedConfigurations}
                    onApply={handleLoadConfiguration}
                    onDelete={handleDeleteConfiguration}
                    theme={currentTheme}
                    t={t}
                  />
                </>
              )}
              {settingsSection === 'records' && (
                <RecordsSection theme={currentTheme} t={t} />
              )}

              {settingsSection === 'system' && (
                <SystemMapSection theme={currentTheme} t={t} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Status / action bar — always visible, so saving never requires      */}
      {/* scrolling back to the bottom of a long settings form.               */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="relative h-11 shrink-0 flex items-center gap-3 px-3.5 border-t"
        style={{ backgroundColor: currentTheme.card, borderColor: currentTheme.hairline }}
      >
        {notice && (
          <div
            role="status"
            className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] max-w-[92%] px-3 py-2 rounded-lg text-[11px] font-medium shadow-soft-lg animate-rise"
            style={{
              backgroundColor: notice.tone === 'error' ? currentTheme.danger : currentTheme.text,
              color: notice.tone === 'error' ? '#fff' : currentTheme.card,
            }}
          >
            {notice.text}
          </div>
        )}

        <div className="flex items-center gap-2 min-w-0 text-[11px]" style={{ color: currentTheme.textMuted }}>
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: saveStatus === 'saved' ? currentTheme.success : tint(currentTheme.text, currentTheme.card, 0.28) }}
          />
          <span className="shrink-0">{t('statusPipeline')}</span>
          <span className="font-semibold" style={{ color: currentTheme.textSecondary }}>{pipelineLabel}</span>
          <span aria-hidden style={{ color: currentTheme.border }}>·</span>
          <span className="font-mono truncate max-w-[150px]" title={activeModel}>{activeModel || '—'}</span>
        </div>

        <div className="flex-1" />

        {activeTab === 'settings' ? (
          <button
            onClick={handleSaveSettings}
            disabled={saveStatus !== 'idle'}
            className="h-7 px-3.5 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5 transition-[transform,filter] duration-fast ease-out-quart hover:brightness-[1.06] active:scale-[0.97] disabled:cursor-default"
            style={{
              backgroundColor: saveStatus === 'saved' ? currentTheme.success : currentTheme.primary,
              color: currentTheme.onPrimary,
            }}
          >
            {saveStatus === 'saving' ? (
              <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin opacity-70" />
            ) : saveStatus === 'saved' ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
            )}
            {saveStatus === 'idle' ? t('save') : saveStatus === 'saving' ? t('saving') : t('saved')}
          </button>
        ) : textMode ? (
          <span className="text-[11px]" style={{ color: currentTheme.textMuted }}>
            {t('textMode')}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: currentTheme.textMuted }}>
            <span className="kbd">Alt</span> <span>+</span> <span className="kbd">A</span>
          </span>
        )}
      </footer>
    </div>
  )
}

export default App
