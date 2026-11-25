import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import {
  getRewindSharePath,
  isRewindShareCookie,
  isRewindShareKey,
  toShareCookie,
} from './rewindShare'

let settings: Pick<Settings, 'rewind' | 'general'>

function getKey(userId: string) {
  const path = getRewindSharePath(settings, userId)

  return path && new URLSearchParams(path.split('?')[1]).get('key')
}

beforeEach(() => {
  settings = cloneDeep({
    rewind: DEFAULT_SETTINGS.rewind,
    general: DEFAULT_SETTINGS.general,
  })
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('rewind share links', () => {
  it("opens the user's Rewind and no one else's", () => {
    const key = getKey('42')

    expect(getRewindSharePath(settings, '42')).toMatch(
      /^\/rewind\?userId=42&key=[\w-]{22}$/,
    )
    expect(isRewindShareKey(settings, '42', key)).toBe(true)
    expect(isRewindShareKey(settings, '43', key)).toBe(false)
  })

  it('takes only the exact key', () => {
    const key = getKey('42')!
    // The last character's unused bits, which decoding would ignore
    const respelled = key.slice(0, -1) + (key.at(-1) === 'A' ? 'B' : 'A')

    expect(isRewindShareKey(settings, '42', respelled)).toBe(false)
    expect(isRewindShareKey(settings, '42', key.slice(0, -1))).toBe(false)
    expect(isRewindShareKey(settings, '42', [key, key])).toBe(false)
    expect(isRewindShareKey(settings, '42', '')).toBe(false)
  })

  it('stops the old links working once reset', () => {
    const key = getKey('42')

    settings.rewind.shareVersion += 1

    expect(isRewindShareKey(settings, '42', key)).toBe(false)
    expect(isRewindShareKey(settings, '42', getKey('42'))).toBe(true)
  })

  it("isn't made or opened while users can't see their Rewind", () => {
    const key = getKey('42')

    settings.rewind.isAdminOnly = true

    expect(getRewindSharePath(settings, '42')).toBeNull()
    expect(isRewindShareKey(settings, '42', key)).toBe(false)

    settings.rewind.isAdminOnly = false
    settings.rewind.isActive = false

    expect(isRewindShareKey(settings, '42', key)).toBe(false)
  })

  it("doesn't open for a user left out of the stats", () => {
    const key = getKey('42')

    settings.general.excludedUsers = ['42']

    expect(isRewindShareKey(settings, '42', key)).toBe(false)
  })

  it('reads the user and key back from the cookie', () => {
    const key = getKey('a1b2c3')!

    expect(isRewindShareCookie(settings, toShareCookie('a1b2c3', key))).toBe(
      true,
    )
    expect(isRewindShareCookie(settings, toShareCookie('a1b2c4', key))).toBe(
      false,
    )
    expect(isRewindShareCookie(settings, key)).toBe(false)
    expect(isRewindShareCookie(settings, undefined)).toBe(false)
  })
})
