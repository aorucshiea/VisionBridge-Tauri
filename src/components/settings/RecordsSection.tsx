import React, { useEffect, useState } from 'react'
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { CallKind, CallRecord, SessionRecord } from '../../harness/services'
import type { TranslationDict } from '../../i18n'
import { tint } from '../../theme/themes'
import type { ThemeConfig } from '../../types'
import { Card, type TFunc } from './ui'

const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const fmtDuration = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

type Tab = 'sessions' | 'calls'

/** 记录 section: conversation records (对话记录) + invocation records (调用记录). */
const RecordsSection: React.FC<{ theme: ThemeConfig; t: TFunc }> = ({ theme, t }) => {
  const [tab, setTab] = useState<Tab>('sessions')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      const s = window.__VB_HARNESS__?.sessions
      if (!s) return
      setSessions(s.listSessions())
      setCalls(s.listCalls())
    }
    refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => window.clearInterval(timer)
  }, [tab])

  const store = () => window.__VB_HARNESS__?.sessions

  const removeRecord = (id: string) => {
    const s = store()
    if (!s) return
    if (tab === 'sessions') s.deleteSession(id)
    else s.deleteCall(id)
    setSessions(s.listSessions())
    setCalls(s.listCalls())
  }

  const clearTab = () => {
    const s = store()
    if (!s) return
    if (!window.confirm(t('recordsClearConfirm'))) return
    if (tab === 'sessions') s.clearSessions()
    else s.clearCalls()
    setSessions([])
    setCalls([])
    setExpanded(null)
  }

  const kindLabel = (kind: CallKind): string => t(KIND_LABEL_KEYS[kind])

  const tabBtn = (id: Tab, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => { setTab(id); setExpanded(null) }}
      className="h-8 px-3 rounded-full text-[11.5px] font-semibold flex items-center gap-1.5 transition-[background-color,color] duration-fast ease-out-quart"
      style={tab === id
        ? { backgroundColor: tint(theme.primary, theme.card, 0.16), color: theme.primary }
        : { color: theme.textSecondary }}
    >
      {label}
      <span
        className="px-1.5 rounded-full text-[10px] tabular-nums"
        style={{ backgroundColor: tint(theme.text, theme.card, 0.08) }}
      >
        {count}
      </span>
    </button>
  )

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {tabBtn('sessions', t('recordsTabSessions'), sessions.length)}
          {tabBtn('calls', t('recordsTabCalls'), calls.length)}
        </div>
        {((tab === 'sessions' && sessions.length > 0) || (tab === 'calls' && calls.length > 0)) && (
          <button
            type="button"
            onClick={clearTab}
            className="h-7 px-2.5 rounded-[7px] text-[11px] font-semibold border flex items-center gap-1 transition-[background-color,color,transform] duration-fast ease-out-quart active:scale-[0.96]"
            style={{ backgroundColor: 'transparent', borderColor: theme.hairline, color: theme.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.14); e.currentTarget.style.color = theme.danger }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.textMuted }}
          >
            <Trash2 size={11} />
            {t('recordsClear')}
          </button>
        )}
      </div>

      {tab === 'sessions' && (
        sessions.length === 0 ? (
          <p className="text-[11px] text-center py-8" style={{ color: theme.textMuted }}>{t('recordsEmptySessions')}</p>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <Card key={s.id} theme={theme} pad={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
                >
                  {expanded === s.id ? <ChevronDown size={13} style={{ color: theme.textMuted }} /> : <ChevronRight size={13} style={{ color: theme.textMuted }} />}
                  <span
                    className="px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0"
                    style={{
                      backgroundColor: tint(s.type === 'capture' ? theme.primary : theme.accent, theme.card, 0.14),
                      color: s.type === 'capture' ? theme.primary : theme.accent,
                    }}
                  >
                    {s.type === 'capture' ? t('recordsTypeCapture') : t('recordsTypeChat')}
                  </span>
                  <span className="flex-1 min-w-0 text-[12px] font-medium truncate" style={{ color: theme.text }}>{s.title}</span>
                  {s.model && <span className="text-[10px] font-mono truncate hidden sm:block" style={{ color: theme.textMuted }}>{s.model}</span>}
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: theme.textMuted }}>{fmtTime(s.updatedAt)}</span>
                  <span
                    role="button"
                    aria-label={t('delete')}
                    onClick={(e) => { e.stopPropagation(); removeRecord(s.id) }}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors duration-fast shrink-0"
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.16); e.currentTarget.style.color = theme.danger }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'inherit' }}
                  >
                    <Trash2 size={11} />
                  </span>
                </button>
                {expanded === s.id && (
                  <div className="px-3.5 pb-3 pt-1 space-y-2 border-t" style={{ borderColor: theme.hairline }}>
                    {s.messages.length === 0 && (
                      <p className="text-[11px]" style={{ color: theme.textMuted }}>{t('recordsEmptyMessages')}</p>
                    )}
                    {s.messages.map((m, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-[10px] font-bold" style={{ color: m.role === 'user' ? theme.primary : theme.accent }}>
                          {m.role === 'user' ? t('recordsRoleUser') : t('recordsRoleAssistant')}
                          <span className="ml-1.5 font-normal tabular-nums" style={{ color: theme.textMuted }}>{fmtTime(m.ts)}</span>
                        </p>
                        {m.image && <img src={m.image} alt="" className="rounded-md max-h-28 border" style={{ borderColor: theme.hairline }} />}
                        <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: theme.text }}>{m.content}</p>
                        {m.reasoning && (
                          <p className="text-[10.5px] leading-relaxed whitespace-pre-wrap break-words px-2 py-1.5 rounded-md" style={{ color: theme.textMuted, backgroundColor: tint(theme.text, theme.card, 0.05) }}>
                            {m.reasoning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'calls' && (
        calls.length === 0 ? (
          <p className="text-[11px] text-center py-8" style={{ color: theme.textMuted }}>{t('recordsEmptyCalls')}</p>
        ) : (
          <div className="space-y-1.5">
            {calls.map(c => (
              <Card key={c.id} theme={theme} pad={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.ok ? theme.success : theme.danger }}
                    aria-label={c.ok ? t('recordsOk') : t('recordsFailed')}
                  />
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: theme.text }}>{kindLabel(c.kind)}</span>
                  <span className="flex-1 min-w-0 text-[10.5px] font-mono truncate" style={{ color: theme.textMuted }}>{c.model || c.provider || '—'}</span>
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: theme.textMuted }}>{fmtDuration(c.durationMs)}</span>
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: theme.textMuted }}>{fmtTime(c.ts)}</span>
                  <span
                    role="button"
                    aria-label={t('delete')}
                    onClick={(e) => { e.stopPropagation(); removeRecord(c.id) }}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors duration-fast shrink-0"
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.danger, theme.card, 0.16); e.currentTarget.style.color = theme.danger }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'inherit' }}
                  >
                    <Trash2 size={11} />
                  </span>
                </button>
                {expanded === c.id && (
                  <div className="px-3.5 pb-2.5 pt-1 space-y-1 border-t text-[10.5px]" style={{ borderColor: theme.hairline }}>
                    <p style={{ color: theme.textMuted }}>
                      {t('recordsCallProvider')}: <span className="font-mono" style={{ color: theme.text }}>{c.provider || '—'}</span>
                      <span className="mx-1.5">·</span>
                      {t('modelName')}: <span className="font-mono" style={{ color: theme.text }}>{c.model || '—'}</span>
                      <span className="mx-1.5">·</span>
                      {t('recordsDuration')}: <span style={{ color: theme.text }}>{fmtDuration(c.durationMs)}</span>
                    </p>
                    {!c.ok && c.error && <p style={{ color: theme.danger }}>{c.error}</p>}
                    {c.preview && (
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: theme.text }}>{c.preview}</p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </section>
  )
}

const KIND_LABEL_KEYS: Record<CallKind, keyof TranslationDict> = {
  chat: 'recordsKindChat', ocr: 'recordsKindOcr', imagegen: 'recordsKindImagegen',
  tts: 'recordsKindTts', asr: 'recordsKindAsr', listModels: 'recordsKindListModels', tool: 'recordsKindTool',
}

export default RecordsSection
