import { Play } from '@/types/playHistory'
import { cloneDeep } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import getSettings from './getSettings'
import {
  compareYears,
  getFavoriteChange,
  getPreviousStart,
  getYearOverYear,
  splitPlays,
} from './yearOverYear'

vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }))
vi.mock('./getSettings', () => ({ default: vi.fn() }))

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
const MIN_PERCENT = 50
const NOW = Date.parse('2026-11-04T12:00:00Z')
// The past year's start, and the year before it as long as the past year
const SINCE = Date.parse('2025-11-04')
const PREVIOUS_SINCE = Date.parse('2024-11-03T12:00:00Z')
const OPTIONS = {
  since: SINCE,
  now: NOW,
  minPlayPercent: MIN_PERCENT,
  timeZone: 'UTC',
}

// A finished movie unless the overrides say otherwise
function play(
  id: string,
  startedAt: string | number,
  overrides: Partial<Play> = {},
): Play {
  return {
    id,
    startedAt: new Date(startedAt).getTime(),
    mediaType: 'movie',
    durationMs: 90 * MINUTE,
    lengthMs: null,
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
    ...overrides,
  }
}

function episode(
  id: string,
  startedAt: string,
  showTitle: string,
  overrides: Partial<Play> = {},
): Play {
  return play(id, startedAt, {
    mediaType: 'episode',
    durationMs: 30 * MINUTE,
    title: `${showTitle} ${id}`,
    showTitle,
    ...overrides,
  })
}

// One play a day from the start
function daily(
  prefix: string,
  start: string,
  days: number,
  overrides: Partial<Play> = {},
): Play[] {
  return Array.from({ length: days }, (_, index) =>
    play(`${prefix}-${index}`, Date.parse(start) + index * DAY, overrides),
  )
}

// The period's favourite, as its story's card shows it
function favorite(title: string, year: number | null = null) {
  return { title, year, media_id: null }
}

// 15 hours over 10 days the year before, and 21 hours in the past year
const previousYear = daily('before', '2024-11-10T20:00:00Z', 10, {
  title: 'Alien',
})
const pastYear = daily('now', '2025-11-10T20:00:00Z', 14, { title: 'Dune' })

describe('getPreviousStart', () => {
  it('goes as far back before the start as the period runs after it', () => {
    expect(
      getPreviousStart(Date.parse('2026-01-01'), Date.parse('2026-03-01')),
    ).toBe(Date.parse('2025-11-03'))
    expect(getPreviousStart(SINCE, NOW)).toBe(PREVIOUS_SINCE)
  })

  it('is null before the start', () => {
    expect(getPreviousStart(NOW, NOW)).toBeNull()
    expect(getPreviousStart(NOW + DAY, NOW)).toBeNull()
  })
})

describe('splitPlays', () => {
  it('splits the plays at the start, without those before the earlier period', () => {
    const plays = [
      play('older', PREVIOUS_SINCE - 1),
      play('first', PREVIOUS_SINCE),
      play('last', SINCE - 1),
      play('now', SINCE),
    ]
    const { previous, current } = splitPlays(plays, PREVIOUS_SINCE, SINCE)

    expect(previous.map(({ id }) => id)).toEqual(['first', 'last'])
    expect(current.map(({ id }) => id)).toEqual(['now'])
  })
})

describe('compareYears', () => {
  it('compares the time with the year before', () => {
    expect(
      compareYears([...previousYear, ...pastYear], {
        ...OPTIONS,
        favorites: { movies: favorite('Dune', 2020) },
      }),
    ).toEqual({
      previousSince: PREVIOUS_SINCE,
      previousDuration: 15 * 60 * 60,
      difference: 40,
      shows: null,
      movies: {
        play: expect.objectContaining({ title: 'Alien' }),
        isSame: false,
      },
    })
  })

  it('leaves out the plays from before the earlier period', () => {
    const result = compareYears(
      [play('old', '2023-05-01T20:00:00Z'), ...previousYear, ...pastYear],
      OPTIONS,
    )

    expect(result?.previousDuration).toBe(15 * 60 * 60)
  })

  it('compares a period from a start date with as long a one before it', () => {
    const since = Date.parse('2026-01-01')
    const result = compareYears(
      [
        ...daily('before', '2025-03-01T20:00:00Z', 10),
        ...daily('now', '2026-02-01T20:00:00Z', 5),
      ],
      { ...OPTIONS, since },
    )

    expect(result).toMatchObject({
      previousSince: 2 * since - NOW,
      difference: -50,
    })
  })

  it('needs enough plays that count in the earlier period', () => {
    const plays = [
      ...previousYear.slice(1),
      play('short', '2024-12-01T20:00:00Z', { percentComplete: 10 }),
      ...pastYear,
    ]

    expect(compareYears(plays, OPTIONS)).toBeNull()
  })

  it('needs plays on enough days of the earlier period', () => {
    const plays = [
      ...daily('a', '2024-11-10T18:00:00Z', 4),
      ...daily('b', '2024-11-10T20:00:00Z', 4),
      ...daily('c', '2024-11-10T22:00:00Z', 2),
      ...pastYear,
    ]

    expect(compareYears(plays, OPTIONS)).toBeNull()
  })

  it('needs the user to have been around for the earlier period', () => {
    expect(
      compareYears(
        [...daily('before', '2025-01-15T20:00:00Z', 10), ...pastYear],
        OPTIONS,
      ),
    ).toBeNull()
    // A first play in its first month is close enough to its start
    expect(
      compareYears(
        [...daily('before', '2024-11-25T20:00:00Z', 10), ...pastYear],
        OPTIONS,
      ),
    ).not.toBeNull()
  })

  it('needs a play that counts in the period', () => {
    const shortPlays = daily('now', '2025-11-10T20:00:00Z', 5, {
      percentComplete: 10,
    })

    expect(compareYears(previousYear, OPTIONS)).toBeNull()
    expect(compareYears([...previousYear, ...shortPlays], OPTIONS)).toBeNull()
  })

  it('is null without plays, or before the start', () => {
    expect(compareYears([], OPTIONS)).toBeNull()
    expect(
      compareYears([...previousYear, ...pastYear], {
        ...OPTIONS,
        since: NOW + DAY,
      }),
    ).toBeNull()
  })
})

describe('getFavoriteChange', () => {
  it('names the earlier favourite when it changed', () => {
    const change = getFavoriteChange(
      {
        previous: [
          episode('s1', '2025-01-01', 'Severance'),
          episode('s2', '2025-01-02', 'Severance'),
          episode('f1', '2025-01-03', 'Friends'),
        ],
        current: [
          episode('b1', '2026-01-01', 'The Bear'),
          episode('b2', '2026-01-02', 'The Bear'),
          episode('s3', '2026-01-03', 'Severance'),
        ],
      },
      'episode',
      MIN_PERCENT,
      favorite('The Bear'),
    )

    expect(change).toEqual({
      play: expect.objectContaining({ id: 's3', showTitle: 'Severance' }),
      isSame: false,
    })
  })

  it('tells when the favourite stayed the same, also when it was re-added', () => {
    const change = getFavoriteChange(
      {
        previous: [
          play('dune-0', '2024-12-01', { title: 'Dune', ratingKey: '1' }),
          play('dune-1', '2025-01-01', { title: 'Dune', ratingKey: '1' }),
          play('alien', '2025-01-02', { durationMs: 60 * MINUTE }),
        ],
        current: [
          play('dune-2', '2026-01-01', { title: 'Dune', ratingKey: '2' }),
          play('heat', '2026-01-02', { durationMs: 60 * MINUTE }),
        ],
      },
      'movie',
      MIN_PERCENT,
      favorite('Dune', 2020),
    )

    expect(change).toEqual({
      play: expect.objectContaining({ id: 'dune-2' }),
      isSame: true,
    })
  })

  it('needs a play that counts for the earlier favourite', () => {
    const change = getFavoriteChange(
      {
        previous: [
          play('abandoned', '2025-01-01', {
            durationMs: 200 * MINUTE,
            percentComplete: 40,
          }),
          play('finished', '2025-01-02', { durationMs: 80 * MINUTE }),
          play('finished-2', '2025-01-03', {
            title: 'finished',
            durationMs: 80 * MINUTE,
          }),
        ],
        current: [
          play('abandoned-again', '2026-01-01', { title: 'abandoned' }),
        ],
      },
      'movie',
      MIN_PERCENT,
      favorite('abandoned', 2020),
    )

    expect(change).toEqual({
      play: expect.objectContaining({ id: 'finished-2' }),
      isSame: false,
    })
  })

  it('needs the earlier favourite to have been played again', () => {
    const periods = {
      previous: [
        play('dune', '2025-01-01', { title: 'Dune', durationMs: 150 * MINUTE }),
        play('heat-1', '2025-01-02', {
          title: 'Heat',
          durationMs: 60 * MINUTE,
        }),
        play('heat-2', '2025-01-03', {
          title: 'Heat',
          durationMs: 60 * MINUTE,
        }),
      ],
      current: [
        play('dune-2', '2026-01-01', { title: 'Dune' }),
        play('dune-3', '2026-01-02', { title: 'Dune' }),
      ],
    }

    expect(
      getFavoriteChange(periods, 'movie', MIN_PERCENT, favorite('Dune', 2020)),
    ).toBeNull()
  })

  it('is null without the media type in either period', () => {
    const periods = {
      previous: [episode('s1', '2025-01-01', 'Severance')],
      current: [play('dune', '2026-01-01')],
    }

    expect(
      getFavoriteChange(periods, 'movie', MIN_PERCENT, favorite('dune', 2020)),
    ).toBeNull()
    expect(getFavoriteChange(periods, 'episode', MIN_PERCENT)).toBeNull()
  })

  it("goes by the card's favourite when two titles tie in the period", () => {
    const periods = {
      previous: [
        play('alien-0', '2024-12-01', { title: 'Alien' }),
        play('alien-1', '2025-01-01', { title: 'Alien' }),
      ],
      current: [
        play('heat', '2026-01-01', { title: 'Heat' }),
        play('alien-2', '2026-01-02', { title: 'Alien' }),
      ],
    }

    expect(
      getFavoriteChange(periods, 'movie', MIN_PERCENT, favorite('Heat', 2020))
        ?.isSame,
    ).toBe(false)
    expect(
      getFavoriteChange(periods, 'movie', MIN_PERCENT, favorite('Alien', 2020))
        ?.isSame,
    ).toBe(true)
  })
})

describe('getYearOverYear', () => {
  beforeEach(() => {
    const t = (key: string, params?: { count: number }) =>
      `${params?.count} ${key.split('.').pop()}`

    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.mocked(getSettings).mockReturnValue(cloneDeep(DEFAULT_SETTINGS))
    vi.mocked(getTranslations).mockResolvedValue(
      t as unknown as Awaited<ReturnType<typeof getTranslations>>,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const shows = [
    ...previousYear,
    episode('s1', '2024-12-01T20:00:00Z', 'Severance'),
    episode('s2', '2024-12-02T20:00:00Z', 'Severance'),
    episode('b1', '2025-12-01T20:00:00Z', 'The Bear'),
    ...pastYear,
  ]

  it('compares the past year with the year before', async () => {
    expect(
      await getYearOverYear(shows, 'UTC', {
        shows: favorite('The Bear'),
        movies: favorite('Dune', 2020),
      }),
    ).toEqual({
      since: '2024-11-03',
      until: '2025-11-03',
      isPastYear: true,
      duration: '16 hr',
      difference: 34,
      shows: { title: 'Severance', isSame: false },
      movies: { title: 'Alien', isSame: false },
    })
  })

  it('compares a period from a start date with as long a one before it', async () => {
    const settings = cloneDeep(DEFAULT_SETTINGS)

    settings.rewind.startDate = '2026-01-01'
    vi.mocked(getSettings).mockReturnValue(settings)

    const yearOverYear = await getYearOverYear(
      [
        ...daily('before', '2025-03-01T20:00:00Z', 10),
        ...daily('now', '2026-02-01T20:00:00Z', 10),
      ],
      'UTC',
    )

    expect(yearOverYear).toMatchObject({
      since: '2025-02-27',
      until: '2025-12-31',
      isPastYear: false,
      difference: 0,
    })
  })

  it('compares an excluded user with their own plays', async () => {
    const settings = cloneDeep(DEFAULT_SETTINGS)

    settings.general.excludedUsers = ['1']
    vi.mocked(getSettings).mockReturnValue(settings)

    expect(await getYearOverYear(shows, 'UTC')).not.toBeNull()
  })

  it('waits for the whole history to be read', async () => {
    expect(await getYearOverYear(null, 'UTC')).toBeNull()
  })

  it('is null without enough plays before the period', async () => {
    expect(await getYearOverYear(pastYear, 'UTC')).toBeNull()
  })
})
