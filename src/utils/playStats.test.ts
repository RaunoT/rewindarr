import { Play, PlayMediaType } from '@/types/playHistory'
import { ItemRow, Library, TopItemsSort } from '@/types/statsSource'
import { sum } from 'lodash'
import { describe, expect, it, vi } from 'vitest'
import getSettings from './getSettings'
import {
  createPlayStats,
  filterPlays,
  getExcludedIdentityIds,
  isCountedPlay,
  isPlayOfItem,
  MIN_PLAY_MS,
  StatsUser,
  toSourceId,
} from './playStats'

vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./getMediaAdditionalData', () => ({
  default: async (items: ItemRow[]) => items,
}))

function play(
  id: string,
  startedAt: string,
  overrides: Partial<Play> = {},
): Play {
  return {
    id,
    startedAt: new Date(startedAt).getTime(),
    mediaType: 'movie' as PlayMediaType,
    durationMs: 60 * 1000,
    percentComplete: null,
    title: id,
    showTitle: null,
    artistName: null,
    year: null,
    thumb: '',
    ratingKey: null,
    grandparentRatingKey: null,
    mediaId: null,
    showMediaId: null,
    imdbId: null,
    tmdbId: null,
    identityId: 'alice',
    avatar: '',
    seasonNumber: null,
    episodeNumber: null,
    transcodeDecision: null,
    lengthMs: null,
    ...overrides,
  }
}

function user(userId: string, identityId: string): StatsUser {
  return {
    identityId,
    userId,
    username: identityId,
    friendlyName: identityId,
  }
}

const plays = [
  play('before', '2026-03-07T23:59:59Z'),
  play('start', '2026-03-08T12:00:00Z'),
  play('after', '2026-03-09T08:00:00Z', { identityId: 'bob' }),
  play('episode', '2026-03-10T08:00:00Z', {
    mediaType: 'episode',
    identityId: 'carol',
  }),
]

describe('toSourceId', () => {
  it("keeps Plex's IDs numbers and Jellyfin's as they are", () => {
    expect(toSourceId('12345')).toBe(12345)
    expect(toSourceId('a1b2c3')).toBe('a1b2c3')
    expect(toSourceId(null)).toBe(0)
  })
})

describe('isPlayOfItem', () => {
  it('matches by the media id, or else by the title and year', () => {
    const dune = play('dune', '2026-03-01', {
      title: 'Dune',
      year: 2021,
      mediaId: 'm1',
    })
    const imported = { ...dune, mediaId: null }

    expect(
      isPlayOfItem(dune, { title: 'Other', year: null, media_id: 'm1' }),
    ).toBe(true)
    expect(
      isPlayOfItem(dune, { title: 'Dune', year: 2021, media_id: 'm2' }),
    ).toBe(false)
    expect(
      isPlayOfItem(imported, { title: ' dune ', year: 2021, media_id: 'm1' }),
    ).toBe(true)
    expect(
      isPlayOfItem(imported, { title: 'Dune', year: 1984, media_id: null }),
    ).toBe(false)
  })
})

describe('filterPlays', () => {
  it('keeps only plays from the exact start, not the whole UTC day', () => {
    const ids = filterPlays(plays, { since: '2026-03-08T12:00:00Z' }).map(
      (item) => item.id,
    )

    expect(ids).toEqual(['start', 'after', 'episode'])
  })

  it('treats a date-only start as the start of that UTC day', () => {
    const ids = filterPlays(plays, { since: '2026-03-08' }).map(
      (item) => item.id,
    )

    expect(ids).toEqual(['start', 'after', 'episode'])
  })

  it('accepts a Date as the start', () => {
    expect(
      filterPlays(plays, { since: new Date('2026-03-10T00:00:00Z') }),
    ).toHaveLength(1)
  })

  it('returns nothing for an invalid start', () => {
    expect(filterPlays(plays, { since: 'not a date' })).toEqual([])
  })

  it('filters by media type and by user', () => {
    const since = '2026-03-01'

    expect(
      filterPlays(plays, { since, mediaTypes: ['episode'] }).map(
        (item) => item.id,
      ),
    ).toEqual(['episode'])
    expect(
      filterPlays(plays, { since, identityId: 'bob' }).map((item) => item.id),
    ).toEqual(['after'])
  })

  it('leaves out excluded users', () => {
    const ids = filterPlays(plays, {
      since: '2026-03-01',
      excludedIdentityIds: ['alice', 'carol'],
    }).map((item) => item.id)

    expect(ids).toEqual(['after'])
  })
})

describe('getExcludedIdentityIds', () => {
  const users = [user('1', 'alice'), user('2', 'bob'), user('3', 'carol')]

  it('maps excluded Plex IDs to Tracearr identities', () => {
    expect(getExcludedIdentityIds(users, ['2', '3'])).toEqual(['bob', 'carol'])
  })

  it('ignores IDs that are not known users', () => {
    expect(getExcludedIdentityIds(users, ['99'])).toEqual([])
    expect(getExcludedIdentityIds(users, [])).toEqual([])
  })
})

describe('getPlayItem', () => {
  const firstPlay = play('first', '2020-01-01T20:00:00Z', {
    title: 'Alien',
    year: 1979,
    durationMs: 6000_000,
    mediaId: 'alien',
  })
  const history = [
    firstPlay,
    play('again', '2024-05-01T20:00:00Z', {
      title: 'Alien',
      year: 1979,
      durationMs: 3000_000,
      mediaId: 'alien',
    }),
    play('other movie', '2024-06-01T20:00:00Z', {
      title: 'Aliens',
      year: 1986,
      mediaId: 'aliens',
    }),
    play('other user', '2024-07-01T20:00:00Z', {
      title: 'Alien',
      year: 1979,
      mediaId: 'alien',
      identityId: 'bob',
    }),
  ]

  function getPlayItem(plays: Play[], userId?: string) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [] },
    } as unknown as ReturnType<typeof getSettings>)

    return createPlayStats({
      getPlays: async () => plays,
      getUsers: async () => [user('1', 'alice'), user('2', 'bob')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getPlayItem(firstPlay, userId)
  }

  it("counts the user's plays of the item since their first play", async () => {
    const item = await getPlayItem(history, '1')

    expect(item.title).toBe('Alien')
    expect(item.total_plays).toBe(2)
    expect(item.total_duration).toBe(9000)
    expect(item.users_watched).toBeUndefined()
  })

  it('counts the first play when the history leaves it out', async () => {
    const item = await getPlayItem(history.slice(1), '1')

    expect(item.total_plays).toBe(2)
    expect(item.total_duration).toBe(9000)
  })

  it('counts only the first play without a user', async () => {
    const item = await getPlayItem(history)

    expect(item.total_plays).toBe(1)
    expect(item.total_duration).toBe(6000)
  })
})

describe('getTopItems', () => {
  // Dune has the most watch time, Heat the most plays and Alien the most users
  const history = [
    play('dune', '2026-03-01T20:00:00Z', {
      title: 'Dune',
      durationMs: 9000_000,
    }),
    ...['1', '2', '3'].map((id) =>
      play(`heat ${id}`, '2026-03-02T20:00:00Z', { title: 'Heat' }),
    ),
    ...['alice', 'bob'].map((identityId) =>
      play(`alien ${identityId}`, '2026-03-03T20:00:00Z', {
        title: 'Alien',
        identityId,
      }),
    ),
  ]

  async function rank(sortBy?: TopItemsSort) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [] },
    } as unknown as ReturnType<typeof getSettings>)

    const { items } = await createPlayStats({
      getPlays: async () => history,
      getUsers: async () => [],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getTopItems({ section_type: 'movie' } as Library, {
      period: 3650,
      sortBy,
      count: 5,
    })

    return items.map((item) => item.title)
  }

  it('ranks by watch time by default', async () => {
    expect(await rank()).toEqual(['Dune', 'Heat', 'Alien'])
  })

  it('ranks by plays', async () => {
    expect(await rank('plays')).toEqual(['Heat', 'Alien', 'Dune'])
  })

  it('ranks by users, then by plays', async () => {
    expect(await rank('users')).toEqual(['Alien', 'Heat', 'Dune'])
  })
})

describe('plays short of the percent in the settings', () => {
  // Alien was given up on once and watched once, Heat only given up on
  const history = [
    play('alien given up', '2026-03-01T20:00:00Z', {
      title: 'Alien',
      durationMs: 10 * 60 * 1000,
      percentComplete: 30,
    }),
    play('alien', '2026-03-02T20:00:00Z', {
      title: 'Alien',
      identityId: 'bob',
      durationMs: 30 * 60 * 1000,
      percentComplete: 50,
    }),
    play('heat given up', '2026-03-03T20:00:00Z', {
      title: 'Heat',
      durationMs: 90 * 60 * 1000,
      percentComplete: 40,
    }),
  ]
  const movies = { section_type: 'movie' } as Library

  function getStats(minPlayPercent = 50) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [], minPlayPercent },
    } as unknown as ReturnType<typeof getSettings>)

    return createPlayStats({
      getPlays: async () => history,
      getUsers: async () => [user('1', 'alice'), user('2', 'bob')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    })
  }

  it('count as plays only from the percent, or when unknown', () => {
    expect(
      isCountedPlay(play('half', '2026-03-01', { percentComplete: 50 }), 50),
    ).toBe(true)
    expect(
      isCountedPlay(play('less', '2026-03-01', { percentComplete: 49 }), 50),
    ).toBe(false)
    expect(
      isCountedPlay(
        play('unknown', '2026-03-01', { percentComplete: null }),
        50,
      ),
    ).toBe(true)
  })

  it('count as plays only from half a minute, whatever the percent', () => {
    // Opened again at its end, which the source logs near 100%
    expect(
      isCountedPlay(
        play('reopened', '2026-03-01', { durationMs: 0, percentComplete: 98 }),
        50,
      ),
    ).toBe(false)
    expect(
      isCountedPlay(
        play('short', '2026-03-01', {
          durationMs: MIN_PLAY_MS - 1,
          percentComplete: null,
        }),
        0,
      ),
    ).toBe(false)
    expect(
      isCountedPlay(
        play('track', '2026-03-01', {
          durationMs: MIN_PLAY_MS,
          percentComplete: 50,
        }),
        50,
      ),
    ).toBe(true)
  })

  it('count by the time played against the length, where it is known', () => {
    const movie = { lengthMs: 2 * 60 * 60 * 1000 }

    // A post-credits scene: past half a minute, but only from the end
    expect(
      isCountedPlay(
        play('credits', '2026-03-01', {
          ...movie,
          durationMs: 5 * 60 * 1000,
          percentComplete: 100,
        }),
        50,
      ),
    ).toBe(false)
    // Resumed at 40% and watched to 95%
    expect(
      isCountedPlay(
        play('resumed', '2026-03-01', {
          ...movie,
          durationMs: 66 * 60 * 1000,
          percentComplete: 95,
        }),
        50,
      ),
    ).toBe(true)
    // A short track counts by its length, even under half a minute
    expect(
      isCountedPlay(
        play('interlude', '2026-03-01', {
          lengthMs: 40 * 1000,
          durationMs: 25 * 1000,
          percentComplete: 62,
        }),
        50,
      ),
    ).toBe(true)
  })

  it('count every play with the percent at 0', async () => {
    const { items } = await getStats(0).getTopItems(movies, {
      period: 3650,
      sortBy: 'plays',
      count: 5,
    })

    expect(items.map((item) => [item.title, item.total_plays])).toEqual([
      ['Alien', 2],
      ['Heat', 1],
    ])
  })

  it('add their watch time to an item, but not a play or a user', async () => {
    const { items } = await getStats().getTopItems(movies, {
      period: 3650,
      sortBy: 'plays',
      count: 5,
    })

    expect(items).toEqual([
      expect.objectContaining({
        title: 'Alien',
        total_plays: 1,
        total_duration: 40 * 60,
        users_watched: 1,
      }),
    ])
  })

  it('keep an item without a counted play in the watch time ranking', async () => {
    const { items } = await getStats().getTopItems(movies, {
      period: 3650,
      sortBy: 'duration',
      count: 5,
    })

    expect(items.map((item) => [item.title, item.total_plays])).toEqual([
      ['Heat', 0],
      ['Alien', 1],
    ])
  })

  it('add watch time to the media stats, but not a play', async () => {
    const stats = await getStats().getMediaStats('1', [movies], '2026-01-01')

    expect(stats.movies).toEqual({ count: 0, duration: 100 * 60 })
  })

  it('add watch time to the top users, but not a play', async () => {
    const users = await getStats().getTopUsers({
      since: '2026-01-01',
      libraries: [movies],
    })

    expect(
      users?.map((item) => [
        item.user,
        item.total_plays,
        item.movies_plays_count,
        item.total_duration,
      ]),
    ).toEqual([
      ['alice', 0, 0, 100 * 60],
      ['bob', 1, 1, 30 * 60],
    ])
  })

  it('are left out of the hours and days', async () => {
    const { hourly, daily } = await getStats().getPlaysByTime(
      '2',
      [movies],
      '2026-01-01',
    )

    expect(sum(hourly)).toBe(1)
    expect(sum(daily)).toBe(1)
  })
})

describe('getPlaysByTime', () => {
  const movies = { section_type: 'movie' } as Library

  function getStats(getPlays: () => Promise<Play[]>) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [], minPlayPercent: 50 },
    } as unknown as ReturnType<typeof getSettings>)

    return createPlayStats({
      getPlays,
      getUsers: async () => [user('1', 'alice')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    })
  }

  it('counts only the plays in the libraries', async () => {
    const getPlays = vi.fn(async () => plays)

    await getStats(getPlays).getPlaysByTime('1', [movies], '2026-01-01')

    expect(getPlays).toHaveBeenCalledWith('2026-01-01', [movies])
  })

  it('counts the hours and days in the timezone', async () => {
    // Saturday at 02:30 in UTC, still Friday evening in New York
    const late = play('late', '2026-03-07T02:30:00Z')
    const stats = getStats(async () => [late])
    const utc = await stats.getPlaysByTime('1', [movies], '2026-01-01', 'UTC')
    const newYork = await stats.getPlaysByTime(
      '1',
      [movies],
      '2026-01-01',
      'America/New_York',
    )

    expect([utc.hourly[2], utc.daily[6]]).toEqual([1, 1])
    expect([newYork.hourly[21], newYork.daily[5]]).toEqual([1, 1])
  })
})

describe('getHistoryPlays', () => {
  function getHistoryPlays(excludedUsers: string[] = []) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers },
    } as unknown as ReturnType<typeof getSettings>)

    return createPlayStats({
      getPlays: async () => plays,
      getUsers: async () => [user('1', 'alice'), user('2', 'bob')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getHistoryPlays({ since: '2026-03-08T00:00:00Z' })
  }

  it('lists the plays since the start, the newest first, with who played them', async () => {
    const history = await getHistoryPlays()

    expect(
      history.map((play) => [play.id, play.userId, play.userName]),
    ).toEqual([
      ['episode', '', ''],
      ['after', '2', 'bob'],
      ['start', '1', 'alice'],
    ])
  })

  it('leaves out the excluded users', async () => {
    const history = await getHistoryPlays(['2'])

    expect(history.map((play) => play.id)).toEqual(['episode', 'start'])
  })
})
