import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import {
  getAppUrl,
  getRewindShareUrl,
  getUnsubscribeUrl,
  isUnsubscribeKey,
  toAppUrl,
} from './emailLinks'

let settings: Settings

beforeEach(() => {
  settings = cloneDeep(DEFAULT_SETTINGS)
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
  vi.stubEnv('NEXTAUTH_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function getKey(url: string | null) {
  return url && new URL(url).searchParams.get('key')
}

describe('getAppUrl', () => {
  it('is the one set for the emails, without a trailing slash', () => {
    settings.email.appUrl = 'https://rewind.example.com/'
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example.com')

    expect(getAppUrl(settings)).toBe('https://rewind.example.com')
  })

  it("falls back to the app's own address", () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.com')

    expect(getAppUrl(settings)).toBe('https://site.example.com')
  })

  it('is null without either', () => {
    expect(getAppUrl(settings)).toBeNull()
  })
})

describe('toAppUrl', () => {
  it('joins the path to the address', () => {
    expect(toAppUrl('https://example.com', '/dashboard')).toBe(
      'https://example.com/dashboard',
    )
  })
})

describe('unsubscribe links', () => {
  it('unsubscribe the user and no one else', () => {
    const url = getUnsubscribeUrl('https://rewind.example.com', '42')
    const key = getKey(url)

    expect(url).toMatch(
      /^https:\/\/rewind\.example\.com\/api\/email\/unsubscribe\?userId=42&key=[\w-]{22}$/,
    )
    expect(isUnsubscribeKey('42', key)).toBe(true)
    expect(isUnsubscribeKey('43', key)).toBe(false)
    expect(isUnsubscribeKey('42', `${key}x`)).toBe(false)
    expect(isUnsubscribeKey('42', null)).toBe(false)
  })

  it("can't be made without the secret", () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')

    expect(getUnsubscribeUrl('https://rewind.example.com', '42')).toBeNull()
    expect(isUnsubscribeKey('42', 'anything')).toBe(false)
  })
})

describe('getRewindShareUrl', () => {
  it("is the user's share link in full", () => {
    expect(
      getRewindShareUrl(settings, 'https://rewind.example.com', '42'),
    ).toMatch(/^https:\/\/rewind\.example\.com\/rewind\?userId=42&key=/)
  })

  it("is null while users can't open their own", () => {
    settings.rewind.isAdminOnly = true

    expect(
      getRewindShareUrl(settings, 'https://rewind.example.com', '42'),
    ).toBeNull()
  })
})
