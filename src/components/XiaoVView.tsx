import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, Bookmark, Check, ChevronRight, Copy, Cog, Plus, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { harness } from '../harness'
import { themes, tint } from '../theme/themes'
import type { ThemeConfig } from '../types'
import type { TFunc } from './settings/ui'

/**
 * 小V — the system assistant window. A persistent agent chat that sees the
 * user's records, remembers facts across sessions (ctx.knowledge) and can
 * drive every configured pipeline through ctx.tools. Persona (name + soul
 * prompt) is user-editable here.
 */

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
}

/** The app mark, same as the title bar. */
function Mark({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 28 28" fill="none" aria-hidden="true">
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

const XiaoVView: React.FC = () => {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<ThemeConfig>(themes.light)
  const [settings, setSettings] = useState<any>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSoul, setEditSoul] = useState('')
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const copyTimer = useRef<number | null>(null)

  const name = settings?.assistantName || t('xvDefaultName')
  const soul = settings?.soulPrompt || ''

  useEffect(() => {
    window.ipcRenderer?.getSettings().then((s: any) => {
      setSettings(s)
      setTheme(themes[(s?.theme as keyof typeof themes) || 'light'] || themes.light)
      setMessages([{ role: 'assistant', content: (s?.assistantName || t('xvDefaultName')) + ' ' + t('xvGreeting') }])
    }).catch(() => setMessages([{ role: 'assistant', content: t('xvGreeting') }]))
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current) }, [])

  const facts = harness().knowledge.listMemory()

  /** Persona + memory + recent activity, appended after the agent's base rules. */
  const buildPreamble = (): string => {
    const parts: string[] = [`你的名字是「${name}」。${soul}`]
    const mem = harness().knowledge.listMemory().slice(0, 8)
    if (mem.length) parts.push(`关于用户的长期记忆：\n${mem.map(f => `- ${f.text}`).join('\n')}`)
    const sess = harness().sessions.listSessions().slice(0, 5)
    if (sess.length) parts.push(`用户最近的活动：\n${sess.map(s => `- [${s.type}] ${s.title}`).join('\n')}`)
    return parts.join('\n\n')
  }

  const savePersona = async () => {
    const next = { ...(settings || {}), assistantName: editName.trim() || name, soulPrompt: editSoul }
    setSettings(next)
    setEditing(false)
    try { await window.ipcRenderer.saveSettings(next) } catch { /* keep local state */ }
  }

  const handleSend = async () => {
    if (sending) return
    const text = input.trim()
    if (!text) return
    setInput('')
    setSending(true)
    const newMessages: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages([...newMessages, { role: 'assistant', content: t('agentThinking') }])
    try {
      const r = await harness().agents.run({
        userText: text,
        maxSteps: 10,
        systemPreamble: buildPreamble(),
        onEvent: (e) => {
          setMessages(prev => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last || last.role !== 'assistant') return prev
            if (e.type === 'tool-call') last.content = `⚙ ${t('agentToolCalling')} ${e.name}…`
            else if (e.type === 'tool-result') {
              const line = `${e.ok ? '✓' : '✗'} ${e.name} (${(e.ms / 1000).toFixed(1)}s)`
              last.content = last.content.includes('⚙') ? line : `${last.content}\n${line}`
            }
            return [...next]
          })
        },
      })
      setMessages([...newMessages, { role: 'assistant', content: r.content }])
    } catch (error: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${error?.message || error}` }])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const rememberInput = (text: string) => {
    harness().knowledge.remember(text)
    setShowMemory(true)
    setEditing(false)
  }

  const vars = {
    '--glass-bg': theme.glassBg,
    '--glass-border': theme.glassBorder,
    '--glass-solid': theme.card,
  } as React.CSSProperties

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ ...vars, backgroundColor: theme.background, color: theme.text }}
    >
      {/* title bar */}
      <div
        data-tauri-drag-region
        className="h-9 shrink-0 flex items-center gap-2 pl-2.5 pr-1.5 select-none drag cursor-move border-b"
        style={{ borderColor: theme.hairline, backgroundColor: theme.card }}
      >
        <Mark color={theme.primary} />
        <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: theme.text }}>
          <Bot size={13} style={{ color: theme.accent }} />
          {name}
        </span>
        <span className="text-[10px]" style={{ color: theme.textMuted }}>{t('xvSubtitle')}</span>
        <div data-tauri-drag-region className="flex-1 self-stretch" />
        <div className="flex items-center gap-0.5 no-drag">
          <button
            type="button"
            onClick={() => { setEditing(!editing); setEditName(name); setEditSoul(soul) }}
            aria-label={t('xvPersona')}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors"
            style={{ color: editing ? theme.primary : theme.textSecondary }}
          >
            <Cog size={13} />
          </button>
          <button
            type="button"
            onClick={() => window.ipcRenderer.closeWindow()}
            aria-label={t('cancel')}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors"
            style={{ color: theme.textSecondary }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* persona editor */}
      {editing && (
        <div className="shrink-0 px-3 py-2.5 space-y-2 border-b animate-rise" style={{ borderColor: theme.hairline, backgroundColor: theme.card }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold shrink-0 w-14" style={{ color: theme.textMuted }}>{t('xvName')}</span>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 h-8 px-2.5 rounded-[8px] border bg-transparent outline-none text-[12px]"
              style={{ borderColor: theme.inputBorder, color: theme.text }}
            />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-semibold shrink-0 w-14 pt-2" style={{ color: theme.textMuted }}>{t('xvSoul')}</span>
            <textarea
              value={editSoul}
              onChange={(e) => setEditSoul(e.target.value)}
              rows={3}
              className="flex-1 px-2.5 py-2 rounded-[8px] border bg-transparent outline-none text-[11.5px] leading-relaxed resize-none"
              style={{ borderColor: theme.inputBorder, color: theme.text }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-7 px-2.5 rounded-[7px] text-[11px] border" style={{ borderColor: theme.hairline, color: theme.textMuted }}>
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={savePersona}
              className="h-7 px-3 rounded-[7px] text-[11px] font-semibold flex items-center gap-1"
              style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
            >
              <Check size={11} />{t('save')}
            </button>
          </div>
        </div>
      )}

      {/* body: chat + memory drawer */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3.5 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-[12px] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words border ${m.role === 'user' ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'}`}
                  style={m.role === 'user'
                    ? { backgroundColor: tint(theme.primary, theme.card, 0.14), borderColor: tint(theme.primary, theme.card, 0.3) }
                    : { backgroundColor: theme.card, borderColor: theme.hairline }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 px-3 pb-3 pt-1 space-y-1.5">
            <div className="flex items-end gap-2">
              <div
                className="flex-1 flex items-end gap-1.5 rounded-[12px] border px-2.5 py-1.5"
                style={{ borderColor: theme.inputBorder, backgroundColor: theme.inputBg }}
              >
                <button
                  type="button"
                  onClick={() => setShowMemory(!showMemory)}
                  aria-pressed={showMemory}
                  title={t('xvMemory')}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] transition-colors"
                  style={{ color: showMemory ? theme.accent : theme.textSecondary }}
                >
                  <Bookmark size={14} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={t('xvPlaceholder')}
                  className="flex-1 bg-transparent outline-none resize-none text-[12.5px] py-1.5"
                  style={{ color: theme.text }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] transition-[transform,filter] duration-fast ease-out-quart hover:brightness-110 active:scale-[0.94] disabled:opacity-40"
                  style={{ backgroundColor: theme.primary, color: theme.onPrimary }}
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-0.5">
              <span className="flex items-center gap-1 text-[10.5px]" style={{ color: theme.textMuted }}>
                <Bot size={10} />{t('xvAgentOn')}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(messages.map(m => `${m.role === 'user' ? '>>' : name}: ${m.content}`).join('\n\n')).then(() => {
                    setCopied(true)
                    if (copyTimer.current) window.clearTimeout(copyTimer.current)
                    copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
                  }).catch(() => {})
                }}
                className="flex items-center gap-1 text-[10.5px]"
                style={{ color: copied ? theme.success : theme.textMuted }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}{copied ? t('copied') : t('copyResult')}
              </button>
            </div>
          </div>
        </div>

        {/* memory drawer */}
        {showMemory && (
          <div className="w-56 shrink-0 border-l flex flex-col animate-rise" style={{ borderColor: theme.hairline, backgroundColor: theme.card }}>
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: theme.hairline }}>
              <span className="eyebrow" style={{ color: theme.textSecondary }}>{t('xvMemory')}</span>
              <button type="button" onClick={() => setShowMemory(false)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: theme.textMuted }}>
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2.5 py-2 space-y-1.5">
              {facts.length === 0 && <p className="text-[10.5px] py-3 text-center" style={{ color: theme.textMuted }}>{t('xvMemoryEmpty')}</p>}
              {facts.map(f => (
                <div key={f.id} className="group flex items-start gap-1.5 rounded-[8px] px-2 py-1.5" style={{ backgroundColor: tint(theme.text, theme.card, 0.04) }}>
                  <p className="flex-1 text-[10.5px] leading-relaxed" style={{ color: theme.text }}>{f.text}</p>
                  <button
                    type="button"
                    onClick={() => harness().knowledge.forget(f.id)}
                    aria-label={t('delete')}
                    className="w-4 h-4 shrink-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: theme.danger }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-2 border-t" style={{ borderColor: theme.hairline }}>
              <MemoryInput theme={theme} onAdd={rememberInput} t={t} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MemoryInput: React.FC<{ theme: ThemeConfig; onAdd: (text: string) => void; t: TFunc }> = ({ theme, onAdd, t }) => {
  const [text, setText] = useState('')
  const add = () => {
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        placeholder={t('xvMemoryPlaceholder')}
        className="flex-1 h-7 px-2 rounded-[7px] border bg-transparent outline-none text-[10.5px]"
        style={{ borderColor: theme.inputBorder, color: theme.text }}
      />
      <button
        type="button"
        onClick={add}
        className="w-7 h-7 flex items-center justify-center rounded-[7px]"
        style={{ backgroundColor: tint(theme.primary, theme.card, 0.16), color: theme.primary }}
        aria-label={t('add')}
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

export default XiaoVView
