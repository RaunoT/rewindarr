import { DEFAULT_LOCALE, Locale, LOCALE_COOKIE_NAME } from '@/utils/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGetMock = vi.fn()
const cookieSetMock = vi.fn()
const headerGetMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
    set: cookieSetMock,
  })),
  headers: vi.fn(async () => ({
    get: headerGetMock,
  })),
}))

import { getUserLocale, setUserLocale } from './locale'

describe('getUserLocale', () => {
  beforeEach(() => {
    cookieGetMock.mockReset()
    cookieSetMock.mockReset()
    headerGetMock.mockReset()
  })

  it('prefers a valid locale cookie over accept-language', async () => {
    cookieGetMock.mockReturnValue({ value: 'et' })
    headerGetMock.mockReturnValue('fr-FR,fr;q=0.9')

    await expect(getUserLocale()).resolves.toBe('et')
  })

  it('ignores an invalid locale cookie and sorts accept-language by quality', async () => {
    cookieGetMock.mockReturnValue({ value: 'pt-BR' })
    headerGetMock.mockReturnValue('de;q=0.5, en-US;q=0.9, *;q=0')

    await expect(getUserLocale()).resolves.toBe('en-US')
  })

  it('falls back to the default locale when no supported language matches', async () => {
    cookieGetMock.mockReturnValue(undefined)
    headerGetMock.mockReturnValue('ja;q=0.9, ko;q=0.8')

    await expect(getUserLocale()).resolves.toBe(DEFAULT_LOCALE)
  })
})

describe('setUserLocale', () => {
  beforeEach(() => {
    cookieSetMock.mockReset()
  })

  it('stores valid locales in the locale cookie', async () => {
    await setUserLocale('fr')

    expect(cookieSetMock).toHaveBeenCalledWith(LOCALE_COOKIE_NAME, 'fr', {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    })
  })

  it('ignores invalid locale values', async () => {
    await setUserLocale('zz-ZZ' as Locale)

    expect(cookieSetMock).not.toHaveBeenCalled()
  })
})
