import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, MessageSquare } from 'lucide-react'
import type { ThemeConfig } from '../types'
import { tint } from '../theme/themes'
import type { TFunc } from './settings/ui'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Text-only mode: a plain conversation with the LLM, embedded in the main
 * window. No capture — that's what multimodal mode is for.
 */
const TextChat: React.FC<{
  theme: ThemeConfig
  t: TFunc
}> = ({ theme, t }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const reply = await window.ipcRenderer.chatWithAI(
        next.map(m => ({ role: m.role, content: m.content })))
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (error: any) {
      setMessages([...next, { role: 'assistant', content: `Error: ${error?.message || error}` }])
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {messages.length === 0 && !sending ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <span className="w-11 h-11 rounded-[13px] flex items-center justify-center"
            style={{ backgroundColor: tint(theme.primary, theme.card, 0.1), color: theme.primary }}>
            <MessageSquare size={20} />
          </span>
          <p className="mt-3.5 text-[12.5px] leading-relaxed max-w-[30ch]" style={{ color: theme.textSecondary }}>
            {t('textChatEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2.5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[86%] rounded-[11px] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words"
                style={msg.role === 'user'
                  ? { backgroundColor: tint(theme.primary, theme.card, 0.14), color: theme.text, border: `1px solid ${tint(theme.primary, theme.card, 0.26)}` }
                  : { backgroundColor: tint(theme.text, theme.card, 0.05), color: theme.text, border: `1px solid ${theme.hairline}` }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="w-24 h-7 rounded-[11px] border sweep-track"
                style={{ backgroundColor: tint(theme.text, theme.card, 0.05), borderColor: theme.hairline }} />
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="shrink-0 pt-2.5 pb-1 flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('inputPlaceholder')}
          aria-label={t('inputPlaceholder')}
          disabled={sending}
          className="flex-1 h-9 px-3 text-[12.5px] rounded-[10px] border outline-none transition-[border-color,box-shadow] duration-fast ease-out-quart disabled:opacity-50"
          style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
          onFocus={(e) => { e.currentTarget.style.borderColor = theme.inputFocus; e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primary}22` }}
          onBlur={(e) => { e.currentTarget.style.borderColor = theme.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          aria-label={t('inputPlaceholder')}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[10px] transition-[transform,filter] duration-fast ease-out-quart hover:brightness-110 active:scale-[0.94] disabled:opacity-40"
          style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
        >
          <ArrowUp size={15} />
        </button>
      </div>
    </div>
  )
}

export default TextChat
