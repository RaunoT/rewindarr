import { RewindPeriodType, Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import {
  getEditionOptions,
  getEditionPeriod,
  getEditionYearsByUser,
  getFirstReadYear,
  getLatestEditionYear,
  getNewEditionYear,
  getPreviousEdition,
  getRewindPeriod,
  getRewindPeriodType,
  isEditionOngoing,
  isReleaseDate,
  parseEditionYear,
} from './rewindPeriod'

const TALLINN = 'Europe/Tallinn'
const now = new Date('2026-03-10T12:00:00Z')

function rewindSettings(
  period: RewindPeriodType,
  {
    startDate = '',
    releaseDate = '12-01',
    year,
  }: { startDate?: string; releaseDate?: string; year?: number } = {},
): Pick<Settings, 'rewind'> {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.period = period
  settings.rewind.startDate = startDate
  settings.rewind.releaseDate = releaseDate
  settings.rewind.year = year

  return settings
}

describe('getRewindPeriodType', () => {
  it('has calendar years by default', () => {
    expect(getRewindPeriodType(DEFAULT_SETTINGS)).toBe('calendarYear')
  })

  it('treats a period without its date or year as the default', () => {
    expect(getRewindPeriodType(rewindSettings('custom'))).toBe('calendarYear')
    expect(
      getRewindPeriodType(
        rewindSettings('custom', { startDate: '2025-06-01' }),
      ),
    ).toBe('custom')
    expect(getRewindPeriodType(rewindSettings('specificYear'))).toBe(
      'calendarYear',
    )
    expect(
      getRewindPeriodType(rewindSettings('specificYear', { year: 2024 })),
    ).toBe('specificYear')
  })

  it('treats an unknown period, such as a hand-edited one, as the default', () => {
    const settings = rewindSettings('pastYear')

    settings.rewind.period = 'weekly' as unknown as RewindPeriodType

    expect(getRewindPeriodType(settings)).toBe('calendarYear')
  })
})

describe('isReleaseDate', () => {
  it('takes a day every year has', () => {
    expect(isReleaseDate('12-01')).toBe(true)
    expect(isReleaseDate('01-31')).toBe(true)
    expect(isReleaseDate('02-28')).toBe(true)
  })

  it('refuses anything else', () => {
    for (const value of ['02-29', '04-31', '13-01', '00-10', '12-00', '1-1']) {
      expect(isReleaseDate(value)).toBe(false)
    }
  })
})

describe('getLatestEditionYear', () => {
  const settings = rewindSettings('calendarYear')

  it("is last year's until the release date", () => {
    expect(
      getLatestEditionYear(settings, 'UTC', new Date('2026-01-01T00:00Z')),
    ).toBe(2025)
    expect(
      getLatestEditionYear(settings, 'UTC', new Date('2026-11-30T23:59Z')),
    ).toBe(2025)
  })

  it("is this year's from the release date", () => {
    expect(
      getLatestEditionYear(settings, 'UTC', new Date('2026-12-01T00:00Z')),
    ).toBe(2026)
    expect(
      getLatestEditionYear(settings, 'UTC', new Date('2026-12-31T23:59Z')),
    ).toBe(2026)
  })

  it("goes by the viewer's date", () => {
    // Already 1 December in Tallinn
    const time = new Date('2026-11-30T22:30Z')

    expect(getLatestEditionYear(settings, 'UTC', time)).toBe(2025)
    expect(getLatestEditionYear(settings, TALLINN, time)).toBe(2026)
  })

  it('comes out in the year after with a release date in January', () => {
    const january = rewindSettings('calendarYear', { releaseDate: '01-01' })

    expect(
      getLatestEditionYear(january, 'UTC', new Date('2026-12-31T23:59Z')),
    ).toBe(2025)
    expect(
      getLatestEditionYear(january, 'UTC', new Date('2027-01-01T00:00Z')),
    ).toBe(2026)
  })

  it('comes out in the year after with a release date before July', () => {
    const march = rewindSettings('calendarYear', { releaseDate: '03-15' })

    expect(
      getLatestEditionYear(march, 'UTC', new Date('2027-03-14T12:00Z')),
    ).toBe(2025)
    expect(
      getLatestEditionYear(march, 'UTC', new Date('2027-03-15T00:00Z')),
    ).toBe(2026)
  })

  it('falls back to 1 December for a release date that is no date', () => {
    const broken = rewindSettings('calendarYear', { releaseDate: 'soon' })

    expect(
      getLatestEditionYear(broken, 'UTC', new Date('2026-12-01T00:00Z')),
    ).toBe(2026)
  })
})

describe('getNewEditionYear', () => {
  const settings = rewindSettings('calendarYear', { releaseDate: '12-15' })

  it('has the new edition from its release to the end of January', () => {
    expect(
      getNewEditionYear(settings, 'UTC', new Date('2026-12-15T00:00Z')),
    ).toBe(2026)
    expect(
      getNewEditionYear(settings, 'UTC', new Date('2027-01-31T23:00Z')),
    ).toBe(2026)
  })

  it('has none for the rest of the year', () => {
    expect(
      getNewEditionYear(settings, 'UTC', new Date('2026-12-14T00:00Z')),
    ).toBeNull()
    expect(
      getNewEditionYear(settings, 'UTC', new Date('2027-02-01T00:00Z')),
    ).toBeNull()
  })

  it('has none without calendar-year editions', () => {
    expect(
      getNewEditionYear(
        rewindSettings('pastYear'),
        'UTC',
        new Date('2026-12-15T00:00Z'),
      ),
    ).toBeNull()
  })
})

describe('getEditionPeriod', () => {
  it("runs from midnight on 1 January up to the next one, in the viewer's timezone", () => {
    expect(getEditionPeriod(2025, 'UTC')).toEqual({
      since: '2025-01-01T00:00:00.000Z',
      until: '2026-01-01T00:00:00.000Z',
      year: 2025,
    })
    expect(getEditionPeriod(2025, TALLINN)).toEqual({
      since: '2024-12-31T22:00:00.000Z',
      until: '2025-12-31T22:00:00.000Z',
      year: 2025,
    })
  })
})

describe('getRewindPeriod', () => {
  it('runs from a year before now to now by default', () => {
    expect(getRewindPeriod(rewindSettings('pastYear'), { now })).toEqual({
      since: '2025-03-10',
      year: null,
    })
  })

  it('runs from the custom start date to now', () => {
    expect(
      getRewindPeriod(rewindSettings('custom', { startDate: '2025-06-01' }), {
        now,
      }),
    ).toEqual({ since: '2025-06-01', year: null })
  })

  it('shows the latest edition by default', () => {
    expect(
      getRewindPeriod(rewindSettings('calendarYear'), {
        timeZone: 'UTC',
        now,
      }),
    ).toEqual(getEditionPeriod(2025, 'UTC'))
  })

  it('shows the edition asked for', () => {
    expect(
      getRewindPeriod(rewindSettings('calendarYear'), {
        year: 2023,
        timeZone: 'UTC',
        now,
      }),
    ).toEqual(getEditionPeriod(2023, 'UTC'))
  })

  it('always shows a specific year', () => {
    expect(
      getRewindPeriod(rewindSettings('specificYear', { year: 2023 }), {
        year: 2024,
        timeZone: 'UTC',
        now,
      }),
    ).toEqual(getEditionPeriod(2023, 'UTC'))
  })

  it('has no editions for the other periods', () => {
    expect(
      getRewindPeriod(rewindSettings('pastYear'), { year: 2023, now }).year,
    ).toBeNull()
  })
})

describe('getPreviousEdition', () => {
  it('is the whole year before an edition that is over', () => {
    expect(
      getPreviousEdition(
        getEditionPeriod(2025, 'UTC'),
        'UTC',
        Date.parse('2026-03-10T12:00Z'),
      ),
    ).toEqual({
      since: Date.parse('2024-01-01T00:00Z'),
      until: Date.parse('2025-01-01T00:00Z'),
    })
  })

  it('stops at the same moment a year earlier while the edition is going', () => {
    const period = getEditionPeriod(2026, 'UTC')
    const time = Date.parse('2026-12-10T18:00Z')

    expect(isEditionOngoing(period, time)).toBe(true)
    expect(getPreviousEdition(period, 'UTC', time)).toEqual({
      since: Date.parse('2025-01-01T00:00Z'),
      until: Date.parse('2025-12-10T18:00Z'),
    })
  })
})

describe('parseEditionYear', () => {
  it('takes the year of an edition that is out', () => {
    expect(parseEditionYear('2023', 2025)).toBe(2023)
    expect(parseEditionYear('2025', 2025)).toBe(2025)
  })

  it('ignores an edition still to come', () => {
    expect(parseEditionYear('2026', 2025)).toBeUndefined()
  })

  it('ignores anything but a year', () => {
    for (const value of [null, undefined, '', 'last', '25', '2025.0', '0099']) {
      expect(parseEditionYear(value, 2025)).toBeUndefined()
    }
  })
})

describe('getFirstReadYear', () => {
  it('goes back to the first play once the history is read', () => {
    expect(getFirstReadYear(-Infinity)).toBe(1970)
  })

  it('is the first year the read has gone back past the start of', () => {
    expect(getFirstReadYear(Date.parse('2023-05-10T12:00Z'), 'UTC')).toBe(2024)
    // The plays from midnight on are read, but not the ones before it
    expect(getFirstReadYear(Date.parse('2023-01-01T00:00Z'), 'UTC')).toBe(2024)
    // Still 2022 in New York
    expect(
      getFirstReadYear(Date.parse('2023-01-01T02:00Z'), 'America/New_York'),
    ).toBe(2023)
  })

  it('has no year before any play was read', () => {
    expect(getFirstReadYear(Infinity)).toBeNull()
  })
})

describe('getEditionYearsByUser', () => {
  it('lists the years each user played in, newest first', () => {
    const plays = [
      { userId: '1', startedAt: Date.parse('2024-06-01T12:00Z') },
      { userId: '2', startedAt: Date.parse('2023-01-01T12:00Z') },
      { userId: '1', startedAt: Date.parse('2022-12-31T23:00Z') },
      { userId: '1', startedAt: Date.parse('2024-01-01T12:00Z') },
    ]

    expect(getEditionYearsByUser(plays, 'UTC')).toEqual({
      1: [2024, 2022],
      2: [2023],
    })
    // New Year's Eve in UTC is already 2023 in Tallinn
    expect(getEditionYearsByUser(plays, TALLINN)[1]).toEqual([2024, 2023])
  })

  it('leaves out plays nobody can be matched to', () => {
    expect(getEditionYearsByUser([{ userId: '', startedAt: 0 }])).toEqual({})
  })
})

describe('getEditionOptions', () => {
  it('offers the latest edition and the ones played in, newest first', () => {
    expect(getEditionOptions([2022, 2023], 2025)).toEqual([2025, 2023, 2022])
  })

  it('offers the edition on screen, even without plays', () => {
    expect(getEditionOptions([2022], 2025, 2024)).toEqual([2025, 2024, 2022])
    expect(getEditionOptions([], 2025, 2025)).toEqual([2025])
  })
})
