import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { encode } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import proxy from './proxy'
import { DEFAULT_SETTINGS } from './utils/constants'
import getSettings from './utils/getSettings'
import { getServerUser } from './utils/statsSource'

vi.mock('./utils/getSettings', () => ({ default: vi.fn() }))
vi.mock('./utils/statsSource', () => ({ getServerUser: vi.fn() }))

const SECRET = 'test-secret'

// Results are remembered per user, so each test gets a user of its own
let lastUserId = 0

// The cookie of an admin who signed in two hours ago, so they are due a re-check
function staleAdminCookie() {
  return encode({
    token: {
      id: String(++lastUserId),
      email: 'jane@example.com',
      isAdmin: true,
      checkedAt: Date.now() - 2 * 60 * 60 * 1000,
    },
    secret: SECRET,
  })
}

function request(
  cookie: string,
  pathname: string,
  { cookieName = 'next-auth.session-token', headers = {} } = {},
) {
  const req = new NextRequest(`http://localhost:3000${pathname}`, {
    headers: { ...headers, cookie: `${cookieName}=${cookie}` },
  })

  return proxy(req)
}

async function requestAsAdmin(pathname: string) {
  return request(await staleAdminCookie(), pathname)
}

beforeEach(() => {
  // After an update that added a required setting, only admins get past '/'
  const settings: Settings = cloneDeep(DEFAULT_SETTINGS)

  settings.setupComplete = true
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.stubEnv('NEXTAUTH_SECRET', SECRET)
  vi.stubEnv('NEXTAUTH_URL', undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('proxy', () => {
  it('sends an admin still on the server to the missing setting', async () => {
    vi.mocked(getServerUser).mockResolvedValue({
      status: 'member',
      isAdmin: true,
    })

    const res = await requestAsAdmin('/dashboard')

    expect(res?.headers.get('location')).toBe(
      'http://localhost:3000/settings/connection',
    )
  })

  it('treats an admin removed from the server as signed out', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ status: 'notMember' })

    const res = await requestAsAdmin('/dashboard')

    expect(res?.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('keeps admin rights through an outage', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ status: 'unavailable' })

    const res = await requestAsAdmin('/dashboard')

    expect(res?.headers.get('location')).toBe(
      'http://localhost:3000/settings/connection',
    )
  })

  // The proxy can't save a refreshed token, so the browser keeps sending the
  // same stale cookie with every navigation.
  it('looks the user up once for consecutive requests during an outage', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ status: 'unavailable' })

    const cookie = await staleAdminCookie()

    for (const pathname of ['/dashboard', '/activity', '/rewind']) {
      const res = await request(cookie, pathname)

      expect(res?.headers.get('location')).toBe(
        'http://localhost:3000/settings/connection',
      )
    }

    expect(getServerUser).toHaveBeenCalledTimes(1)
  })

  it('looks a member up once for consecutive requests', async () => {
    vi.mocked(getServerUser).mockResolvedValue({
      status: 'member',
      isAdmin: true,
    })

    const cookie = await staleAdminCookie()

    for (const pathname of ['/dashboard', '/activity', '/rewind']) {
      await request(cookie, pathname)
    }

    expect(getServerUser).toHaveBeenCalledTimes(1)
  })

  // next-auth names the cookie after the protocol of its address, which
  // without NEXTAUTH_URL is the one the request came in on
  describe('session cookie', () => {
    const https = { 'x-forwarded-proto': 'https' }

    beforeEach(() => {
      vi.mocked(getServerUser).mockResolvedValue({
        status: 'member',
        isAdmin: true,
      })
    })

    it('reads the secure cookie of a request over HTTPS', async () => {
      const res = await request(await staleAdminCookie(), '/dashboard', {
        cookieName: '__Secure-next-auth.session-token',
        headers: https,
      })

      expect(res?.headers.get('location')).toBe(
        'http://localhost:3000/settings/connection',
      )
    })

    it('ignores the plain cookie of a request over HTTPS', async () => {
      const res = await request(await staleAdminCookie(), '/dashboard', {
        headers: https,
      })

      expect(res?.headers.get('location')).toBe('http://localhost:3000/')
    })

    it('goes by NEXTAUTH_URL when it is set', async () => {
      vi.stubEnv('NEXTAUTH_URL', 'https://rewind.example.com')

      const res = await request(await staleAdminCookie(), '/dashboard', {
        cookieName: '__Secure-next-auth.session-token',
      })

      expect(res?.headers.get('location')).toBe(
        'http://localhost:3000/settings/connection',
      )
    })
  })

  describe('login', () => {
    beforeEach(() => {
      const settings: Settings = cloneDeep(DEFAULT_SETTINGS)

      settings.setupComplete = true
      settings.connection.tautulliUrl = 'http://tautulli:8181'
      settings.connection.tautulliApiKey = 'key'

      for (const section of [
        'connection',
        'general',
        'rewind',
        'dashboard',
        'activity',
        'history',
      ] as const) {
        settings[section].complete = true
      }

      vi.mocked(getSettings).mockReturnValue(settings)
    })

    it('sends a visitor to log in and back to the page they asked for', async () => {
      const res = await request('', '/history?q=alien&_rsc=abc')

      expect(res?.headers.get('location')).toBe(
        'http://localhost:3000/?callbackUrl=%2Fhistory%3Fq%3Dalien',
      )
    })

    it('lets a logged-in user through', async () => {
      vi.mocked(getServerUser).mockResolvedValue({
        status: 'member',
        isAdmin: false,
      })

      const res = await requestAsAdmin('/rewind')

      expect(res?.headers.get('location')).toBeNull()
    })

    it('leaves the pages outside access opens up alone', async () => {
      const settings = getSettings()

      settings.general.isOutsideAccess = true

      expect((await request('', '/dashboard'))?.headers.get('location')).toBe(
        null,
      )
      expect((await request('', '/rewind'))?.headers.get('location')).toBe(
        'http://localhost:3000/?callbackUrl=%2Frewind',
      )
    })
  })

  it('sends old links to the Tracearr shows library to its new name', async () => {
    const settings: Settings = cloneDeep(DEFAULT_SETTINGS)

    settings.connection.statisticsSource = 'tracearr'
    vi.mocked(getSettings).mockReturnValue(settings)

    const res = await request('', '/dashboard/tv-shows?period=7days')

    expect(res?.headers.get('location')).toBe(
      'http://localhost:3000/dashboard/shows?period=7days',
    )
  })

  it('leaves the TV Shows library of other sources alone', async () => {
    const res = await request('', '/dashboard/tv-shows')

    expect(res?.headers.get('location')).not.toContain('/dashboard/shows')
  })
})
