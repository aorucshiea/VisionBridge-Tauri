import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Copy, Image as ImageIcon, MessageSquare, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { captureRegion } from '../lib/screenshot'
import { getActiveNodes, runNodeChain, taskPromptsOf, resolveAction, IMAGE_MARKER_RE } from '../lib/pipeline'
import { themes, tint } from '../theme/themes'
import type { ThemeConfig } from '../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  const [isProcessing, setIsProcessing] = useState<boolean>(true)
  const [isChatMode, setIsChatMode] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  const [saveAsHistory, setSaveAsHistory] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      setContent(data)
      setIsProcessing(false)
      setIsChatMode(false)
      setMessages([])
    })
  }, [])

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
      const { content: result } = await runNodeChain({
        nodes,
        image: croppedBase64,
        task,
        taskPrompts: taskPromptsOf(currentSettings),
        promptOverride,
      })

      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = `[${t('screenshot')}: ${region.width}x${region.height}]\n${result}`
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

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return

    const userMessage = inputText.trim()
    setInputText('')
    setIsSending(true)

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)

    try {
      const response = await window.ipcRenderer.chatWithAI(newMessages)
      setMessages([...newMessages, { role: 'assistant', content: response }])
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
      className="w-full h-full glass rounded-[14px] flex flex-col overflow-hidden animate-pop"
      style={{
        ...vars,
        color: theme.text,
        boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 10px 24px -8px rgba(0,0,0,0.28), 0 32px 64px -28px rgba(0,0,0,0.4)',
      }}
    >
      {/* Draggable title bar */}
      <div
        className="h-9 shrink-0 flex items-center gap-2 pl-2.5 pr-1.5 select-none drag cursor-move"
        style={{ borderBottom: `1px solid ${theme.hairline}` }}
      >
        <Mark color={theme.primary} />
        <span className="eyebrow truncate" style={{ color: theme.textSecondary }}>
          {t('title')}
        </span>

        <div className="flex-1" />

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

      {/* Body */}
      <div className="flex-1 overflow-auto custom-scrollbar no-drag">
        {isChatMode ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 px-3 py-3 space-y-2.5">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[86%] rounded-[11px] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words"
                    style={msg.role === 'user'
                      ? { backgroundColor: tint(theme.primary, theme.card, 0.14), color: theme.text, border: `1px solid ${tint(theme.primary, theme.card, 0.26)}` }
                      : { backgroundColor: tint(theme.text, theme.card, 0.05), color: theme.text, border: `1px solid ${theme.hairline}` }}
                  >
                    {msg.role === 'user'
                      ? <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                      : <RichContent text={msg.content} />}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="w-24 h-7 rounded-[11px] border sweep-track" style={{ backgroundColor: tint(theme.text, theme.card, 0.05), borderColor: theme.hairline }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-3 py-2.5 space-y-2" style={{ borderTop: `1px solid ${theme.hairline}` }}>
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
                  disabled={isSending || !inputText.trim()}
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
            <RichContent text={content} />
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultView
