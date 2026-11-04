import { Play } from '@/types/playHistory'
import { cloneDeep } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import getSettings from './getSettings'
import { EMPTY_ROW } from './playStats'
import { getStatsSource } from './statsSource'
import {
  getComfortWatch,
  getDiscoveries,
  getGaveUp,
  getTimeTravel,
  getTitleMoments,
} from './titleMoments'

vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }))
vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./statsSource', () => ({ getStatsSource: vi.fn() }))

const MINUTE = 60 * 1000
const MIN_PERCENT = 50
const NOW = new Date('2026-11-04T12:00:00Z').getTime()

// A finished movie unless the overrides say otherwise
function play(
  id: string,
  startedAt: string,
  overrides: Partial<Play> = {},
): Play {
  return {
    id,
    startedAt: new Date(startedAt).getTime(),
    mediaType: 'movie',
    durationMs: 90 * MINUTE,
    percentComplete: 100,
    title: id,
    showTitle: null,
    artistName: null,
    year: 2020,
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

function episode(
  id: string,
  startedAt: string,
  showTitle: string,
  [seasonNumber, episodeNumber]: [number, number],
  overrides: Partial<Play> = {},
): Play {
  return play(id, startedAt, {
    mediaType: 'episode',
    durationMs: 30 * MINUTE,
    showTitle,
    seasonNumber,
    episodeNumber,
    ...overrides,
  })
}

function track(id: string, startedAt: string, artistName: string): Play {
  return play(id, startedAt, {
    mediaType: 'track',
    durationMs: 4 * MINUTE,
    artistName,
    year: 1974,
  })
}

describe('getComfortWatch', () => {
  it('finds the movie played the most times', () => {
    const plays = [
      play('heat-1', '2026-02-01', { title: 'Heat' }),
      play('heat-2', '2026-05-01', { title: 'Heat' }),
      play('heat-3', '2026-08-01', { title: 'Heat' }),
      play('alien-1', '2026-03-01', { title: 'Alien' }),
      play('alien-2', '2026-04-01', { title: 'Alien' }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)).toEqual({
      play: plays[2],
      watches: 3,
      isEpisode: false,
    })
  })

  it('only counts the plays that count', () => {
    const plays = [
      play('heat-1', '2026-02-01', { title: 'Heat' }),
      play('heat-2', '2026-05-01', { title: 'Heat', percentComplete: 20 }),
      play('heat-3', '2026-08-01', { title: 'Heat', percentComplete: 20 }),
      play('alien-1', '2026-03-01', { title: 'Alien' }),
      play('alien-2', '2026-04-01', { title: 'Alien' }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)?.play.title).toBe('Alien')
  })

  it('caps the plays by the time spent on it', () => {
    const plays = [
      // Opened at the end again, which the source logs as a play
      episode('watched', '2026-01-01', 'Slow Horses', [1, 3]),
      episode('reopened-1', '2026-01-08', 'Slow Horses', [1, 3], {
        durationMs: 0,
        percentComplete: 98,
      }),
      episode('reopened-2', '2026-01-09', 'Slow Horses', [1, 3], {
        durationMs: 0,
        percentComplete: 98,
      }),
      // Watched in two sittings that each count, and half of it again
      play('heat-1', '2026-02-01', {
        title: 'Heat',
        durationMs: 60 * MINUTE,
        percentComplete: 60,
      }),
      play('heat-2', '2026-02-02', { title: 'Heat', durationMs: 40 * MINUTE }),
      play('heat-3', '2026-03-01', {
        title: 'Heat',
        durationMs: 50 * MINUTE,
        percentComplete: 50,
      }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)).toBeNull()
  })

  it('adds the short play a split watch starts with to its time', () => {
    const plays = [
      play('heat-1', '2026-02-01', { title: 'Heat', durationMs: 100 * MINUTE }),
      // Watched again in two sittings, the first short of the percent
      play('heat-2', '2026-03-01', {
        title: 'Heat',
        durationMs: 50 * MINUTE,
        percentComplete: 50,
      }),
      play('heat-3', '2026-03-02', { title: 'Heat', durationMs: 50 * MINUTE }),
    ]

    expect(getComfortWatch(plays, 80)?.watches).toBe(2)
  })

  it('counts the plays without a percent complete', () => {
    const plays = [
      play('heat-1', '2026-02-01', { title: 'Heat', percentComplete: null }),
      play('heat-2', '2026-05-01', { title: 'Heat', percentComplete: null }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)?.watches).toBe(2)
  })

  it('leaves it out when nothing was played twice', () => {
    expect(
      getComfortWatch(
        [play('heat', '2026-02-01'), play('alien', '2026-03-01')],
        MIN_PERCENT,
      ),
    ).toBeNull()
    expect(getComfortWatch([], MIN_PERCENT)).toBeNull()
  })

  it('picks an episode played more times than any movie', () => {
    const plays = [
      episode('pilot-1', '2026-01-01', 'Friends', [1, 1]),
      episode('pilot-2', '2026-02-01', 'Friends', [1, 1]),
      episode('pilot-3', '2026-03-01', 'Friends', [1, 1]),
      // The show's other episodes don't add up with it
      episode('second', '2026-01-02', 'Friends', [1, 2]),
      episode('third', '2026-01-03', 'Friends', [1, 3]),
      play('heat-1', '2026-02-01', { title: 'Heat' }),
      play('heat-2', '2026-05-01', { title: 'Heat' }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)).toEqual({
      play: plays[2],
      watches: 3,
      isEpisode: true,
    })
  })

  it('gives a tie to the movie', () => {
    const plays = [
      episode('pilot-1', '2026-01-01', 'Friends', [1, 1]),
      episode('pilot-2', '2026-02-01', 'Friends', [1, 1]),
      play('heat-1', '2026-02-01', { title: 'Heat' }),
      play('heat-2', '2026-05-01', { title: 'Heat' }),
    ]

    expect(getComfortWatch(plays, MIN_PERCENT)?.isEpisode).toBe(false)
  })
})

describe('getTimeTravel', () => {
  it('finds the decade with the most time and the oldest title', () => {
    const plays = [
      play('clerks', '2026-02-01', { year: 1994 }),
      play('matrix', '2026-03-01', { year: 1999 }),
      play('dune', '2026-04-01', { year: 2021, durationMs: 150 * MINUTE }),
      // Each episode counts in the decade it aired
      episode('pilot', '2026-05-01', 'Seinfeld', [1, 1], { year: 1989 }),
      episode('later', '2026-05-02', 'Seinfeld', [3, 1], { year: 1991 }),
    ]
    const travel = getTimeTravel(plays, MIN_PERCENT)

    // 210 of 390 minutes
    expect(travel?.decade).toBe(1990)
    expect(travel?.share).toBeCloseTo(210 / 390)
    expect(travel?.oldest).toEqual({ play: plays[3], year: 1989 })
  })

  it('leaves out music and plays without a year', () => {
    const plays = [
      play('heat', '2026-02-01', { year: 1995 }),
      play('unknown', '2026-03-01', { year: null, durationMs: 500 * MINUTE }),
      play('dune', '2026-04-01', { year: 2021, durationMs: 150 * MINUTE }),
      track('waterloo', '2026-04-01', 'ABBA'),
    ]
    const travel = getTimeTravel(plays, MIN_PERCENT)

    expect(travel?.decade).toBe(2020)
    expect(travel?.share).toBeCloseTo(150 / 240)
    expect(travel?.oldest.year).toBe(1995)
  })

  it('goes back only as far as a play that counts', () => {
    const plays = [
      play('metropolis', '2026-02-01', {
        year: 1927,
        durationMs: 300 * MINUTE,
        percentComplete: 10,
      }),
      play('heat', '2026-03-01', { year: 1995 }),
      play('dune', '2026-04-01', { year: 2021 }),
    ]
    const travel = getTimeTravel(plays, MIN_PERCENT)

    expect(travel?.decade).toBe(1920)
    expect(travel?.oldest.year).toBe(1995)
  })

  it('leaves it out with a single decade', () => {
    const plays = [
      play('dune', '2026-04-01', { year: 2021 }),
      play('barbie', '2026-05-01', { year: 2023 }),
    ]

    expect(getTimeTravel(plays, MIN_PERCENT)).toBeNull()
    expect(getTimeTravel([], MIN_PERCENT)).toBeNull()
  })
})

describe('getDiscoveries', () => {
  const earlierPlays = [
    episode('friends-old', '2025-06-01', 'Friends', [1, 1]),
    track('waterloo-old', '2025-06-02', 'ABBA'),
  ]
  const plays = [
    episode('friends', '2026-01-10', 'Friends', [1, 2]),
    track('waterloo', '2026-01-11', 'ABBA'),
    episode('severance-1', '2026-02-01', 'Severance', [1, 1]),
    episode('severance-2', '2026-02-02', 'Severance', [1, 2]),
    episode('severance-3', '2026-02-03', 'Severance', [1, 3]),
    episode('bluey', '2026-03-01', 'Bluey', [1, 1], { durationMs: 7 * MINUTE }),
    track('around', '2026-04-01', 'Daft Punk'),
    // Barely started, so it's not a discovery
    episode('lost', '2026-05-01', 'Lost', [1, 1], { percentComplete: 5 }),
  ]
  // A past period's discovery can be played again after it
  const laterPlays = [episode('severance-4', '2026-12-01', 'Severance', [1, 4])]

  it('counts the shows and artists played for the first time', () => {
    expect(
      getDiscoveries(
        plays,
        [...earlierPlays, ...plays, ...laterPlays],
        MIN_PERCENT,
      ),
    ).toEqual({
      shows: 2,
      artists: 1,
      top: { play: plays[4], durationMs: 90 * MINUTE },
    })
  })

  it('leaves it out for a user without plays before the period', () => {
    expect(getDiscoveries(plays, plays, MIN_PERCENT)).toBeNull()
    expect(getDiscoveries([], earlierPlays, MIN_PERCENT)).toBeNull()
  })

  it('leaves it out without anything new', () => {
    const oldPlays = plays.slice(0, 2)

    expect(
      getDiscoveries(oldPlays, [...earlierPlays, ...oldPlays], MIN_PERCENT),
    ).toBeNull()
  })
})

describe('getGaveUp', () => {
  // Of a two-hour movie
  function unfinished(
    title: string,
    startedAt: string,
    percentComplete: number,
    overrides: Partial<Play> = {},
  ): Play {
    return play(`${title}-${startedAt}`, startedAt, {
      title,
      percentComplete,
      durationMs: percentComplete * 1.2 * MINUTE,
      ...overrides,
    })
  }

  it('finds the unfinished movie the user got the furthest in', () => {
    const plays = [
      unfinished('dune', '2026-03-01', 30),
      unfinished('dune', '2026-03-05', 45),
      unfinished('tenet', '2026-04-01', 40),
      play('heat', '2026-05-01'),
    ]

    expect(getGaveUp(plays, plays, MIN_PERCENT, NOW)).toEqual({
      play: plays[1],
      percent: 0.45,
    })
  })

  it('leaves out a movie finished before or after the period', () => {
    const plays = [
      unfinished('dune', '2026-03-01', 40),
      unfinished('tenet', '2026-04-01', 40),
    ]
    const allPlays = [
      play('dune-before', '2024-01-01', { title: 'dune' }),
      ...plays,
      play('tenet-after', '2026-10-01', { title: 'tenet' }),
    ]

    expect(getGaveUp(plays, allPlays, MIN_PERCENT, NOW)).toBeNull()
  })

  it("leaves out a misclick, the credits, and a movie that's still on", () => {
    const plays = [
      unfinished('misclick', '2026-03-01', 3, { durationMs: 4 * MINUTE }),
      unfinished('credits', '2026-04-01', 95),
      unfinished('tonight', '2026-11-01', 40),
    ]

    expect(getGaveUp(plays, plays, 100, NOW)).toBeNull()
  })

  it('leaves out a movie that was only played before the period', () => {
    const earlier = unfinished('dune', '2024-03-01', 40)

    expect(getGaveUp([], [earlier], MIN_PERCENT, NOW)).toBeNull()
  })
})

describe('getTitleMoments', () => {
  beforeEach(() => {
    const t = (key: string, params?: { count: number }) =>
      `${params?.count} ${key.split('.').pop()}`

    vi.mocked(getSettings).mockReturnValue(cloneDeep(DEFAULT_SETTINGS))
    vi.mocked(getTranslations).mockResolvedValue(
      t as unknown as Awaited<ReturnType<typeof getTranslations>>,
    )
    vi.mocked(getStatsSource).mockReturnValue({
      getPlayItem: vi.fn(async (play: Play) => ({
        ...EMPTY_ROW,
        title: play.showTitle ?? play.title,
      })),
    } as unknown as ReturnType<typeof getStatsSource>)
  })

  const plays = [
    episode('pilot-1', '2026-01-01', 'Friends', [1, 1], { title: 'Pilot' }),
    episode('pilot-2', '2026-02-01', 'Friends', [1, 1], { title: 'Pilot' }),
    episode('severance', '2026-03-01', 'Severance', [1, 1], { year: 2022 }),
  ]

  it('turns the moments into cards', async () => {
    const moments = await getTitleMoments(plays, [
      episode('friends-old', '2025-06-01', 'Friends', [1, 2]),
      ...plays,
    ])

    expect(moments.comfortWatch).toMatchObject({
      item: { title: 'Friends' },
      type: 'show',
      episode: 'Pilot',
      watches: 2,
    })
    expect(moments.timeTravel).toBeNull()
    expect(moments.discoveries).toMatchObject({
      shows: 1,
      artists: 0,
      top: { item: { title: 'Severance' }, type: 'show', duration: '30 min' },
    })
    expect(moments.gaveUp).toBeNull()
  })

  it('waits for the whole history for what came before the period', async () => {
    const moments = await getTitleMoments(plays, null)

    expect(moments.comfortWatch).not.toBeNull()
    expect(moments.discoveries).toBeNull()
    expect(moments.gaveUp).toBeNull()
  })
})
