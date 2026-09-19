export interface TranslationDict {
  title: string
  screenshot: string
  settings: string
  ready: string
  shortcut: string
  startCapture: string
  pipeline: string
  vlmConfig: string
  ocrLlmConfig: string
  vlmLlmConfig: string
  apiProvider: string
  baseUrl: string
  modelName: string
  apiKey: string
  translatePrompt: string
  explainPrompt: string
  test: string
  testConnection: string
  testing: string
  testSuccess: string
  testFailed: string
  ocrEngine: string
  languageModel: string
  vlmJson: string
  llmJson: string
  jsonPrompt: string
  modelValidation: string
  validation1: string
  validation2: string
  validation3: string
  savedConfigs: string
  show: string
  hide: string
  configName: string
  apiFormatTags: string
  modelTypeTags: string
  customTags: string
  add: string
  saveConfig: string
  noConfigs: string
  apply: string
  delete: string
  features: string
  textSelection: string
  textSelectionDesc: string
  selectionTrigger: string
  triggerAuto: string
  triggerHotkey: string
  closeBehavior: string
  closeToTray: string
  closeQuit: string
  toolbarButtons: string
  toolbarButtonsDesc: string
  addAction: string
  restoreDefaults: string
  actionLabel: string
  actionPrompt: string
  actionPromptHint: string
  fetchModels: string
  fetchModelsFailed: string
  providerGroupCn: string
  providerGroupGlobal: string
  providerGroupLocal: string
  probeModels: string
  modelProbeTitle: string
  capVision: string
  capReasoning: string
  capTools: string
  catalogModels: string
  liveModels: string
  probeSearch: string
  probeEmpty: string
  sectionModel: string
  sectionPipeline: string
  sectionGeneral: string
  sectionConfig: string
  sectionRecords: string
  sectionSystem: string
  systemCoreSub: string
  systemCoreDesc: string
  systemSvcLlm: string
  systemSvcCapture: string
  systemSvcSessions: string
  systemPlugSessions: string
  systemPlugSessionsDesc: string
  systemPlugLlm: string
  systemPlugLlmDesc: string
  systemPlugCapture: string
  systemPlugCaptureDesc: string
  systemPlugBridge: string
  systemPlugBridgeDesc: string
  systemConsPipeline: string
  systemConsApp: string
  systemConsResult: string
  systemConsProbe: string
  systemConsRecords: string
  systemExtTitle: string
  systemExtAgent: string
  systemExtProviders: string
  systemExtTools: string
  systemExtProfiles: string
  systemProvides: string
  systemDepends: string
  systemUses: string
  systemMilestone: string
  systemExtPlugsInto: string
  systemStatus: string
  systemLive: string
  systemDead: string
  systemDetailHint: string
  systemLegendBuiltin: string
  systemLegendExt: string
  systemLegendPlugins: string
  recordsTabSessions: string
  recordsTabCalls: string
  recordsEmptySessions: string
  recordsEmptyCalls: string
  recordsEmptyMessages: string
  recordsClear: string
  recordsClearConfirm: string
  recordsTypeCapture: string
  recordsTypeChat: string
  recordsRoleUser: string
  recordsRoleAssistant: string
  recordsKindChat: string
  recordsKindOcr: string
  recordsKindImagegen: string
  recordsKindTts: string
  recordsKindAsr: string
  recordsKindListModels: string
  recordsOk: string
  recordsFailed: string
  recordsDuration: string
  recordsCallProvider: string
  appearance: string
  theme: string
  language: string
  save: string
  saving: string
  saved: string
  placeholderBaseUrl: string
  placeholderModel: string
  placeholderApiKey: string
  placeholderTranslatePrompt: string
  placeholderExplainPrompt: string
  placeholderJsonPrompt: string
  placeholderConfigName: string
  placeholderCustomTag: string
  confirmDelete: string
  saveFailed: string
  deleteFailed: string
  enterConfigName: string
  pipelineA: string
  pipelineB: string
  pipelineC: string
  pipelineDescVlm: string
  pipelineDescOcr: string
  pipelineDescVlmLlm: string
  statusPipeline: string
  statusModel: string
  hotkeyLabel: string
  captureFrameHint: string
  copied: string
  copyFailed: string
  ollamaLocal: string
  openaiGpt4: string
  anthropicClaude: string
  customEndpoint: string
  tesseractLocal: string
  ollamaVision: string
  baiduCloud: string
  googleVision: string
  customVision: string
  showHideKey: string
  testLlmConnection: string
  testVlmConnection: string
  openai: string
  anthropic: string
  processing: string
  ocrNoText: string
  configSaved: string
  llmBaseUrl: string
  ocrModelPlaceholder: string
  ocrApiKeyPlaceholder: string
  llmModelPlaceholder: string
  llmJsonPlaceholder: string
  llm2ExplainPlaceholder: string
  chatScreenshot: string
  chatSaved: string
  exitChat: string
  copyResult: string
  closeResult: string
  continueScreenshot: string
  inputPlaceholder: string
  askFollowup: string
  attachImage: string
  answerWithImage: string
  saveChat: string
  saveAsHistory: string
  messageCount: string
  analyzing: string
  thinkingProcess: string
  collapse: string
  expand: string
  dragHint: string
  closeMask: string
  translate: string
  explain: string
  cancel: string
  advancedMode: string
  advancedModeDesc: string
  multimodal: string
  basicModes: string
  textMode: string
  textModeDesc: string
  textModeNoCapture: string
  textChatEmpty: string
  officialPresets: string
  chat: string
  customPipelines: string
  newPipeline: string
  editPipeline: string
  pipelineName: string
  placeholderPipelineName: string
  addNode: string
  nodeCategories: string
  moveUp: string
  moveDown: string
  usePipeline: string
  inUse: string
  noPipelines: string
  noPipelinesHint: string
  kindVlm: string
  kindLlm: string
  kindOcr: string
  kindAsr: string
  kindTts: string
  kindImagegen: string
  kindCustom: string
  newNodeKind: string
  newNodeKindLabel: string
  newNodeKindApi: string
  nodePrompt: string
  nodePromptExplain: string
  nodePromptHint: string
  voice: string
  savePipeline: string
  confirmDeletePipeline: string
  pipelineNeedsName: string
  pipelineNeedsNode: string
  pipelineSaved: string
  customPipelineActive: string
}

export const translations: Record<'zh' | 'en', TranslationDict> = {
  zh: {
    title: 'Vision Bridge',
    screenshot: '截图',
    settings: '设置',
    ready: '准备就绪',
    shortcut: '快捷键: Alt + A',
    startCapture: '开始截图',
    pipeline: '处理管道',
    vlmConfig: '视觉模型配置',
    ocrLlmConfig: '模块化管道',
    vlmLlmConfig: '混合管道',
    apiProvider: 'API 提供商',
    baseUrl: 'Base URL',
    modelName: '模型名称',
    apiKey: 'API Key',
    translatePrompt: '翻译提示词',
    explainPrompt: '解释提示词',
    test: '测试',
    testConnection: '测试连接',
    testing: '测试中...',
    testSuccess: '连接成功',
    testFailed: '连接失败',
    ocrEngine: 'OCR 引擎',
    languageModel: '语言模型',
    vlmJson: '视觉模型 (提取 JSON)',
    llmJson: '语言模型 (处理 JSON)',
    jsonPrompt: 'JSON 转换提示词',
    modelValidation: '模型名称规范',
    validation1: '模型名称不能包含前后空格',
    validation2: '只允许字母、数字、冒号、连字符、下划线、点和斜杠',
    validation3: '示例：qwen2-vl:7b、deepseek-ai/DeepSeek-OCR',
    savedConfigs: '保存的配置',
    show: '显示',
    hide: '隐藏',
    configName: '配置名称 (例如: 硅基流动 OCR)',
    apiFormatTags: 'API 格式标签',
    modelTypeTags: '模型类型标签',
    customTags: '自定义标签',
    add: '添加',
    saveConfig: '保存当前配置',
    noConfigs: '暂无保存的配置',
    apply: '应用',
    delete: '删除',
    features: '功能设置',
    textSelection: '划词翻译',
    textSelectionDesc: '选中文字自动弹出翻译工具条',
    selectionTrigger: '取词方式',
    triggerAuto: '划词自动',
    triggerHotkey: '仅快捷键',
    closeBehavior: '关闭窗口时',
    closeToTray: '最小化到托盘',
    closeQuit: '退出应用',
    toolbarButtons: '工具条按钮',
    toolbarButtonsDesc: '截图框选与划词工具条上显示的按钮，每个按钮可用自己的提示词',
    addAction: '添加按钮',
    restoreDefaults: '恢复默认',
    actionLabel: '按钮名称',
    actionPrompt: '提示词',
    actionPromptHint: '支持 {input} 占位符；留空则翻译动作使用默认提示词',
    fetchModels: '获取模型',
    fetchModelsFailed: '获取模型失败: ',
    providerGroupCn: '国内服务',
    providerGroupGlobal: '国际服务',
    providerGroupLocal: '本地与自定义',
    probeModels: '获取模型列表',
    modelProbeTitle: '模型列表',
    capVision: '视觉',
    capReasoning: '推理',
    capTools: '工具',
    catalogModels: '模型目录（models.dev）',
    liveModels: '厂商在线列表',
    probeSearch: '搜索模型…',
    probeEmpty: '该厂商暂无目录数据，可在模型框直接填写',
    sectionModel: '模型',
    sectionPipeline: '管道',
    sectionGeneral: '通用',
    sectionConfig: '配置',
    sectionRecords: '记录',
    sectionSystem: '系统',
    systemCoreSub: '服务仓库 · 可逆注册 · 类型化事件',
    systemCoreDesc: 'cordis 插件运行时：所有能力都是注册到共享 Context 的插件服务，注册是可回滚 effect，卸载自动撤销。',
    systemSvcLlm: '模型服务',
    systemSvcCapture: '截图服务',
    systemSvcSessions: '记录服务',
    systemPlugSessions: '记录插件',
    systemPlugSessionsDesc: '记录调用与对话（一键一记录的本地存储，跨窗口无竞态，自动裁剪）。',
    systemPlugLlm: '模型适配插件',
    systemPlugLlmDesc: '把 chat/ocr/tts/asr/生图/模型列表 路由到平台桥，并为每次调用写调用记录。',
    systemPlugCapture: '截图插件',
    systemPlugCaptureDesc: '封装平台截屏能力，把屏幕区域捕获为 base64 图像。',
    systemPlugBridge: '平台桥',
    systemPlugBridgeDesc: 'window.ipcRenderer：Tauri 为渲染进程 fetch 垫片，Electron 为 preload→主进程桥。',
    systemConsPipeline: '节点链引擎',
    systemConsApp: '主窗口',
    systemConsResult: '结果卡',
    systemConsProbe: '模型探测',
    systemConsRecords: '记录页',
    systemExtTitle: '扩展位（规划中）',
    systemExtAgent: 'Agent 循环',
    systemExtProviders: '第三方 Provider',
    systemExtTools: '自定义工具',
    systemExtProfiles: 'Profile 叠加',
    systemProvides: '提供服务',
    systemDepends: '依赖',
    systemUses: '使用服务',
    systemMilestone: '里程碑',
    systemExtPlugsInto: '挂载点',
    systemStatus: '状态',
    systemLive: '运行中',
    systemDead: '未运行',
    systemDetailHint: '点击图中的任意节点查看详情。',
    systemLegendBuiltin: '内置插件',
    systemLegendExt: '扩展位',
    systemLegendPlugins: '插件数',
    recordsTabSessions: '对话',
    recordsTabCalls: '调用',
    recordsEmptySessions: '暂无对话记录',
    recordsEmptyCalls: '暂无调用记录',
    recordsEmptyMessages: '（无消息）',
    recordsClear: '清空',
    recordsClearConfirm: '确定清空全部记录？',
    recordsTypeCapture: '截图',
    recordsTypeChat: '对话',
    recordsRoleUser: '问',
    recordsRoleAssistant: '答',
    recordsKindChat: '聊天',
    recordsKindOcr: '文字识别',
    recordsKindImagegen: '生图',
    recordsKindTts: '语音合成',
    recordsKindAsr: '语音识别',
    recordsKindListModels: '模型列表',
    recordsOk: '成功',
    recordsFailed: '失败',
    recordsDuration: '耗时',
    recordsCallProvider: '服务',
    appearance: '外观设置',
    theme: '主题',
    language: '语言',
    save: '保存配置',
    saving: '保存中...',
    saved: '已保存',
    placeholderBaseUrl: '例如: http://127.0.0.1:11434',
    placeholderModel: '例如: qwen2-vl:7b',
    placeholderApiKey: 'sk-...',
    placeholderTranslatePrompt: '翻译提示词...',
    placeholderExplainPrompt: '解释提示词...',
    placeholderJsonPrompt: '提示词：将图片转换为 JSON 格式',
    placeholderConfigName: '输入配置名称',
    placeholderCustomTag: '输入自定义标签',
    confirmDelete: '确定要删除这个配置吗？',
    saveFailed: '保存失败: ',
    deleteFailed: '删除失败: ',
    enterConfigName: '请输入配置名称',
    pipelineA: '管道 A',
    pipelineB: '管道 B',
    pipelineC: '管道 C',
    pipelineDescVlm: '一步直达：截图直接交给视觉模型',
    pipelineDescOcr: '先精准识别文字，再交给语言模型',
    pipelineDescVlmLlm: '先转成结构描述，再自由提问',
    statusPipeline: '管道',
    statusModel: '模型',
    hotkeyLabel: '快捷键',
    captureFrameHint: '拖动框选要理解的区域',
    copied: '已复制',
    copyFailed: '复制失败',
    ollamaLocal: 'Ollama (本地)',
    openaiGpt4: 'OpenAI (GPT-4o)',
    anthropicClaude: 'Anthropic (Claude 3.5)',
    customEndpoint: '自定义端点',
    tesseractLocal: 'Tesseract (本地)',
    ollamaVision: 'Ollama (视觉模型)',
    baiduCloud: '百度云',
    googleVision: 'Google Vision',
    customVision: '自定义 (视觉)',
    showHideKey: '显示/隐藏密钥',
    testLlmConnection: '测试 LLM 连接',
    testVlmConnection: '测试 VLM 连接',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    processing: '处理中...',
    ocrNoText: 'OCR 未能识别到选区内的文字。',
    configSaved: '配置已保存',
    llmBaseUrl: 'LLM Base URL',
    ocrModelPlaceholder: 'OCR 模型',
    ocrApiKeyPlaceholder: 'OCR API Key (如需要)',
    llmModelPlaceholder: '模型名称 (例如: qwen2)',
    llmJsonPlaceholder: '提示词：翻译 JSON 内容',
    llm2ExplainPlaceholder: '提示词：解释 JSON 内容',
    chatScreenshot: '[截图: {w}x{h}]\n正在处理...',
    chatSaved: '对话已保存',
    exitChat: '退出对话',
    copyResult: '复制',
    closeResult: '关闭',
    continueScreenshot: '继续截图',
    inputPlaceholder: '输入问题...',
    askFollowup: '继续提问',
    attachImage: '添加图片',
    answerWithImage: '请查看附带的图片并回答。',
    saveChat: '保存对话',
    saveAsHistory: '保存为历史',
    messageCount: '{n} 条消息',
    analyzing: '正在分析...',
    thinkingProcess: '思考过程',
    collapse: '收起',
    expand: '展开',
    dragHint: '拖动选择区域 • 按 ESC 退出',
    closeMask: '关闭遮罩',
    translate: '翻译',
    explain: '解释',
    cancel: '取消',
    advancedMode: '高级模式',
    advancedModeDesc: '自定义节点与管道',
    multimodal: '多模态',
    basicModes: '基础模式',
    textMode: '仅文字',
    textModeDesc: '直接与语言模型对话，不支持截图',
    textModeNoCapture: '仅文字模式不支持截图，切换到多模态可截图识别',
    textChatEmpty: '输入问题，直接与语言模型对话',
    officialPresets: '混合模式',
    chat: '对话',
    customPipelines: '自定义管道',
    newPipeline: '新建管道',
    editPipeline: '编辑管道',
    pipelineName: '管道名称',
    placeholderPipelineName: '例如：截图转语音',
    addNode: '添加节点',
    nodeCategories: '节点类别',
    moveUp: '上移',
    moveDown: '下移',
    usePipeline: '启用',
    inUse: '使用中',
    noPipelines: '还没有自定义管道',
    noPipelinesHint: '把 VLM、LLM、OCR、TTS 等节点串成自己的管道，支持单节点或多节点',
    kindVlm: '视觉语言模型',
    kindLlm: '语言模型',
    kindOcr: '文字识别',
    kindAsr: '语音识别',
    kindTts: '语音合成',
    kindImagegen: '图像生成',
    kindCustom: '自定义',
    newNodeKind: '新建节点类别',
    newNodeKindLabel: '类别名称',
    newNodeKindApi: '接口形态',
    nodePrompt: '节点提示词',
    nodePromptExplain: '解释提示词（可选覆盖）',
    nodePromptHint: '支持 {input} 占位符接收上一步输出，留空使用默认',
    voice: '音色',
    savePipeline: '保存管道',
    confirmDeletePipeline: '确定删除这个管道吗？',
    pipelineNeedsName: '请先给管道起个名字',
    pipelineNeedsNode: '管道至少要有一个启用的节点',
    pipelineSaved: '管道已保存',
    customPipelineActive: '正在使用自定义管道，预设配置已暂停生效',
  },
  en: {
    title: 'Vision Bridge',
    screenshot: 'Screenshot',
    settings: 'Settings',
    ready: 'Ready',
    shortcut: 'Shortcut: Alt + A',
    startCapture: 'Start Capture',
    pipeline: 'Pipeline',
    vlmConfig: 'Visual Model Config',
    ocrLlmConfig: 'Modular Pipeline',
    vlmLlmConfig: 'Hybrid Pipeline',
    apiProvider: 'API Provider',
    baseUrl: 'Base URL',
    modelName: 'Model Name',
    apiKey: 'API Key',
    translatePrompt: 'Translate Prompt',
    explainPrompt: 'Explain Prompt',
    test: 'Test',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    testSuccess: 'Connection Successful',
    testFailed: 'Connection Failed',
    ocrEngine: 'OCR Engine',
    languageModel: 'Language Model',
    vlmJson: 'Visual Model (Extract JSON)',
    llmJson: 'Language Model (Process JSON)',
    jsonPrompt: 'JSON Conversion Prompt',
    modelValidation: 'Model Name Guidelines',
    validation1: 'Model names cannot have leading/trailing spaces',
    validation2: 'Only letters, numbers, colons, hyphens, underscores, dots, and slashes allowed',
    validation3: 'Examples: qwen2-vl:7b, deepseek-ai/DeepSeek-OCR',
    savedConfigs: 'Saved Configurations',
    show: 'Show',
    hide: 'Hide',
    configName: 'Config Name (e.g., SiliconFlow OCR)',
    apiFormatTags: 'API Format Tags',
    modelTypeTags: 'Model Type Tags',
    customTags: 'Custom Tags',
    add: 'Add',
    saveConfig: 'Save Current Configuration',
    noConfigs: 'No saved configurations',
    apply: 'Apply',
    delete: 'Delete',
    features: 'Features',
    textSelection: 'Text Selection',
    textSelectionDesc: 'Select text and a translate toolbar pops up',
    selectionTrigger: 'Trigger mode',
    triggerAuto: 'On selection',
    triggerHotkey: 'Hotkey only',
    closeBehavior: 'When closing the window',
    closeToTray: 'Minimize to tray',
    closeQuit: 'Quit app',
    toolbarButtons: 'Toolbar buttons',
    toolbarButtonsDesc: 'Buttons shown on the capture and selection toolbars, each with its own prompt',
    addAction: 'Add button',
    restoreDefaults: 'Restore defaults',
    actionLabel: 'Button name',
    actionPrompt: 'Prompt',
    actionPromptHint: 'Supports the {input} placeholder; leave empty to use the default translation prompt',
    fetchModels: 'Fetch models',
    fetchModelsFailed: 'Failed to fetch models: ',
    providerGroupCn: 'China services',
    providerGroupGlobal: 'Global services',
    providerGroupLocal: 'Local & custom',
    probeModels: 'Get model list',
    modelProbeTitle: 'Models',
    capVision: 'vision',
    capReasoning: 'reasoning',
    capTools: 'tools',
    catalogModels: 'Model catalog (models.dev)',
    liveModels: 'Vendor live list',
    probeSearch: 'Search models…',
    probeEmpty: 'No catalog data for this vendor — type the model id directly',
    sectionModel: 'Models',
    sectionPipeline: 'Pipelines',
    sectionGeneral: 'General',
    sectionConfig: 'Configs',
    sectionRecords: 'Records',
    sectionSystem: 'System',
    systemCoreSub: 'Service registry · reversible effects · typed events',
    systemCoreDesc: 'The cordis plugin runtime: every capability is a plugin service registered on a shared Context; registrations are reversible effects that unwind on unload.',
    systemSvcLlm: 'LLM service',
    systemSvcCapture: 'Capture service',
    systemSvcSessions: 'Records service',
    systemPlugSessions: 'Sessions plugin',
    systemPlugSessionsDesc: 'Records calls and conversations (one local-storage key per record, race-free across windows, auto-trimmed).',
    systemPlugLlm: 'LLM adapter plugin',
    systemPlugLlmDesc: 'Routes chat/ocr/tts/asr/imagegen/model-list through the platform bridge and logs every invocation.',
    systemPlugCapture: 'Capture plugin',
    systemPlugCaptureDesc: 'Wraps the platform screenshot bridge to grab screen regions as base64 images.',
    systemPlugBridge: 'Platform bridge',
    systemPlugBridgeDesc: 'window.ipcRenderer: the Tauri renderer-fetch shim, or the Electron preload → main bridge.',
    systemConsPipeline: 'Node-chain engine',
    systemConsApp: 'Main window',
    systemConsResult: 'Result card',
    systemConsProbe: 'Model probe',
    systemConsRecords: 'Records page',
    systemExtTitle: 'Extension slots (planned)',
    systemExtAgent: 'Agent loop',
    systemExtProviders: 'Third-party providers',
    systemExtTools: 'Custom tools',
    systemExtProfiles: 'Profile overlays',
    systemProvides: 'Provides',
    systemDepends: 'Depends on',
    systemUses: 'Uses',
    systemMilestone: 'Milestone',
    systemExtPlugsInto: 'Plugs into',
    systemStatus: 'Status',
    systemLive: 'Running',
    systemDead: 'Not running',
    systemDetailHint: 'Click any node in the map for details.',
    systemLegendBuiltin: 'Builtin plugin',
    systemLegendExt: 'Extension slot',
    systemLegendPlugins: 'Plugins',
    recordsTabSessions: 'Chats',
    recordsTabCalls: 'Calls',
    recordsEmptySessions: 'No conversation records',
    recordsEmptyCalls: 'No invocation records',
    recordsEmptyMessages: '(no messages)',
    recordsClear: 'Clear',
    recordsClearConfirm: 'Clear all records?',
    recordsTypeCapture: 'Capture',
    recordsTypeChat: 'Chat',
    recordsRoleUser: 'Q',
    recordsRoleAssistant: 'A',
    recordsKindChat: 'Chat',
    recordsKindOcr: 'OCR',
    recordsKindImagegen: 'ImageGen',
    recordsKindTts: 'TTS',
    recordsKindAsr: 'ASR',
    recordsKindListModels: 'Model list',
    recordsOk: 'OK',
    recordsFailed: 'Failed',
    recordsDuration: 'Duration',
    recordsCallProvider: 'Provider',
    appearance: 'Appearance',
    theme: 'Theme',
    language: 'Language',
    save: 'Save Configuration',
    saving: 'Saving...',
    saved: 'Saved',
    placeholderBaseUrl: 'e.g. http://127.0.0.1:11434',
    placeholderModel: 'e.g. qwen2-vl:7b',
    placeholderApiKey: 'sk-...',
    placeholderTranslatePrompt: 'Translation prompt...',
    placeholderExplainPrompt: 'Explanation prompt...',
    placeholderJsonPrompt: 'Prompt: Convert image to JSON format',
    placeholderConfigName: 'Enter configuration name',
    placeholderCustomTag: 'Enter custom tag',
    confirmDelete: 'Are you sure you want to delete this configuration?',
    saveFailed: 'Save failed: ',
    deleteFailed: 'Delete failed: ',
    enterConfigName: 'Please enter a configuration name',
    pipelineA: 'Pipeline A',
    pipelineB: 'Pipeline B',
    pipelineC: 'Pipeline C',
    pipelineDescVlm: 'One step — the image goes straight to a vision model',
    pipelineDescOcr: 'Read the text precisely first, then hand it to a language model',
    pipelineDescVlmLlm: 'Turn the image into a structured description, then ask anything',
    statusPipeline: 'Pipeline',
    statusModel: 'Model',
    hotkeyLabel: 'Shortcut',
    captureFrameHint: 'Drag to frame the area you want to understand',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    ollamaLocal: 'Ollama (Local)',
    openaiGpt4: 'OpenAI (GPT-4o)',
    anthropicClaude: 'Anthropic (Claude 3.5)',
    customEndpoint: 'Custom Endpoint',
    tesseractLocal: 'Tesseract (Local)',
    ollamaVision: 'Ollama (Vision Model)',
    baiduCloud: 'Baidu Cloud',
    googleVision: 'Google Vision',
    customVision: 'Custom (Vision)',
    showHideKey: 'Show/Hide Key',
    testLlmConnection: 'Test LLM Connection',
    testVlmConnection: 'Test VLM Connection',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    processing: 'Processing...',
    ocrNoText: 'OCR could not recognize any text in the selected area.',
    configSaved: 'Configuration saved',
    llmBaseUrl: 'LLM Base URL',
    ocrModelPlaceholder: 'OCR Model',
    ocrApiKeyPlaceholder: 'OCR API Key (if needed)',
    llmModelPlaceholder: 'Model Name (e.g. qwen2)',
    llmJsonPlaceholder: 'Prompt: Translate JSON content',
    llm2ExplainPlaceholder: 'Prompt: Explain JSON content',
    chatScreenshot: '[Screenshot: {w}x{h}]\nProcessing...',
    chatSaved: 'Chat saved',
    exitChat: 'Exit Chat',
    copyResult: 'Copy',
    closeResult: 'Close',
    continueScreenshot: 'Continue Screenshot',
    inputPlaceholder: 'Type a question...',
    askFollowup: 'Ask a follow-up',
    attachImage: 'Attach image',
    answerWithImage: 'Please look at the attached image(s) and answer.',
    saveChat: 'Save Chat',
    saveAsHistory: 'Save as History',
    messageCount: '{n} messages',
    analyzing: 'Analyzing...',
    thinkingProcess: 'Thought process',
    collapse: 'Collapse',
    expand: 'Expand',
    dragHint: 'Drag to select area • Press ESC to exit',
    closeMask: 'Close Overlay',
    translate: 'Translate',
    explain: 'Explain',
    cancel: 'Cancel',
    advancedMode: 'Advanced',
    advancedModeDesc: 'Compose nodes into custom pipelines',
    multimodal: 'Multimodal',
    basicModes: 'Basic modes',
    textMode: 'Text only',
    textModeDesc: 'Chat with a language model directly — no screenshots',
    textModeNoCapture: 'Text mode does not support screenshots — switch to Multimodal to capture',
    textChatEmpty: 'Type below to chat with the model',
    officialPresets: 'Hybrid modes',
    chat: 'Chat',
    customPipelines: 'Custom Pipelines',
    newPipeline: 'New Pipeline',
    editPipeline: 'Edit Pipeline',
    pipelineName: 'Pipeline name',
    placeholderPipelineName: 'e.g. Screenshot to speech',
    addNode: 'Add node',
    nodeCategories: 'Node categories',
    moveUp: 'Move up',
    moveDown: 'Move down',
    usePipeline: 'Use',
    inUse: 'Active',
    noPipelines: 'No custom pipelines yet',
    noPipelinesHint: 'Chain VLM, LLM, OCR, TTS and more into your own pipeline — single or multi node',
    kindVlm: 'Vision-Language Model',
    kindLlm: 'Language Model',
    kindOcr: 'OCR',
    kindAsr: 'Speech-to-Text',
    kindTts: 'Text-to-Speech',
    kindImagegen: 'Image Generation',
    kindCustom: 'Custom',
    newNodeKind: 'New node kind',
    newNodeKindLabel: 'Kind name',
    newNodeKindApi: 'Wire format',
    nodePrompt: 'Node prompt',
    nodePromptExplain: 'Explain prompt (optional override)',
    nodePromptHint: 'Supports the {input} placeholder; leave empty for defaults',
    voice: 'Voice',
    savePipeline: 'Save pipeline',
    confirmDeletePipeline: 'Delete this pipeline?',
    pipelineNeedsName: 'Name the pipeline first',
    pipelineNeedsNode: 'Add at least one enabled node',
    pipelineSaved: 'Pipeline saved',
    customPipelineActive: 'Using a custom pipeline — preset sections are paused',
  },
}
