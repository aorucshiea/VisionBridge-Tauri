import { useState, useEffect } from 'react'
import { translations } from '../i18n'
import type { TranslationDict } from '../i18n'

export function useTranslation() {
  const [lang, setLang] = useState<string>('zh')

  useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.getSettings().then((res: any) => {
        if (res?.language) setLang(res.language)
      }).catch(() => {})
    }
  }, [])

  const t = (key: keyof TranslationDict): string => {
    return (translations[lang as keyof typeof translations]?.[key] || translations.zh[key]) as string
  }

  return { t, lang, setLang }
}
