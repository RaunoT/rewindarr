import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import {
  getAppUrl,
  getRewindShareUrl,
  getUnsubscribeUrl,
  isPublicUrl,
  isUnsubscribeKey,
  readEmailList,
  toAppImageUrl,
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

  it('is null for an address links in emails cannot use', () => {
    settings.email.appUrl = 'mailto:alex@example.com'

    expect(getAppUrl(settings)).toBeNull()

    settings.email.appUrl = 'ftp://rewind.example.com'

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

  it("stop the invites with a key of their own, which the newsletter's can't", () => {
    const url = getUnsubscribeUrl('https://rewind.example.com', '42', 'invite')
    const key = getKey(url)

    expect(url).toMatch(
      /^https:\/\/rewind\.example\.com\/api\/email\/unsubscribe\?userId=42&list=invite&key=[\w-]{22}$/,
    )
    expect(isUnsubscribeKey('42', key, 'invite')).toBe(true)
    expect(isUnsubscribeKey('42', key)).toBe(false)
    expect(
      isUnsubscribeKey(
        '42',
        getKey(getUnsubscribeUrl('https://rewind.example.com', '42')),
        'invite',
      ),
    ).toBe(false)
  })

  it('read the list, which is the newsletter without one', () => {
    expect(readEmailList(new URLSearchParams('userId=42'))).toBe('newsletter')
    expect(readEmailList(new URLSearchParams('list=invite'))).toBe('invite')
    expect(readEmailList(new URLSearchParams('list=newsletter'))).toBeNull()
    expect(readEmailList(new URLSearchParams('list=other'))).toBeNull()
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

describe('isPublicUrl', () => {
  it('takes a domain as public', () => {
    expect(isPublicUrl('https://rewind.example.com')).toBe(true)
    expect(isPublicUrl('http://8.8.8.8:8383')).toBe(true)
  })

  it("doesn't take home, VPN or local addresses as public", () => {
    for (const url of [
      'http://localhost:3000',
      'http://192.168.1.10:8383',
      'http://10.0.0.5',
      'http://172.20.1.1',
      'http://100.101.102.103',
      'http://nas:8383',
      'http://rewind.local',
      'https://nas.tail1234.ts.net',
      'http://[::1]:3000',
      'http://[fd00::1]',
    ]) {
      expect(isPublicUrl(url), url).toBe(false)
    }
  })
})

describe('toAppImageUrl', () => {
  const appUrl = 'https://rewind.example.com'

  it("goes through the app's image route, like the app", () => {
    expect(toAppImageUrl(appUrl, '/library/metadata/1/thumb/2')).toBe(
      'https://rewind.example.com/api/image?img=%2Flibrary%2Fmetadata%2F1%2Fthumb%2F2&width=300',
    )
    expect(toAppImageUrl(appUrl, 'https://plex.tv/users/1/avatar')).toBe(
      'https://rewind.example.com/api/image?url=https%3A%2F%2Fplex.tv%2Fusers%2F1%2Favatar',
    )
  })

  it("keeps TMDB's as they are, and nothing for no picture", () => {
    expect(toAppImageUrl(appUrl, 'https://image.tmdb.org/t/p/w300/a.jpg')).toBe(
      'https://image.tmdb.org/t/p/w300/a.jpg',
    )
    expect(toAppImageUrl(appUrl, '')).toBeNull()
  })
})
