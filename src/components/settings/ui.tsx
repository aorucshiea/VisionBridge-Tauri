import React from 'react'
import { Check, Eye, EyeOff, X as CloseIcon } from 'lucide-react'
import type { ThemeConfig, TestStatus } from '../../types'
import type { TranslationDict } from '../../i18n'

export type TFunc = (key: keyof TranslationDict) => string

interface ThemedProps {
  theme: ThemeConfig
}

const FIELD_BASE =
  'w-full h-10 px-3 rounded-field text-sm outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out-quart border'

export const inputCls = FIELD_BASE

export function themedInput(theme: ThemeConfig): React.CSSProperties {
  return { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }
}

export function fieldFocus(theme: ThemeConfig): React.CSSProperties {
  return {
    borderColor: theme.inputFocus,
    boxShadow: `0 0 0 3px ${theme.primary}22`,
  }
}

/** Field label above an input. Deliberately not uppercased — that turns
 *  "API Key" into something that reads as "APl Key" at small sizes. */
export function FieldLabel({ children, theme }: ThemedProps & { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium mb-1.5" style={{ color: theme.textSecondary }}>
      {children}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & ThemedProps) {
  const { theme, className, style, onFocus, onBlur, ...rest } = props
  const [focused, setFocused] = React.useState(false)
  return (
    <input
      {...rest}
      className={`${FIELD_BASE} font-medium ${className || ''}`}
      style={{ ...themedInput(theme), ...(focused ? fieldFocus(theme) : null), ...style }}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
    />
  )
}

export function MonoInput(props: React.InputHTMLAttributes<HTMLInputElement> & ThemedProps) {
  const { theme, className, style, onFocus, onBlur, ...rest } = props
  const [focused, setFocused] = React.useState(false)
  return (
    <input
      {...rest}
      className={`${FIELD_BASE} font-mono text-[13px] ${className || ''}`}
      style={{ ...themedInput(theme), ...(focused ? fieldFocus(theme) : null), ...style }}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & ThemedProps) {
  const { theme, className, style, onFocus, onBlur, ...rest } = props
  const [focused, setFocused] = React.useState(false)
  return (
    <select
      {...rest}
      className={`${FIELD_BASE} font-medium cursor-pointer ${className || ''}`}
      style={{ ...themedInput(theme), ...(focused ? fieldFocus(theme) : null), ...style }}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
    />
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & ThemedProps) {
  const { theme, className, style, onFocus, onBlur, ...rest } = props
  const [focused, setFocused] = React.useState(false)
  return (
    <textarea
      {...rest}
      className={`w-full px-3 py-2.5 rounded-field text-sm leading-relaxed outline-none border transition-[border-color,box-shadow] duration-150 ease-out-quart resize-none custom-scrollbar ${className || ''}`}
      style={{ ...themedInput(theme), ...(focused ? fieldFocus(theme) : null), ...style }}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
    />
  )
}

export function PasswordInput({ value, onChange, show, onToggleShow, theme, placeholder, label }: {
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  theme: ThemeConfig
  placeholder?: string
  label?: string
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <div className="flex gap-2">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={`${FIELD_BASE} font-mono text-[13px] flex-1`}
        style={{ ...themedInput(theme), ...(focused ? fieldFocus(theme) : null) }}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={label || 'Show or hide the API key'}
        aria-pressed={show}
        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-field border transition-colors duration-150 ease-out-quart active:scale-[0.97]"
        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textSecondary }}
      >
        {show ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
    </div>
  )
}

/**
 * Two-state action: idle shows the label, then reports its own progress and
 * outcome inline — no toast needed for a 3-second operation.
 */
export function TestButton({ status, onClick, label, full, theme }: {
  status: TestStatus
  onClick: () => void
  label: string
  full?: boolean
  theme?: ThemeConfig
}) {
  const idle: React.CSSProperties = theme
    ? { backgroundColor: 'transparent', borderColor: theme.inputBorder, color: theme.text }
    : {}

  const resolved: React.CSSProperties =
    status === 'idle' ? idle
    : status === 'success' ? { backgroundColor: theme?.success ?? '#3E8E63', borderColor: 'transparent', color: '#fff' }
    : status === 'error' ? { backgroundColor: theme?.danger ?? '#C33F32', borderColor: 'transparent', color: '#fff' }
    : idle

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'testing'}
      style={resolved}
      className={`h-10 px-4 rounded-field border text-xs font-semibold tracking-wide transition-[background-color,border-color,transform] duration-150 ease-out-quart active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-1.5 ${
        status === 'idle' && theme ? 'hover:brightness-[0.97]' : ''
      } ${full ? 'w-full' : ''}`}
    >
      {status === 'testing' ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin opacity-70" />
      ) : status === 'success' ? (
        <><Check size={14} />{label}</>
      ) : status === 'error' ? (
        <><CloseIcon size={14} />{label}</>
      ) : (
        label
      )}
    </button>
  )
}

export function TestStatusText({ status, message }: { status: TestStatus; message: string }) {
  if (status === 'idle' || !message) return null
  const cls = status === 'success' ? 'text-success-600' : status === 'error' ? 'text-danger-600' : 'text-ink-400'
  return <p className={`text-xs leading-relaxed ${cls}`}>{message}</p>
}

/** Section label: small caps, no icon noise. */
export function SectionHeader({ title, theme, right, icon }: ThemedProps & {
  icon?: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function Card({ children, theme, className, pad = true }: ThemedProps & {
  children: React.ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <div
      className={`rounded-card border ${pad ? 'p-5' : ''} ${className || ''}`}
      style={{ backgroundColor: theme.card, borderColor: theme.hairline }}
    >
      {children}
    </div>
  )
}
