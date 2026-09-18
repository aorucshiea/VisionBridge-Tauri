import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronRight, Copy, Image as ImageIcon, ImagePlus, MessageSquare, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { captureRegion } from '../lib/screenshot'
import { getActiveNodes, runNodeChain, taskPromptsOf, resolveAction, IMAGE_MARKER_RE } from '../lib/pipeline'
import { themes, tint } from '../theme/themes'
import type { ThemeConfig } from '../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Model thinking (reasoning) that produced this message, when available. */
  reasoning?: string
  /** Attached images (data URLs) sent with a user message. */
  images?: string[]
}

/**
 * Renders result text, expanding `[[vbimg:…]]` markers (produced by image
 * generation nodes) into actual images.
 */
function RichContent({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'img'; value: string }> = []
  let last = 0
  for (const m of text.matchAll(IMAGE_MARKER_RE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push({ type: 'text', value: text.slice(last, idx) })
    parts.push({ type: 'img', value: m[1] })
    last = idx + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return (
    <>
      {parts.map((p, i) => p.type === 'text' ? (
        <span key={i} className="whitespace-pre-wrap break-words">{p.value}</span>
      ) : (
        <img
          key={i}
          src={p.value}
          alt=""
          className="block my-2 max-w-full rounded-lg border"
          style={{ borderColor: 'rgba(0,0,0,0.1)' }}
        />
      ))}
    </>
  )
}

/** The app mark, repeated so the floating card is identifiable at a glance. */
function Mark({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7.5" fill={color} fillOpacity="0.16" />
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <path d="M7.6 11.2V9.3a1.7 1.7 0 0 1 1.7-1.7h1.9" />
        <path d="M16.8 7.6h1.9a1.7 1.7 0 0 1 1.7 1.7v1.9" />
        <path d="M20.4 16.8v1.9a1.7 1.7 0 0 1-1.7 1.7h-1.9" />
        <path d="M11.2 20.4H9.3a1.7 1.7 0 0 1-1.7-1.7v-1.9" />
      </g>
      <rect x="10.2" y="13.05" width="7.6" height="1.9" rx="0.95" fill={color} />
    </svg>
  )
}

/** Icon button used in the card's title bar. */
function BarButton({ onClick, label, tintColor, children }: {
  onClick: () => void
  label: string
  tintColor: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-[background-color,color,transform] duration-fast ease-out-quart active:scale-[0.94] no-drag"
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tintColor }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

const ResultView: React.FC = () => {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<ThemeConfig>(themes.light)
  const [content, setContent] = useState<string>('')
  const [reasoning, setReasoning] = useState<string>('')
  const [showThinking, setShowThinking] = useState<boolean>(true)
  const [isProcessing, setIsProcessing] = useState<boolean>(true)
  const [isChatMode, setIsChatMode] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  /** Local images picked for the next chat message (data URLs). */
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [saveAsHistory, setSaveAsHistory] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const copyTimer = useRef<number | null>(null)

  useEffect(() => {
    const ipc = window.ipcRenderer
    if (!ipc) return
    ipc.getSettings().then((settings: any) => {
      // Keep the theme for the boot frame, then prefer the live value.
      setTheme(themes[(settings?.theme as keyof typeof themes) || 'light'] || themes.light)
    }).catch(() => {})
  }, [])

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current) }, [])

  useEffect(() => {
    const ipc = window.ipcRenderer
    if (!ipc) { setIsProcessing(false); return }
    return ipc.onDisplayContent((data) => {
      // Final content replaces the streamed text. Deliberately keep the
      // reasoning accumulated from live deltas — the payload carries no
      // reasoning, and clearing it here made the thinking block vanish the
      // moment generation finished.
      setContent(data)
      setShowThinking(true)
      setIsProcessing(false)
      setIsChatMode(false)
      setMessages([])
    })
  }, [])

  // "Working" signal: the card was just opened for a fresh task (screenshot,
  // Alt+T, toolbar action). Reset stale state and show the sweep animation
  // until the first delta or the final content arrives.
  useEffect(() => {
    const ipc = window.ipcRenderer as any
    if (!ipc || typeof ipc.onDisplayProcessing !== 'function') return
    return ipc.onDisplayProcessing(() => {
      setContent('')
      setReasoning('')
      setShowThinking(true)
      setIsProcessing(true)
      setIsChatMode(false)
      setMessages([])
    })
  }, [])

  // Live deltas: the main window (or this window in chat mode) streams the
  // answer while the pipeline is still running.
  useEffect(() => {
    const ipc = window.ipcRenderer as any
    if (!ipc || typeof ipc.onDisplayDelta !== 'function') return
    return ipc.onDisplayDelta((d: { content?: string; reasoning?: string }) => {
      setIsProcessing(false)
      setIsChatMode(false)
      if (d.reasoning) setReasoning(prev => prev + d.reasoning)
      if (d.content) setContent(prev => prev + d.content)
    })
  }, [])

  // Grow the frameless window to fit the content (clamped host-side) so long
  // answers stay readable instead of being squeezed into a tiny viewport.
  useEffect(() => {
    const ipc = window.ipcRenderer as any
    if (!ipc || typeof ipc.resizeResult !== 'function') return
    const raf = window.requestAnimationFrame(() => {
      const body = bodyRef.current
      if (!body) return
      const natural = 36 + body.scrollHeight // title bar (h-9) + content
      const maxH = Math.min(Math.round((window.screen?.height || 1080) * 0.7), 640)
      ipc.resizeResult(Math.max(200, Math.min(natural + 2, maxH))).catch(() => {})
    })
    return () => window.cancelAnimationFrame(raf)
  }, [content, reasoning, messages, isProcessing, isChatMode])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Listen for append-screenshot event (chat mode)
  useEffect(() => {
    const ipc = window.ipcRenderer
    if (!ipc) return
    return ipc.onAppendScreenshot((data) => {
      setIsChatMode(true)
      setIsProcessing(false)
      setMessages(prev => [...prev, { role: 'user', content: `[${t('screenshot')}: ${data.region.width}x${data.region.height}]\n${t('processing')}` }])
      setIsSending(true)
      processScreenshot(data.region, data.action)
    })
  }, [])

  const processScreenshot = async (region: any, actionId: string) => {
    try {
      const ipc = window.ipcRenderer
      const croppedBase64 = await captureRegion(region)
      const currentSettings = await ipc.getSettings()

      // Chat mode shares the same node-chain engine as the main window.
      const nodes = getActiveNodes(currentSettings)
      if (!nodes || nodes.length === 0) throw new Error(t('pipelineNeedsNode'))

      const { task, promptOverride } = resolveAction(actionId, currentSettings)
      // Stream into the last user bubble while the chain runs.
      let streamed = ''
      const onDelta = (d: { content?: string; reasoning?: string }) => {
        if (d.content) streamed += d.content
        setMessages(prev => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage && lastMessage.role === 'user') {
            lastMessage.content = `[${t('screenshot')}: ${region.width}x${region.height}]\n${streamed}`
            if (d.reasoning) lastMessage.reasoning = (lastMessage.reasoning || '') + d.reasoning
          }
          return [...newMessages]
        })
      }
      const { content: result, reasoning } = await runNodeChain({
        nodes,
        image: croppedBase64,
        task,
        taskPrompts: taskPromptsOf(currentSettings),
        promptOverride,
        onDelta,
      })

      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = `[${t('screenshot')}: ${region.width}x${region.height}]\n${result}`
          lastMessage.reasoning = reasoning || lastMessage.reasoning
        }
        return newMessages
      })
    } catch (error: any) {
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = `[${t('screenshot')}: ${region.width}x${region.height}]\nError: ${error.message}`
        }
        return newMessages
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    // Save chat history in the background - never block closing
    if (saveAsHistory && messages.length > 0) {
      window.ipcRenderer.saveChatHistory({ messages, originalContent: content })
        .catch((error) => console.error('Failed to save chat history:', error))
    }
    window.ipcRenderer.hideResult()
  }

  const handleCopy = async () => {
    // In chat mode copy the whole conversation; otherwise the plain result.
    const text = isChatMode
      ? messages.map(m => `${m.role === 'user' ? '>>' : 'AI'}: ${m.content}`).join('\n\n')
      : content
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.error('[ResultView] Copy failed:', error)
    }
  }

  /** Open the chat input, seeded with the current result as context. */
  const enterChatFromResult = () => {
    setMessages(content.trim()
      ? [{ role: 'assistant', content, reasoning: reasoning || undefined }]
      : [])
    setPendingImages([])
    setIsProcessing(false)
    setIsChatMode(true)
  }

  /** Read picked local images as data URLs for the next chat message. */
  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // allow re-picking the same file later
    const room = 4 - pendingImages.length
    if (room <= 0 || files.length === 0) return
    Promise.all(files.slice(0, room).map(file => new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }))).then((picked) => {
      const ok = picked.filter((s): s is string => !!s)
      if (ok.length) setPendingImages(prev => [...prev, ...ok])
    })
  }

  const handleSend = async () => {
    if (isSending) return
    const text = inputText.trim()
    if (!text && pendingImages.length === 0) return
    const images = pendingImages.length ? [...pendingImages] : undefined
    const userMessage = text || (images ? t('answerWithImage') : '')
    setInputText('')
    setPendingImages([])
    setIsSending(true)

    const newMessages = [...messages, { role: 'user' as const, content: userMessage, images }]
    setMessages(newMessages)

    try {
      const ipc = window.ipcRenderer as any
      let response: { content: string; reasoning: string }
      if (typeof ipc.chatWithAIStream === 'function') {
        // Stream into a placeholder assistant bubble.
        let streamed = ''
        let streamedReasoning = ''
        setMessages([...newMessages, { role: 'assistant', content: '…' }])
        response = await ipc.chatWithAIStream(
          newMessages.map(m => ({ role: m.role, content: m.content })),
          (d: { content?: string; reasoning?: string }) => {
            if (d.content) streamed += d.content
            if (d.reasoning) streamedReasoning += d.reasoning
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                last.content = streamed || '…'
                last.reasoning = streamedReasoning || undefined
              }
              return [...next]
            })
          },
          images,
        )
      } else {
        response = { content: await window.ipcRenderer.chatWithAI(newMessages.map(m => ({ role: m.role, content: m.content })), images), reasoning: '' }
      }
      setMessages([...newMessages, { role: 'assistant', content: response.content, reasoning: response.reasoning || undefined }])
    } catch (error: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${error.message}` }])
    } finally {
      setIsSending(false)
    }
  }

  const handleContinueScreenshot = () => {
    window.ipcRenderer.hideResult()
    // Route the upcoming capture back to this chat window.
    window.ipcRenderer.openMask('result')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const vars = {
    '--glass-bg': theme.glassBg,
    '--glass-border': theme.glassBorder,
    '--glass-solid': theme.card,
    '--scroll-thumb': `${theme.textMuted}66`,
    '--scroll-thumb-hover': `${theme.textMuted}99`,
    '--focus-ring': theme.primary,
    '--kbd-bg': tint(theme.text, theme.background, 0.07),
    '--kbd-border': theme.hairline,
    '--kbd-fg': theme.textSecondary,
    '--sweep-color': theme.primary,
  } as React.CSSProperties

  const hoverBg = tint(theme.text, theme.card, 0.08)

  return (
    <div
      className="fixed inset-0 flex flex-col glass rounded-[14px] overflow-hidden animate-pop"
      style={{
        ...vars,
        color: theme.text,
        boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 10px 24px -8px rgba(0,0,0,0.28), 0 32px 64px -28px rgba(0,0,0,0.4)',
      }}
    >
      {/* Draggable title bar (Electron: -webkit-app-region; Tauri: data-tauri-drag-region) */}
      <div
        data-tauri-drag-region
        className="h-9 shrink-0 flex items-center gap-2 pl-2.5 pr-1.5 select-none drag cursor-move"
        style={{ borderBottom: `1px solid ${theme.hairline}` }}
      >
        <Mark color={theme.primary} />
        <span data-tauri-drag-region className="eyebrow truncate" style={{ color: theme.textSecondary }}>
          {t('title')}
        </span>

        <div data-tauri-drag-region className="flex-1 self-stretch" />

        <div className="flex items-center gap-0.5 no-drag">
          {isChatMode && (
            <BarButton onClick={() => setIsChatMode(false)} label={t('exitChat')} tintColor={hoverBg}>
              <MessageSquare size={13} style={{ color: theme.textSecondary }} />
            </BarButton>
          )}
          <BarButton onClick={handleCopy} label={copied ? t('copied') : t('copyResult')} tintColor={hoverBg}>
            {copied
              ? <Check size={13} style={{ color: theme.success }} />
              : <Copy size={13} style={{ color: theme.textSecondary }} />}
          </BarButton>
          <button
            type="button"
            onClick={handleClose}
            title={t('closeResult')}
            aria-label={t('closeResult')}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-[background-color,color,transform] duration-fast ease-out-quart active:scale-[0.94] no-drag"
            style={{ color: theme.textSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.14); e.currentTarget.style.color = theme.danger }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.textSecondary }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body — min-h-0 lets flex-1 actually shrink so overflow-auto scrolls
          (without it the content stretches the pane and no scrollbar appears). */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar no-drag">
        {isChatMode ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-3 py-3 space-y-2.5">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[86%] rounded-[11px] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words"
                    style={msg.role === 'user'
                      ? { backgroundColor: tint(theme.primary, theme.card, 0.14), color: theme.text, border: `1px solid ${tint(theme.primary, theme.card, 0.26)}` }
                      : { backgroundColor: tint(theme.text, theme.card, 0.05), color: theme.text, border: `1px solid ${theme.hairline}` }}
                  >
                    {msg.role === 'user'
                      ? (
                        <>
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mb-1.5">
                              {msg.images.map((src, i) => (
                                <img
                                  key={i}
                                  src={src}
                                  alt=""
                                  className="w-20 h-20 object-cover rounded-[8px] border"
                                  style={{ borderColor: theme.hairline }}
                                />
                              ))}
                            </div>
                          )}
                          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                          {msg.reasoning && msg.reasoning.trim() !== '' && (
                            <div
                              className="mt-1.5 pt-1.5 text-[11px] leading-[1.6] whitespace-pre-wrap break-words"
                              style={{ color: theme.textSecondary, borderTop: `1px dashed ${theme.hairline}` }}
                            >
                              {msg.reasoning}
                            </div>
                          )}
                        </>
                      )
                      : (
                        <>
                          {msg.reasoning && msg.reasoning.trim() !== '' && (
                            <div
                              className="mb-1.5 pb-1.5 text-[11px] leading-[1.6] whitespace-pre-wrap break-words"
                              style={{ color: theme.textSecondary, borderBottom: `1px dashed ${theme.hairline}` }}
                            >
                              {msg.reasoning}
                            </div>
                          )}
                          <RichContent text={msg.content} />
                        </>
                      )}
                  </div>
                </div>
              ))}
              {isSending && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="w-24 h-7 rounded-[11px] border sweep-track" style={{ backgroundColor: tint(theme.text, theme.card, 0.05), borderColor: theme.hairline }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-3 py-2.5 space-y-2" style={{ borderTop: `1px solid ${theme.hairline}` }}>
              {pendingImages.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {pendingImages.map((src, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-[8px] overflow-hidden border" style={{ borderColor: theme.hairline }}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                        aria-label="remove image"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleContinueScreenshot}
                  disabled={isSending}
                  title={t('continueScreenshot')}
                  aria-label={t('continueScreenshot')}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] border transition-[transform,background-color] duration-fast ease-out-quart active:scale-[0.94] disabled:opacity-50"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
                >
                  <ImageIcon size={14} />
                </button>
                <label
                  title={t('attachImage')}
                  aria-label={t('attachImage')}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] border transition-[transform,background-color] duration-fast ease-out-quart active:scale-[0.94] cursor-pointer"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
                >
                  <ImagePlus size={14} />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                </label>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('inputPlaceholder')}
                  aria-label={t('inputPlaceholder')}
                  className="flex-1 h-8 px-3 text-[12.5px] rounded-[9px] border outline-none transition-[border-color,box-shadow] duration-fast ease-out-quart disabled:opacity-50"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = theme.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}22` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = theme.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
                  disabled={isSending}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || (!inputText.trim() && pendingImages.length === 0)}
                  aria-label={t('inputPlaceholder')}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] transition-[transform,filter] duration-fast ease-out-quart hover:brightness-110 active:scale-[0.94] disabled:opacity-40"
                  style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
                >
                  <ArrowUp size={15} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSaveAsHistory(!saveAsHistory)}
                  aria-pressed={saveAsHistory}
                  className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-medium border transition-colors duration-fast ease-out-quart"
                  style={saveAsHistory
                    ? { backgroundColor: tint(theme.success, theme.card, 0.14), borderColor: tint(theme.success, theme.card, 0.3), color: theme.success }
                    : { backgroundColor: 'transparent', borderColor: 'transparent', color: theme.textSecondary }}
                >
                  {saveAsHistory ? <Check size={11} /> : null}
                  {saveAsHistory ? t('saveChat') : t('saveAsHistory')}
                </button>
                <span className="text-[11px]" style={{ color: theme.textMuted }}>
                  {t('messageCount').replace('{n}', String(messages.length))}
                </span>
              </div>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="h-full flex flex-col justify-center gap-3 px-4">
            <div className="h-1.5 rounded-full sweep-track" style={{ backgroundColor: tint(theme.text, theme.card, 0.07) }} />
            <p className="text-[11.5px] text-center" style={{ color: theme.textMuted }}>{t('analyzing')}</p>
          </div>
        ) : (
          <div
            className="px-3.5 py-3 text-[13px] leading-[1.72] break-words selection:bg-primary-200/60"
            style={{ color: theme.text }}
          >
            {reasoning.trim() !== '' && (
              <div
                className="mb-2.5 rounded-[10px] border"
                style={{ backgroundColor: tint(theme.text, theme.card, 0.04), borderColor: theme.hairline }}
              >
                <button
                  type="button"
                  onClick={() => setShowThinking(!showThinking)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium no-drag"
                  style={{ color: theme.textSecondary }}
                  aria-expanded={showThinking}
                >
                  <ChevronRight
                    size={11}
                    className="transition-transform duration-fast ease-out-quart"
                    style={{ transform: showThinking ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                  {t('thinkingProcess')}
                </button>
                {showThinking && (
                  <div
                    className="px-2.5 pb-2 text-[11.5px] leading-[1.65] whitespace-pre-wrap break-words"
                    style={{ color: theme.textMuted }}
                  >
                    {reasoning}
                  </div>
                )}
              </div>
            )}
            <RichContent text={content} />
          </div>
        )}
      </div>

      {/* Floating follow-up entry: opens the chat input seeded with this
          result as context. Sits in the card's bottom-right corner. */}
      {!isChatMode && !isProcessing && content.trim() !== '' && (
        <button
          type="button"
          onClick={enterChatFromResult}
          title={t('askFollowup')}
          aria-label={t('askFollowup')}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-[11.5px] font-medium transition-[transform,filter] duration-fast ease-out-quart hover:brightness-105 active:scale-[0.96] no-drag"
          style={{ backgroundColor: theme.primary, color: theme.onPrimary, boxShadow: `0 6px 18px -6px ${theme.primary}aa` }}
        >
          <MessageSquare size={13} />
          {t('askFollowup')}
        </button>
      )}
    </div>
  )
}

export default ResultView
