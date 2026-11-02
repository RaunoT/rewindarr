import { HistoryRequest } from '@/types/history'
import { Settings } from '@/types/settings'
import { TautulliUser } from '@/types/tautulli'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import { fetchSeerrStats, SeerrRequestItem } from './fetchSeerr'
import fetchTmdb from './fetchTmdb'
import getSettings from './getSettings'
import {
  addRequestDetails,
  getHistoryRequests,
  getRequestStatus,
} from './historyRequests'
import { getUsers } from './statsSource'

vi.mock('./fetchSeerr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fetchSeerr')>()),
  fetchSeerrStats: vi.fn(),
}))
vi.mock('./fetchTmdb', () => ({ default: vi.fn() }))
vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./statsSource', () => ({ getUsers: vi.fn() }))

function seerrRequest(
  overrides: Partial<SeerrRequestItem> = {},
): SeerrRequestItem {
  return {
    id: 1,
    createdAt: '2026-11-01T16:57:24.000Z',
    type: 'movie',
    status: 2,
    media: { tmdbId: 508642, status: 3 },
    seasons: [],
    requestedBy: { id: 7, plexId: 100, displayName: 'alice_seerr' },
    ...overrides,
  }
}

function user(userId: number, friendlyName: string): TautulliUser {
  return {
    user_id: String(userId),
    friendly_name: friendlyName,
    username: friendlyName.toLowerCase(),
    user_thumb: `https://plex.tv/users/${userId}/avatar`,
  } as TautulliUser
}

function withSettings(update: (settings: Settings) => void = () => {}) {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.connection.seerrUrl = 'http://seerr:5055'
  settings.connection.seerrApiKey = 'key'
  update(settings)
  vi.mocked(getSettings).mockReturnValue(settings)
}

beforeEach(() => {
  vi.resetAllMocks()
  withSettings()
  vi.mocked(getUsers).mockResolvedValue([user(100, 'Alice'), user(200, 'Bob')])
})

describe('getRequestStatus', () => {
  it("goes by the request until it's approved, then by the media", () => {
    expect(getRequestStatus(seerrRequest({ status: 1 }))).toBe('pending')
    expect(getRequestStatus(seerrRequest({ status: 3 }))).toBe('declined')
    expect(getRequestStatus(seerrRequest({ status: 4 }))).toBe('failed')
    expect(getRequestStatus(seerrRequest())).toBe('approved')
    expect(
      getRequestStatus(seerrRequest({ media: { tmdbId: 1, status: 4 } })),
    ).toBe('partiallyAvailable')
    expect(
      getRequestStatus(
        seerrRequest({ status: 5, media: { tmdbId: 1, status: 5 } }),
      ),
    ).toBe('available')
  })
})

describe('getHistoryRequests', () => {
  it('names the media server user who asked, with the seasons in order', async () => {
    vi.mocked(fetchSeerrStats).mockResolvedValue([
      seerrRequest({
        type: 'tv',
        seasons: [{ seasonNumber: 3 }, { seasonNumber: 1 }],
      }),
    ])

    const [request] = (await getHistoryRequests('2026-01-01')) ?? []

    expect(fetchSeerrStats).toHaveBeenCalledWith('request', '2026-01-01')
    expect(request).toMatchObject({
      id: 1,
      createdAt: Date.parse('2026-11-01T16:57:24.000Z'),
      mediaType: 'tv',
      tmdbId: 508642,
      seasons: [1, 3],
      status: 'approved',
      userId: '100',
      userName: 'Alice',
      avatar: 'https://plex.tv/users/100/avatar',
    })
  })

  it("keeps Seerr's name for a user who isn't on the media server", async () => {
    vi.mocked(fetchSeerrStats).mockResolvedValue([
      seerrRequest({
        requestedBy: { id: 9, plexId: null, displayName: 'Guest' },
      }),
    ])

    const [request] = (await getHistoryRequests('2026-01-01')) ?? []

    expect(request).toMatchObject({ userId: '', userName: 'Guest' })
  })

  it("leaves out the excluded users' requests and ones without a title", async () => {
    withSettings((settings) => {
      settings.general.excludedUsers = ['200']
    })
    vi.mocked(fetchSeerrStats).mockResolvedValue([
      seerrRequest({ id: 1 }),
      seerrRequest({ id: 2, requestedBy: { id: 8, plexId: 200 } }),
      seerrRequest({ id: 3, media: { tmdbId: null } }),
    ])

    const requests = await getHistoryRequests('2026-01-01')

    expect(requests?.map((request) => request.id)).toEqual([1])
  })

  it("has none when Seerr isn't set up or doesn't answer", async () => {
    vi.mocked(fetchSeerrStats).mockResolvedValue(null)

    await expect(getHistoryRequests('2026-01-01')).resolves.toBeNull()

    withSettings((settings) => {
      settings.connection.seerrApiKey = ''
    })

    await expect(getHistoryRequests('2026-01-01')).resolves.toBeNull()
    expect(fetchSeerrStats).toHaveBeenCalledTimes(1)
  })
})

describe('addRequestDetails', () => {
  const request = {
    id: 1,
    mediaType: 'tv',
    tmdbId: 1399,
    title: '',
  } as HistoryRequest

  it("adds TMDB's title, year and poster", async () => {
    vi.mocked(fetchTmdb).mockResolvedValue({
      name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      poster_path: '/got.jpg',
    })

    const [detailed] = await addRequestDetails([request])

    expect(fetchTmdb).toHaveBeenCalledWith('tv/1399')
    expect(detailed).toMatchObject({
      title: 'Game of Thrones',
      year: 2011,
      poster: 'https://image.tmdb.org/t/p/w92/got.jpg',
    })
  })

  it('keeps them empty when TMDB has nothing', async () => {
    vi.mocked(fetchTmdb).mockResolvedValue(null)

    const [detailed] = await addRequestDetails([request])

    expect(detailed).toMatchObject({ title: '', year: null, poster: null })
  })
})
