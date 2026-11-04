import { HistoryPlay } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { describe, expect, it, vi } from 'vitest'
import {
  getBiggestBinge,
  getBiggestDay,
  getLongestStreak,
  getMonthlyDurations,
  getRewindMoments,
} from './rewindMoments'

const HOUR = 60 * 60 * 1000
const MIN_PERCENT = 50

function play(
  startedAt: string,
  overrides: Partial<HistoryPlay> = {},
): HistoryPlay {
  return {
    id: startedAt,
    startedAt: Date.parse(startedAt),
    mediaType: 'movie',
    durationMs: HOUR,
    percentComplete: 100,
    title: 'Dune',
    showTitle: null,
    artistName: null,
    grandparentRatingKey: null,
    identityId: 'alice',
    userId: '1',
    userName: 'Alice',
    ...overrides,
  } as HistoryPlay
}

function episode(startedAt: string, overrides: Partial<HistoryPlay> = {}) {
  return play(startedAt, {
    mediaType: 'episode',
    title: 'Episode',
    showTitle: 'Severance',
    grandparentRatingKey: '7',
    ...overrides,
  })
}

const theBear = { showTitle: 'The Bear', grandparentRatingKey: '8' }

describe('getMonthlyDurations', () => {
  it('adds up the time in each month of the period, the empty ones too', () => {
    const plays = [
      play('2026-01-10T20:00:00Z'),
      play('2026-01-20T20:00:00Z', { durationMs: 2 * HOUR }),
      play('2026-03-05T20:00:00Z', { durationMs: HOUR / 2 }),
      play('2026-04-01T20:00:00Z'),
    ]

    expect(
      getMonthlyDurations(
        plays,
        '2026-01-01',
        Date.parse('2026-04-15T12:00:00Z'),
        'UTC',
      ),
    ).toEqual({
      months: [
        { month: '2026-01', duration: 3 * 3600 },
        { month: '2026-02', duration: 0 },
        { month: '2026-03', duration: 1800 },
        { month: '2026-04', duration: 3600 },
      ],
      peakIndex: 0,
    })
  })

  it('runs from the start date to the end of the period', () => {
    const result = getMonthlyDurations(
      [
        play('2025-12-10T20:00:00Z'),
        play('2026-03-10T20:00:00Z'),
        play('2026-06-10T20:00:00Z'),
      ],
      '2025-11-04',
      Date.parse('2026-11-04T12:00:00Z'),
      'UTC',
    )

    expect(result?.months).toHaveLength(13)
    expect(result?.months[0].month).toBe('2025-11')
    expect(result?.months.at(-1)?.month).toBe('2026-11')
  })

  it('picks the first month of a tie as the peak', () => {
    const result = getMonthlyDurations(
      [
        play('2026-01-10T20:00:00Z'),
        play('2026-02-10T20:00:00Z', { durationMs: 2 * HOUR }),
        play('2026-03-10T20:00:00Z', { durationMs: 2 * HOUR }),
      ],
      '2026-01-01',
      Date.parse('2026-03-31T12:00:00Z'),
      'UTC',
    )

    expect(result?.peakIndex).toBe(1)
  })

  it('puts a play in the month of the time zone', () => {
    const plays = [
      play('2026-01-31T23:30:00Z'),
      play('2026-03-10T12:00:00Z'),
      play('2026-04-10T12:00:00Z'),
    ]
    const until = Date.parse('2026-04-30T00:00:00Z')

    expect(
      getMonthlyDurations(plays, '2026-01-01', until, 'UTC')?.months[0],
    ).toEqual({ month: '2026-01', duration: 3600 })
    // A day ahead of UTC, it's already February
    expect(
      getMonthlyDurations(plays, '2026-01-01', until, 'Pacific/Auckland')
        ?.months[1],
    ).toEqual({ month: '2026-02', duration: 3600 })
  })

  it('gives a month to a play before the start in a time zone behind UTC', () => {
    const result = getMonthlyDurations(
      [
        play('2026-01-01T02:00:00Z'),
        play('2026-02-10T20:00:00Z'),
        play('2026-03-10T20:00:00Z'),
      ],
      '2026-01-01',
      Date.parse('2026-03-31T20:00:00Z'),
      'America/New_York',
    )

    expect(result?.months[0]).toEqual({ month: '2025-12', duration: 3600 })
  })

  it('leaves out a chart with too few months with plays', () => {
    expect(
      getMonthlyDurations(
        [play('2026-01-10T20:00:00Z'), play('2026-03-10T20:00:00Z')],
        '2026-01-01',
        Date.parse('2026-12-31T20:00:00Z'),
        'UTC',
      ),
    ).toBeNull()
  })
})

describe('getBiggestBinge', () => {
  it('finds the most episodes of a show played one after another in a day', () => {
    const plays = [
      episode('2026-03-14T18:00:00Z'),
      episode('2026-03-14T19:00:00Z'),
      episode('2026-03-14T20:00:00Z'),
      episode('2026-03-21T18:00:00Z'),
      episode('2026-03-21T19:00:00Z'),
      ...['18', '19', '20', '21'].map((hour) =>
        episode(`2026-03-20T${hour}:00:00Z`, theBear),
      ),
    ]

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')).toMatchObject({
      date: '2026-03-20',
      title: 'The Bear',
      episodes: 4,
      duration: 4 * 3600,
      // The newest
      play: { id: '2026-03-20T21:00:00Z' },
    })
  })

  it('ends a binge at another play between its episodes, or at midnight', () => {
    const plays = [
      episode('2026-03-14T18:00:00Z'),
      episode('2026-03-14T19:00:00Z'),
      play('2026-03-14T20:00:00Z'),
      episode('2026-03-14T21:00:00Z'),
      episode('2026-03-14T22:00:00Z'),
      episode('2026-03-15T00:00:00Z'),
      episode('2026-03-15T01:00:00Z'),
    ]

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')).toBeNull()
  })

  it('counts only the episodes that count, but all of their time', () => {
    const plays = [
      episode('2026-03-14T18:00:00Z'),
      episode('2026-03-14T19:00:00Z', {
        percentComplete: 10,
        durationMs: 5 * 60 * 1000,
      }),
      episode('2026-03-14T20:00:00Z'),
      episode('2026-03-14T21:00:00Z'),
    ]

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')).toMatchObject({
      episodes: 3,
      duration: 3 * 3600 + 300,
    })
    expect(getBiggestBinge(plays.slice(0, 3), MIN_PERCENT, 'UTC')).toBeNull()
  })

  it('picks the longer binge of a tie in episodes, then the earliest', () => {
    const binge = (day: string, overrides: Partial<HistoryPlay> = {}) =>
      ['18', '19', '20'].map((hour) =>
        episode(`2026-03-${day}T${hour}:00:00Z`, overrides),
      )

    expect(
      getBiggestBinge(
        [...binge('05'), ...binge('01'), ...binge('03', theBear)],
        MIN_PERCENT,
        'UTC',
      )?.date,
    ).toBe('2026-03-01')
    expect(
      getBiggestBinge(
        [...binge('01'), ...binge('05', { durationMs: 2 * HOUR })],
        MIN_PERCENT,
        'UTC',
      )?.date,
    ).toBe('2026-03-05')
  })

  it('picks the earlier of two tied binges on the same day', () => {
    const plays = [
      ...['08', '09', '10'].map((hour) =>
        episode(`2026-03-01T${hour}:00:00Z`, theBear),
      ),
      ...['18', '19', '20'].map((hour) => episode(`2026-03-01T${hour}:00:00Z`)),
    ]

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')?.title).toBe('The Bear')
  })

  it('leaves out music', () => {
    const plays = ['18', '19', '20', '21'].map((hour) =>
      play(`2026-03-14T${hour}:00:00Z`, {
        mediaType: 'track',
        artistName: 'Radiohead',
        grandparentRatingKey: '9',
      }),
    )

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')).toBeNull()
  })

  it('keeps to the day of the time zone', () => {
    const plays = [
      episode('2026-03-14T22:30:00Z'),
      episode('2026-03-14T23:15:00Z'),
      episode('2026-03-15T00:00:00Z'),
    ]

    expect(getBiggestBinge(plays, MIN_PERCENT, 'UTC')).toBeNull()
    expect(getBiggestBinge(plays, MIN_PERCENT, 'Europe/Tallinn')).toMatchObject(
      { date: '2026-03-15', episodes: 3 },
    )
  })
})

describe('getBiggestDay', () => {
  it('finds the day with the most time and what it went to', () => {
    const plays = [
      play('2026-03-01T20:00:00Z'),
      play('2026-03-02T20:00:00Z'),
      play('2026-03-14T10:00:00Z', { durationMs: 2.5 * HOUR }),
      episode('2026-03-14T13:00:00Z'),
      episode('2026-03-14T14:00:00Z'),
      play('2026-03-14T16:00:00Z', {
        mediaType: 'track',
        title: 'Reckoner',
        artistName: 'Radiohead',
        durationMs: HOUR / 2,
      }),
    ]

    expect(getBiggestDay(plays, 'UTC')).toEqual({
      date: '2026-03-14',
      duration: 5 * 3600,
      // With the newest play of each, for its poster
      titles: [
        { title: 'Dune', mediaType: 'movie', play: plays[2] },
        { title: 'Severance', mediaType: 'episode', play: plays[4] },
        { title: 'Radiohead', mediaType: 'track', play: plays[5] },
      ],
      moreTitles: 0,
    })
  })

  it('keeps apart a movie and a show of the same name', () => {
    const plays = [
      play('2026-03-01T20:00:00Z'),
      play('2026-03-02T20:00:00Z'),
      play('2026-03-14T10:00:00Z', { title: 'Fargo', durationMs: 2 * HOUR }),
      episode('2026-03-14T13:00:00Z', { showTitle: 'Fargo' }),
    ]

    expect(getBiggestDay(plays, 'UTC')?.titles).toMatchObject([
      { title: 'Fargo', mediaType: 'movie' },
      { title: 'Fargo', mediaType: 'episode' },
    ])
  })

  it('counts the titles past the first three', () => {
    const artists = ['A', 'B', 'C', 'D', 'E'].map((artistName, i) =>
      play(`2026-03-14T1${i}:00:00Z`, {
        mediaType: 'track',
        artistName,
        durationMs: (5 - i) * 60 * 1000,
      }),
    )

    expect(
      getBiggestDay(
        [
          ...artists,
          play('2026-03-01T20:00:00Z', { durationMs: 1000 }),
          play('2026-03-02T20:00:00Z', { durationMs: 1000 }),
        ],
        'UTC',
      ),
    ).toMatchObject({
      titles: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      moreTitles: 2,
    })
  })

  it('picks the earliest day of a tie', () => {
    const plays = [
      play('2026-03-02T20:00:00Z', { durationMs: 2 * HOUR }),
      play('2026-03-01T20:00:00Z', { durationMs: 2 * HOUR }),
      play('2026-03-03T20:00:00Z'),
    ]

    expect(getBiggestDay(plays, 'UTC')?.date).toBe('2026-03-01')
  })

  it('needs plays on a few days', () => {
    expect(
      getBiggestDay(
        [play('2026-03-01T20:00:00Z'), play('2026-03-02T20:00:00Z')],
        'UTC',
      ),
    ).toBeNull()
  })
})

describe('getLongestStreak', () => {
  const days = (...dates: string[]) =>
    dates.map((date) => play(`${date}T20:00:00Z`))

  it('finds the most days in a row with a play that counts', () => {
    const plays = days(
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-20',
    )

    expect(getLongestStreak(plays, MIN_PERCENT, 'UTC')).toEqual({
      start: '2026-03-10',
      end: '2026-03-14',
      days: 5,
    })
  })

  it("ends a streak at a day with only plays that don't count", () => {
    const plays = [
      ...days('2026-03-01', '2026-03-02', '2026-03-04'),
      play('2026-03-03T20:00:00Z', { percentComplete: 10 }),
    ]

    expect(getLongestStreak(plays, MIN_PERCENT, 'UTC')).toBeNull()
  })

  it('runs on into the next month', () => {
    expect(
      getLongestStreak(
        days('2026-02-27', '2026-02-28', '2026-03-01'),
        MIN_PERCENT,
        'UTC',
      ),
    ).toEqual({ start: '2026-02-27', end: '2026-03-01', days: 3 })
  })

  it('picks the earliest streak of a tie', () => {
    const plays = days(
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    )

    expect(getLongestStreak(plays, MIN_PERCENT, 'UTC')?.start).toBe(
      '2026-03-01',
    )
  })
})

describe('getRewindMoments', () => {
  const binge = ['18', '19', '20'].map((hour) =>
    episode(`2026-03-14T${hour}:00:00Z`),
  )
  const options = {
    since: '2026-01-01',
    until: Date.parse('2026-04-01T00:00:00Z'),
    minPlayPercent: MIN_PERCENT,
    timeZone: 'UTC',
  }

  it("looks up the binged show's card", async () => {
    const item = { title: 'Severance' } as TautulliItemRow
    const getPlayItem = vi.fn().mockResolvedValue(item)
    const moments = await getRewindMoments(binge, { ...options, getPlayItem })

    expect(moments.binge).toEqual({
      date: '2026-03-14',
      title: 'Severance',
      episodes: 3,
      duration: 3 * 3600,
      item,
    })
    expect(getPlayItem).toHaveBeenCalledWith(binge[2])
  })

  it('shows the binge without its card when the lookup fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const moments = await getRewindMoments(binge, {
      ...options,
      getPlayItem: vi.fn().mockRejectedValue(new Error('Down')),
    })

    expect(moments.binge?.item).toBeNull()
    error.mockRestore()
  })

  it("looks up the biggest day's posters, leaving out any that fail", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const item = { title: 'Arrival' } as TautulliItemRow
    const moments = await getRewindMoments(
      [
        play('2026-03-01T20:00:00Z'),
        play('2026-03-02T20:00:00Z'),
        play('2026-03-14T10:00:00Z', {
          title: 'Arrival',
          durationMs: 3 * HOUR,
        }),
        episode('2026-03-14T14:00:00Z'),
      ],
      {
        ...options,
        getPlayItem: vi.fn(async (play) => {
          if (play.mediaType === 'episode') {
            throw new Error('Down')
          }

          return item
        }),
      },
    )

    expect(moments.biggestDay?.titles).toEqual([
      { title: 'Arrival', mediaType: 'movie', item },
      { title: 'Severance', mediaType: 'episode', item: null },
    ])
    error.mockRestore()
  })

  it('leaves out every moment without plays', async () => {
    await expect(
      getRewindMoments([], { ...options, getPlayItem: vi.fn() }),
    ).resolves.toEqual({
      monthly: null,
      binge: null,
      biggestDay: null,
      streak: null,
    })
  })
})
