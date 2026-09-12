import { translations } from './translations'
import type { TranslationDict } from './translations'

export function t(lang: string, key: keyof TranslationDict): string {
  return (translations[lang as keyof typeof translations]?.[key] || translations.zh[key]) as string
}

export { translations }
export type { TranslationDict }
