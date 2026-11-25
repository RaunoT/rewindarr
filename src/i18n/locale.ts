'use server'

import { DEFAULT_LOCALE, Locale, LOCALE_COOKIE_NAME } from '@/utils/constants'
import { cookies, headers } from 'next/headers'
import { isLocale, matchLocale } from './matchLocale'

function getBrowserLocale(acceptLanguage: string | null): Locale | undefined {
  const languages = (acceptLanguage ?? '')
    .split(',')
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(';')
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='))

      return {
        tag: tag.toLowerCase(),
        quality: quality ? parseFloat(quality.slice(2)) : 1,
      }
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality)

  return matchLocale(languages.map(({ tag }) => tag))
}

export async function getUserLocale() {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value

  if (isLocale(cookieLocale)) {
    return cookieLocale
  }

  const headerStore = await headers()

  return getBrowserLocale(headerStore.get('accept-language')) ?? DEFAULT_LOCALE
}

export async function setUserLocale(locale: Locale) {
  if (!isLocale(locale)) {
    return
  }

  const cookieStore = await cookies()

  // Kept for a year, so a chosen language outlives the browser session and
  // wins over the browser language
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  })
}
