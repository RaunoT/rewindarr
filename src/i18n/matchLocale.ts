import { Locale, LOCALES } from '@/utils/constants'

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale)
}

// An exact match first (`en-US`), then the first locale in the same language,
// so `en` and `en-AU` get `en-GB`
export function matchLocale(tags: readonly string[]): Locale | undefined {
  for (const rawTag of tags) {
    const tag = rawTag.trim().toLowerCase()

    if (!tag) {
      continue
    }

    const language = tag.split('-')[0]
    const match =
      LOCALES.find((locale) => locale.toLowerCase() === tag) ??
      LOCALES.find((locale) => locale.split('-')[0] === language)

    if (match) {
      return match
    }
  }
}
