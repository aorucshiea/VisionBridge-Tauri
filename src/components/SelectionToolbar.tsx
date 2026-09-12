import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { themes, tint } from '../theme/themes'
import type { ThemeConfig } from '../types'

const FALLBACK_ACTIONS: Array<{ id: string; label: string }> = [
  { id: 'translate', label: '翻译' },
  { id: 'explain', label: '解释' },
]

/**
 * The floating toolbar that pops up next to a text selection: one button per
 * configured toolbar action. Lives in its own tiny always-on-top window.
 */
const SelectionToolbar: React.FC = () => {
  const [theme, setTheme] = useState<ThemeConfig>(themes.light)
  const [actions, setActions] = useState<Array<{ id: string; label: string }>>(FALLBACK_ACTIONS)
  const [hasText, setHasText] = useState(false)

  useEffect(() => {
    const ipc = window.ipcRenderer
    if (!ipc) return
    ipc.getSettings().then((settings: any) => {
      setTheme(themes[(settings?.theme as keyof typeof themes) || 'light'] || themes.light)
    }).catch(() => {})
    return ipc.onSelectionText((payload: { text: string; actions: Array<{ id: string; label: string }> }) => {
      setHasText(!!payload?.text && payload.text.trim().length > 0)
      if (Array.isArray(payload?.actions) && payload.actions.length > 0) setActions(payload.actions)
    })
  }, [])

  const act = (actionId: string) => {
    if (!hasText) return
    window.ipcRenderer.selectionToolbarAction(actionId)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.ipcRenderer.selectionToolbarAction('dismiss')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="w-full h-full flex items-center gap-1 px-2 select-none animate-pop no-drag"
      style={{
        background: theme.card,
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: 11,
        boxShadow: '0 6px 18px -6px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.16)',
      }}
    >
      <svg width={15} height={15} viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
        <rect x="1.5" y="1.5" width="25" height="25" rx="7.5" fill={theme.primary} fillOpacity="0.16" />
        <g stroke={theme.primary} strokeWidth="2.4" strokeLinecap="round">
          <path d="M7.6 11.2V9.3a1.7 1.7 0 0 1 1.7-1.7h1.9" />
          <path d="M16.8 7.6h1.9a1.7 1.7 0 0 1 1.7 1.7v1.9" />
          <path d="M20.4 16.8v1.9a1.7 1.7 0 0 1-1.7 1.7h-1.9" />
          <path d="M11.2 20.4H9.3a1.7 1.7 0 0 1-1.7-1.7v-1.9" />
        </g>
        <rect x="10.2" y="13.05" width="7.6" height="1.9" rx="0.95" fill={theme.primary} />
      </svg>

      <div className="flex-1 min-w-0 flex items-center gap-1">
        {actions.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => act(a.id)}
            disabled={!hasText}
            title={a.label}
            className={'flex-1 min-w-0 h-8 flex items-center justify-center rounded-[8px] text-[12px] font-semibold truncate transition-[filter,transform,background-color] duration-fast ease-out-quart hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-45 ' + (i === 0 ? 'px-2' : 'px-1.5')}
            style={i === 0
              ? { backgroundColor: theme.primary, color: theme.onPrimary }
              : { backgroundColor: tint(theme.text, theme.card, 0.05), color: theme.text }}
          >
            <span className="truncate">{a.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => window.ipcRenderer.selectionToolbarAction('dismiss')}
        aria-label="关闭"
        title="关闭"
        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[8px] transition-[background-color,color] duration-fast ease-out-quart"
        style={{ color: theme.textSecondary }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint(theme.text, theme.card, 0.08) }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export default SelectionToolbar
