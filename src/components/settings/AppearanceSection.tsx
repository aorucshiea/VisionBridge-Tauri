import React from 'react'
import type { ThemeConfig, ThemeName } from '../../types'
import { themes } from '../../theme/themes'
import type { TFunc } from './ui'

interface AppearanceSectionProps {
  settings: {
    enableTextSelection: boolean
    selectionTrigger: 'auto' | 'hotkey'
    closeAction: 'tray' | 'quit'
    theme: string
    language: string
  }
  onPatch: (patch: Partial<{ enableTextSelection: boolean; selectionTrigger: 'auto' | 'hotkey'; closeAction: 'tray' | 'quit'; theme: ThemeName; language: 'zh' | 'en' }>) => void
  theme: ThemeConfig
  t: TFunc
}

function Toggle({ on, onToggle, theme }: { on: boolean; onToggle: () => void; theme: ThemeConfig }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-base ease-out-quart"
      style={{ backgroundColor: on ? theme.primary : theme.inputBorder }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-base ease-out-quart"
        style={{ transform: `translateX(${on ? '1.25rem' : '0'})`, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
      />
    </button>
  )
}

/** Theme swatch: a miniature of the palette rather than just a colour dot. */
function ThemeSwatch({ active, palette, label, onClick }: {
  active: boolean
  palette: ThemeConfig
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group relative flex flex-col gap-2 p-2.5 rounded-[11px] border text-left transition-[border-color,transform] duration-base ease-out-quart active:scale-[0.98]"
      style={{
        backgroundColor: palette.background,
        borderColor: active ? palette.primary : palette.border,
        boxShadow: active ? `0 0 0 1px ${palette.primary}` : undefined,
      }}
    >
      <span
        aria-hidden
        className="block w-full h-7 rounded-md overflow-hidden border"
        style={{ backgroundColor: palette.card, borderColor: palette.border }}
      >
        <span className="flex items-end gap-1 h-full px-2 pb-1.5">
          <span className="h-1.5 rounded-full" style={{ width: '42%', backgroundColor: palette.text, opacity: 0.75 }} />
          <span className="h-1.5 rounded-full flex-1" style={{ backgroundColor: palette.textMuted, opacity: 0.5 }} />
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.primary }} />
        </span>
      </span>
      <span className="text-[11px] font-semibold leading-none" style={{ color: palette.text }}>
        {label}
      </span>
    </button>
  )
}

const AppearanceSection: React.FC<AppearanceSectionProps> = ({ settings, onPatch, theme, t }) => {
  const languages: Array<{ id: 'zh' | 'en'; label: string }> = [
    { id: 'zh', label: '中文' },
    { id: 'en', label: 'English' },
  ]

  return (
    <section className="space-y-2.5">
      <h2 className="eyebrow" style={{ color: theme.textSecondary }}>{t('appearance')}</h2>

      <div className="rounded-card border divide-y" style={{ backgroundColor: theme.card, borderColor: theme.hairline }}>
        {/* Behaviour */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{t('textSelection')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>{t('textSelectionDesc')}</p>
          </div>
          <Toggle
            on={settings.enableTextSelection}
            onToggle={() => onPatch({ enableTextSelection: !settings.enableTextSelection })}
            theme={theme}
          />
        </div>

        {/* Trigger mode — only meaningful when text selection is on. */}
        {settings.enableTextSelection && (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{t('selectionTrigger')}</p>
            <div
              className="inline-flex p-0.5 rounded-[9px] border"
              style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
              role="group"
              aria-label={t('selectionTrigger')}
            >
              {([['auto', 'triggerAuto'], ['hotkey', 'triggerHotkey']] as const).map(([id, key]) => {
                const selected = settings.selectionTrigger === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPatch({ selectionTrigger: id })}
                    className="px-3 py-1.5 rounded-[7px] text-[11px] font-semibold transition-[background-color,color] duration-base ease-out-quart"
                    style={{
                      backgroundColor: selected ? theme.card : 'transparent',
                      color: selected ? theme.text : theme.textMuted,
                      boxShadow: selected ? `0 1px 2px ${theme.hairline}` : undefined,
                    }}
                  >
                    {t(key)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Close behaviour — replaces the old native close dialog. */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{t('closeBehavior')}</p>
          <div
            className="inline-flex p-0.5 rounded-[9px] border"
            style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
            role="group"
            aria-label={t('closeBehavior')}
          >
            {([['tray', 'closeToTray'], ['quit', 'closeQuit']] as const).map(([id, key]) => {
              const selected = settings.closeAction === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPatch({ closeAction: id })}
                  className="px-3 py-1.5 rounded-[7px] text-[11px] font-semibold whitespace-nowrap transition-[background-color,color] duration-base ease-out-quart"
                  style={{
                    backgroundColor: selected ? theme.card : 'transparent',
                    color: selected ? theme.text : theme.textMuted,
                    boxShadow: selected ? `0 1px 2px ${theme.hairline}` : undefined,
                  }}
                >
                  {t(key)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Palette */}
        <div className="px-4 py-3.5 space-y-2.5">
          <p className="eyebrow" style={{ color: theme.textMuted }}>{t('theme')}</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(themes).map(([key, palette]) => (
              <ThemeSwatch
                key={key}
                active={settings.theme === key}
                palette={palette}
                label={settings.language === 'zh' ? palette.name : palette.nameEn}
                onClick={() => onPatch({ theme: key as ThemeName })}
              />
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{t('language')}</p>
          <div
            className="inline-flex p-0.5 rounded-[9px] border"
            style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
            role="group"
            aria-label={t('language')}
          >
            {languages.map(lang => {
              const selected = settings.language === lang.id
              return (
                <button
                  key={lang.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPatch({ language: lang.id })}
                  className="px-3.5 py-1.5 rounded-[7px] text-[11px] font-semibold transition-[background-color,color] duration-base ease-out-quart"
                  style={{
                    backgroundColor: selected ? theme.card : 'transparent',
                    color: selected ? theme.text : theme.textMuted,
                    boxShadow: selected ? `0 1px 2px ${theme.hairline}` : undefined,
                  }}
                >
                  {lang.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AppearanceSection
