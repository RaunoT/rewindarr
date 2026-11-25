import { canManageSettings } from '@/lib/access'
import {
  testMediaServerUrl,
  testPlexToken,
  testTautulli,
} from '@/utils/connectionTests'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/access', () => ({ canManageSettings: vi.fn() }))
vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))
vi.mock('@/utils/connectionTests', () => ({
  testMediaServerUrl: vi.fn(),
  testPlexToken: vi.fn(),
  testSeerr: vi.fn(),
  testTautulli: vi.fn(),
  testTracearr: vi.fn(),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))

beforeEach(() => {
  vi.mocked(canManageSettings).mockResolvedValue(true)
  vi.mocked(getSettings).mockReturnValue(cloneDeep(DEFAULT_SETTINGS))
  vi.mocked(testTautulli).mockResolvedValue(null)
  vi.mocked(testMediaServerUrl).mockResolvedValue(null)
  vi.mocked(testPlexToken).mockResolvedValue(null)
})

function testMediaServer(
  mediaServerType: string,
  fields: [string, string][],
): Promise<Response> {
  return POST(
    new Request('http://localhost/api/settings/connection-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: 'mediaServer', mediaServerType, fields }),
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/settings/connection-test', () => {
  it('returns 415 for non-JSON requests', async () => {
    const res = await POST(
      new Request('http://localhost/api/settings/connection-test', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
    )

    expect(res.status).toBe(415)
    expect(canManageSettings).not.toHaveBeenCalled()
  })

  it('returns 403 before parsing the body when unauthorized', async () => {
    vi.mocked(canManageSettings).mockResolvedValue(false)

    const req = new Request('http://localhost/api/settings/connection-test', {
      method: 'POST',
      headers: { 'content-type': 'Application/JSON' },
      body: '{invalid json',
    })
    const jsonSpy = vi.spyOn(req, 'json')
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed payloads when authorized', async () => {
    const res = await POST(
      new Request('http://localhost/api/settings/connection-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service: 'unknown' }),
      }),
    )

    expect(res.status).toBe(400)
  })

  it('runs the requested connection test when authorized and valid', async () => {
    const res = await POST(
      new Request('http://localhost/api/settings/connection-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          service: 'tautulli',
          mediaServerType: 'plex',
          fields: [
            ['statisticsSource', 'tautulli'],
            ['tautulliUrl', 'http://tautulli:8181'],
            ['tautulliApiKey', 'secret-key'],
          ],
        }),
      }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'success',
      message: 'Connection.connected',
    })
    expect(testTautulli).toHaveBeenCalledWith(
      'http://tautulli:8181',
      'secret-key',
    )
  })
  it('says whether a Plex token was tested along with the URL', async () => {
    const withoutToken = await testMediaServer('plex', [
      ['statisticsSource', 'tautulli'],
      ['plexUrl', 'http://plex:32400'],
      ['plexToken', ''],
    ])

    await expect(withoutToken.json()).resolves.toEqual({
      status: 'success',
      message: 'Connection.connectedWithoutToken',
    })
    expect(testPlexToken).not.toHaveBeenCalled()

    const withToken = await testMediaServer('plex', [
      ['statisticsSource', 'tautulli'],
      ['plexUrl', 'http://plex:32400'],
      ['plexToken', 'token'],
    ])

    await expect(withToken.json()).resolves.toEqual({
      status: 'success',
      message: 'Connection.connectedWithToken',
    })
    expect(testPlexToken).toHaveBeenCalledWith('http://plex:32400', 'token')
  })

  it('says only connected for Jellyfin, which has no token', async () => {
    const res = await testMediaServer('jellyfin', [
      ['statisticsSource', 'tracearr'],
      ['jellyfinUrl', 'http://jellyfin:8096'],
    ])

    await expect(res.json()).resolves.toEqual({
      status: 'success',
      message: 'Connection.connected',
    })
  })
})
