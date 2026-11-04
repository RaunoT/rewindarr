import { Play } from '@/types/playHistory'
import { DurationQuery, HistoryPlay } from '@/types/statsSource'
import { cloneDeep } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import { fetchRewindRequests } from './getRewind'
import getRewindSocial from './getRewindSocial'
import getSettings from './getSettings'
import { EMPTY_ROW } from './playStats'
import { getStatsSource } from './statsSource'

vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }))
vi.mock('./getRewind', () => ({ fetchRewindRequests: vi.fn() }))
vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./statsSource', () => ({ getStatsSource: vi.fn() }))

const HOUR_MS = 60 * 60 * 1000

function play(id: string, userId: string, title: string): HistoryPlay {
  return {
    id,
    startedAt: new Date('2026-06-01T20:00:00Z').getTime(),
    mediaType: 'movie',
    durationMs: HOUR_MS,
    percentComplete: 100,
    title,
    showTitle: null,
    artistName: null,
    year: 2026,
    thumb: '',
    ratingKey: `${title}-key`,
    grandparentRatingKey: null,
    mediaId: null,
    showMediaId: null,
    imdbId: null,
    tmdbId: null,
    identityId: `identity-${userId}`,
    avatar: '',
    seasonNumber: null,
    episodeNumber: null,
    transcodeDecision: null,
    lengthMs: null,
    userId,
    userName: '',
  }
}

// Alice is user 1, Bob user 2
const SERVER_PLAYS = [
  play('arrival-bob', '2', 'Arrival'),
  play('brick-bob', '2', 'Brick'),
]
const ALICE_PLAYS = [play('coco', '1', 'Coco'), play('brick', '1', 'Brick')]
// Everyone's plays leave the excluded Alice out, as the sources do
const getHistoryPlays = vi.fn(async ({ userId }: DurationQuery) =>
  userId ? ALICE_PLAYS : SERVER_PLAYS,
)

// Each unit of a time as "<count> <unit>"
function t(key: string, params?: { count: number }) {
  return `${params?.count} ${key.split('.').pop()}`
}

function withSettings(excludedUsers: string[], isSeerrActive = true) {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.startDate = '2026-01-01'
  settings.general.excludedUsers = excludedUsers

  if (isSeerrActive) {
    settings.connection.seerrUrl = 'http://seerr:5055'
    settings.connection.seerrApiKey = 'key'
  }

  vi.mocked(getSettings).mockReturnValue(settings)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getStatsSource).mockReturnValue({
    getHistoryPlays,
    // Only the play itself, as the sources count it without a user
    getPlayItem: async (play: Play) => ({
      ...EMPTY_ROW,
      title: play.title,
      total_plays: 1,
      total_duration: 1,
    }),
  } as unknown as ReturnType<typeof getStatsSource>)
  vi.mocked(getTranslations).mockResolvedValue(
    t as unknown as Awaited<ReturnType<typeof getTranslations>>,
  )
  vi.mocked(fetchRewindRequests).mockResolvedValue([])
})

describe('getRewindSocial', () => {
  it("adds an excluded user's own plays back to everyone's", async () => {
    withSettings(['1'])

    const social = await getRewindSocial('1', [])

    expect(getHistoryPlays).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '1' }),
    )
    expect(social.onlyYou).toMatchObject({ count: 1, share: 1 / 2 })
    expect(social.serverYear).toMatchObject({
      duration: '4 hr',
      users: 2,
      share: 1 / 2,
    })
  })

  it("reads only everyone's plays for a user who isn't excluded", async () => {
    withSettings([])

    const social = await getRewindSocial('1', [])

    expect(getHistoryPlays).toHaveBeenCalledTimes(1)
    // Alice isn't among them, so there's nothing of hers to compare
    expect(social.onlyYou).toBeNull()
    expect(social.serverYear).toMatchObject({ users: 1, share: 0 })
  })

  it("gives the cards the story's own plays, time and people", async () => {
    withSettings(['1'])

    const { onlyYou, serverYear } = await getRewindSocial('1', [])

    expect(onlyYou?.item).toEqual({
      type: 'movie',
      data: expect.objectContaining({
        title: 'Coco',
        total_plays: 1,
        total_duration: 60 * 60,
        users_watched: 1,
      }),
    })
    // Brick was watched by both
    expect(serverYear?.movie?.data).toMatchObject({
      title: 'Brick',
      total_plays: 2,
      total_duration: 2 * 60 * 60,
      users_watched: 2,
    })
  })

  it("doesn't ask Seerr when it isn't set up", async () => {
    withSettings([], false)

    const social = await getRewindSocial('1', [])

    expect(fetchRewindRequests).not.toHaveBeenCalled()
    expect(social.requestsReach).toBeNull()
  })

  it('finds who watched what the user asked for', async () => {
    withSettings([])
    vi.mocked(fetchRewindRequests).mockResolvedValue([
      {
        id: 1,
        createdAt: '2026-05-01T00:00:00Z',
        type: 'movie',
        status: 2,
        media: { tmdbId: 1, ratingKey: 'Arrival-key' },
        requestedBy: { id: 7, plexId: 1 },
      },
    ])

    const { requestsReach } = await getRewindSocial('1', [])

    expect(fetchRewindRequests).toHaveBeenCalledWith('2026-01-01')
    expect(requestsReach).toMatchObject({
      users: 1,
      requests: 1,
      duration: '1 hr',
      item: { type: 'movie', data: { title: 'Arrival' } },
      // Only Bob watched it
      isItemWatched: false,
    })
  })
})
