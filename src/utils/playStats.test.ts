import { Play, PlayMediaType } from '@/types/playHistory'
import { ItemRow, Library, TopItemsSort, TopPerson } from '@/types/statsSource'
import { sum } from 'lodash'
import { describe, expect, it, vi } from 'vitest'
import getSettings from './getSettings'
import {
  countPlayedTitles,
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

  it('leaves out plays from the end on', () => {
    const ids = filterPlays(plays, {
      since: '2026-03-01',
      until: '2026-03-09T08:00:00Z',
    }).map((item) => item.id)

    expect(ids).toEqual(['before', 'start'])
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

  function getPlayItem(
    plays: Play[],
    userId?: string,
    until?: string,
    libraries?: Library[],
  ) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [] },
    } as unknown as ReturnType<typeof getSettings>)

    return createPlayStats({
      getPlays: async (_, requestedLibraries) =>
        requestedLibraries ? [] : plays,
      getUsers: async () => [user('1', 'alice'), user('2', 'bob')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getPlayItem(firstPlay, userId, until, libraries)
  }

  it("counts the user's plays of the item since their first play", async () => {
    const item = await getPlayItem(history, '1')

    expect(item.title).toBe('Alien')
    expect(item.total_plays).toBe(2)
    expect(item.total_duration).toBe(9000)
    expect(item.users_watched).toBeUndefined()
  })

  it("leaves out the plays from an edition's end on", async () => {
    const item = await getPlayItem(history, '1', '2024-01-01T00:00:00Z')

    expect(item.total_plays).toBe(1)
    expect(item.total_duration).toBe(6000)
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

  it('scopes user plays to the given libraries', async () => {
    const shows = { section_type: 'show' } as Library
    const getPlays = vi.fn(async () => history)

    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [] },
    } as unknown as ReturnType<typeof getSettings>)

    await createPlayStats({
      getPlays,
      getUsers: async () => [user('1', 'alice')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getPlayItem(firstPlay, '1', undefined, [shows])

    expect(getPlays).toHaveBeenCalledWith(new Date(0), [shows])
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

  async function rank(sortBy?: TopItemsSort, since = '2026-01-01') {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [] },
    } as unknown as ReturnType<typeof getSettings>)

    const { items } = await createPlayStats({
      getPlays: async () => history,
      getUsers: async () => [],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getTopItems({ section_type: 'movie' } as Library, {
      since,
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

  it('leaves out plays before the exact period start date', async () => {
    expect(await rank('duration', '2026-03-02')).toEqual(['Heat', 'Alien'])
  })
})

describe('countPlayedTitles', () => {
  it('counts each movie once, however often it was played', () => {
    expect(
      countPlayedTitles(
        [
          play('heat 1', '2026-03-01T20:00:00Z', { title: 'Heat', year: 1995 }),
          play('heat 2', '2026-03-02T20:00:00Z', { title: 'Heat', year: 1995 }),
          play('dune', '2026-03-03T20:00:00Z', { title: 'Dune', year: 2021 }),
        ],
        50,
      ),
    ).toBe(2)
  })

  it("counts a show's episodes by their numbers", () => {
    function episode(id: string, season: number, number: number, title = id) {
      return play(id, '2026-03-01T20:00:00Z', {
        mediaType: 'episode',
        title,
        showTitle: 'Severance',
        seasonNumber: season,
        episodeNumber: number,
      })
    }

    expect(
      countPlayedTitles(
        [
          episode('pilot', 1, 1),
          // Renamed since, but the same episode
          episode('pilot again', 1, 1, 'Good News About Hell'),
          episode('second', 1, 2),
          episode('premiere', 2, 1),
          play('other show', '2026-03-01T20:00:00Z', {
            mediaType: 'episode',
            title: 'Pilot',
            showTitle: 'Andor',
            seasonNumber: 1,
            episodeNumber: 1,
          }),
        ],
        50,
      ),
    ).toBe(4)
  })

  it('tells specials apart from the first season', () => {
    function episode(id: string, season: number, number: number) {
      return play(id, '2026-03-01T20:00:00Z', {
        mediaType: 'episode',
        title: 'Episode',
        showTitle: 'Doctor Who',
        seasonNumber: season,
        episodeNumber: number,
      })
    }

    expect(
      countPlayedTitles(
        [
          episode('special', 0, 1),
          episode('first', 1, 1),
          episode('again', 0, 1),
        ],
        50,
      ),
    ).toBe(2)
  })

  it('counts episodes without numbers by their title', () => {
    function episode(id: string, title: string) {
      return play(id, '2026-03-01T20:00:00Z', {
        mediaType: 'episode',
        title,
        showTitle: 'Severance',
      })
    }

    expect(
      countPlayedTitles(
        [
          episode('1', 'Good News About Hell'),
          episode('2', 'good news about hell'),
          episode('3', 'Half Loop'),
        ],
        50,
      ),
    ).toBe(2)
  })

  it('counts tracks by their title within the artist', () => {
    function track(id: string, title: string, artistName: string) {
      return play(id, '2026-03-01T20:00:00Z', {
        mediaType: 'track',
        title,
        artistName,
        durationMs: 3 * 60 * 1000,
      })
    }

    expect(
      countPlayedTitles(
        [
          track('1', 'Intro', 'The xx'),
          track('2', 'intro ', 'The xx'),
          track('3', 'Intro', 'M83'),
          track('4', 'Angels', 'The xx'),
        ],
        50,
      ),
    ).toBe(3)
  })

  it('leaves out titles without a play that counts', () => {
    expect(
      countPlayedTitles(
        [
          play('given up', '2026-03-01T20:00:00Z', {
            title: 'Alien',
            percentComplete: 10,
          }),
          play('watched', '2026-03-01T20:00:00Z', { title: 'Heat' }),
        ],
        50,
      ),
    ).toBe(1)
  })
})

describe('getPlayedCount', () => {
  it("counts only the user's plays in the period", async () => {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: ['2'], minPlayPercent: 50 },
    } as unknown as ReturnType<typeof getSettings>)

    const count = await createPlayStats({
      getPlays: async () => [
        play('heat', '2026-03-02T20:00:00Z', { title: 'Heat' }),
        play('dune', '2026-03-03T20:00:00Z', { title: 'Dune' }),
        play('before', '2026-02-01T20:00:00Z', { title: 'Alien' }),
        play('bob', '2026-03-03T20:00:00Z', {
          title: 'Up',
          identityId: 'bob',
        }),
      ],
      // The user's own count, even when they're excluded from the server's
      getUsers: async () => [user('2', 'alice'), user('3', 'bob')],
      getMediaData: async () => ({ thumb: '', isDeleted: false }),
    }).getPlayedCount({ section_type: 'movie' } as Library, {
      since: '2026-03-01',
      userId: '2',
    })

    expect(count).toBe(2)
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
      since: '2026-01-01',
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
      since: '2026-01-01',
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
      since: '2026-01-01',
      sortBy: 'duration',
      count: 5,
    })

    expect(items.map((item) => [item.title, item.total_plays])).toEqual([
      ['Heat', 0],
      ['Alien', 1],
    ])
  })

  it('add watch time to the media stats, but not a play', async () => {
    const stats = await getStats().getMediaStats('1', [movies], {
      since: '2026-01-01',
    })

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
    const { hourly, daily } = await getStats().getPlaysByTime('2', [movies], {
      since: '2026-01-01',
    })

    expect(sum(hourly)).toBe(1)
    expect(sum(daily)).toBe(1)
  })
})

describe('getTopPeople', () => {
  // Three movies with the same star sampled for minutes, two others watched
  const runtime = 140 * 60 * 1000
  const casts: Record<string, string[]> = {
    'Mad Max: Fury Road': ['Charlize Theron'],
    Prometheus: ['Charlize Theron'],
    'Atomic Blonde': ['Charlize Theron'],
    Gladiator: ['Russell Crowe'],
    'A Beautiful Mind': ['Russell Crowe'],
  }
  const history = Object.keys(casts).map((title, i) => {
    const isSampled = casts[title][0] === 'Charlize Theron'

    return play(title, `2026-03-0${i + 1}T20:00:00Z`, {
      title,
      lengthMs: runtime,
      durationMs: isSampled ? 7 * 60 * 1000 : runtime,
    })
  })

  async function getPeople(plays: Play[], cast: Record<string, string[]>) {
    vi.mocked(getSettings).mockReturnValue({
      general: { excludedUsers: [], minPlayPercent: 50 },
    } as unknown as ReturnType<typeof getSettings>)

    const getMediaData = vi.fn(async (item: ItemRow) => ({
      thumb: '',
      isDeleted: false,
      credits: { directors: [], actors: cast[item.title] },
    }))
    const people = await createPlayStats({
      getPlays: async () => plays,
      getUsers: async () => [user('1', 'alice')],
      getMediaData,
    }).getTopPeople(
      '1',
      [
        { section_type: 'movie' } as Library,
        { section_type: 'show' } as Library,
      ],
      { since: '2026-01-01' },
    )

    return {
      people,
      lookups: getMediaData.mock.calls.map(([item]) => item.title),
    }
  }

  function summarize(people: TopPerson[]) {
    return people.map(({ name, count, duration }) => ({
      name,
      count,
      duration,
    }))
  }

  it('leaves out titles without a play that counts, before their credits', async () => {
    const { people, lookups } = await getPeople(history, casts)

    expect(lookups).toEqual(['Gladiator', 'A Beautiful Mind'])
    expect(summarize(people.movieActors)).toEqual([
      { name: 'Russell Crowe', count: 2, duration: 2 * 140 * 60 },
    ])
  })

  it('looks nothing up when every title was only sampled', async () => {
    const sampled = history.filter(
      (play) => casts[play.title][0] === 'Charlize Theron',
    )
    const { people, lookups } = await getPeople(sampled, casts)

    expect(lookups).toEqual([])
    expect(people).toEqual({ directors: [], movieActors: [], showActors: [] })
  })

  it("counts a show once, with its sampled episodes' watch time", async () => {
    const episodeLength = 50 * 60 * 1000

    function episode(
      id: string,
      showTitle: string,
      overrides: Partial<Play>,
    ): Play {
      return play(id, '2026-03-01T20:00:00Z', {
        mediaType: 'episode',
        showTitle,
        lengthMs: episodeLength,
        ...overrides,
      })
    }

    // The same show on two servers, one episode watched and one sampled
    const plays = [
      episode('watched', 'Severance', {
        title: 'Good News About Hell',
        grandparentRatingKey: '10',
        showMediaId: 'severance',
        durationMs: episodeLength,
      }),
      episode('sampled', 'Severance', {
        title: 'Half Loop',
        grandparentRatingKey: '20',
        showMediaId: 'severance',
        durationMs: 3 * 60 * 1000,
      }),
      episode('other', 'Andor', {
        title: 'Kassa',
        showMediaId: 'andor',
        durationMs: episodeLength,
      }),
    ]
    const { people, lookups } = await getPeople(plays, {
      Severance: ['Adam Scott'],
      Andor: ['Adam Scott'],
    })

    expect(lookups).toEqual(['Severance', 'Andor'])
    expect(summarize(people.showActors)).toEqual([
      { name: 'Adam Scott', count: 2, duration: (2 * 50 + 3) * 60 },
    ])
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

    await getStats(getPlays).getPlaysByTime('1', [movies], {
      since: '2026-01-01',
    })

    expect(getPlays).toHaveBeenCalledWith('2026-01-01', [movies])
  })

  it('counts the hours and days in the timezone', async () => {
    // Saturday at 02:30 in UTC, still Friday evening in New York
    const late = play('late', '2026-03-07T02:30:00Z')
    const stats = getStats(async () => [late])
    const utc = await stats.getPlaysByTime(
      '1',
      [movies],
      { since: '2026-01-01' },
      'UTC',
    )
    const newYork = await stats.getPlaysByTime(
      '1',
      [movies],
      { since: '2026-01-01' },
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
