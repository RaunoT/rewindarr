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
  getRewindPeriod,
  getRewindPeriodType,
  parseEditionYear,
} from './rewindPeriod'

// Years are in the server's timezone, which the tests run in too
const now = new Date(2026, 2, 10, 12)

function rewindSettings(
  period: RewindPeriodType,
  startDate = '',
): Pick<Settings, 'rewind'> {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.period = period
  settings.rewind.startDate = startDate

  return settings
}

describe('getRewindPeriodType', () => {
  it('treats a custom period without a start date as the past year', () => {
    expect(getRewindPeriodType(rewindSettings('custom'))).toBe('pastYear')
    expect(getRewindPeriodType(rewindSettings('custom', '2025-06-01'))).toBe(
      'custom',
    )
  })

  it('treats an unknown period, such as a hand-edited one, as the past year', () => {
    const settings = rewindSettings('pastYear')

    settings.rewind.period = 'weekly' as unknown as RewindPeriodType

    expect(getRewindPeriodType(settings)).toBe('pastYear')
  })
})

describe('getLatestEditionYear', () => {
  it("is last year's until December", () => {
    expect(getLatestEditionYear(new Date(2026, 0, 1))).toBe(2025)
    expect(getLatestEditionYear(new Date(2026, 10, 30, 23, 59))).toBe(2025)
  })

  it("is this year's from 1 December", () => {
    expect(getLatestEditionYear(new Date(2026, 11, 1))).toBe(2026)
    expect(getLatestEditionYear(new Date(2026, 11, 31, 23, 59))).toBe(2026)
  })
})

describe('getNewEditionYear', () => {
  const settings = rewindSettings('calendarYear')

  it('has the new edition from 1 December to the end of January', () => {
    expect(getNewEditionYear(settings, new Date(2026, 11, 1))).toBe(2026)
    expect(getNewEditionYear(settings, new Date(2027, 0, 31, 23))).toBe(2026)
  })

  it('has none for the rest of the year', () => {
    expect(getNewEditionYear(settings, new Date(2026, 1, 1))).toBeNull()
    expect(getNewEditionYear(settings, new Date(2026, 10, 30))).toBeNull()
  })

  it('has none without calendar-year editions', () => {
    expect(
      getNewEditionYear(rewindSettings('pastYear'), new Date(2026, 11, 1)),
    ).toBeNull()
  })
})

describe('getEditionPeriod', () => {
  it('runs from 1 January up to the next one', () => {
    expect(getEditionPeriod(2025)).toEqual({
      start: new Date(2025, 0, 1).toISOString(),
      end: new Date(2026, 0, 1).toISOString(),
      year: 2025,
    })
  })
})

describe('getRewindPeriod', () => {
  it('runs from a year before now to now by default', () => {
    expect(getRewindPeriod(rewindSettings('pastYear'), undefined, now)).toEqual(
      { start: '2025-03-10', year: null },
    )
  })

  it('runs from the custom start date to now', () => {
    expect(
      getRewindPeriod(rewindSettings('custom', '2025-06-01'), undefined, now),
    ).toEqual({ start: '2025-06-01', year: null })
  })

  it('shows the latest edition by default', () => {
    expect(
      getRewindPeriod(rewindSettings('calendarYear'), undefined, now),
    ).toEqual(getEditionPeriod(2025))
  })

  it('shows the edition asked for', () => {
    expect(getRewindPeriod(rewindSettings('calendarYear'), 2023, now)).toEqual(
      getEditionPeriod(2023),
    )
  })

  it('has no editions for the other periods', () => {
    expect(getRewindPeriod(rewindSettings('pastYear'), 2023, now).year).toBe(
      null,
    )
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
    expect(getFirstReadYear(new Date(2023, 4, 10).getTime())).toBe(2024)
    // The plays from midnight on are read, but not the ones before it
    expect(getFirstReadYear(new Date(2023, 0, 1).getTime())).toBe(2024)
  })

  it('has no year before any play was read', () => {
    expect(getFirstReadYear(Infinity)).toBeNull()
  })
})

describe('getEditionYearsByUser', () => {
  it('lists the years each user played in, newest first', () => {
    const plays = [
      { userId: '1', startedAt: new Date(2024, 5, 1).getTime() },
      { userId: '2', startedAt: new Date(2023, 0, 1).getTime() },
      { userId: '1', startedAt: new Date(2022, 11, 31, 23).getTime() },
      { userId: '1', startedAt: new Date(2024, 0, 1).getTime() },
    ]

    expect(getEditionYearsByUser(plays)).toEqual({
      1: [2024, 2022],
      2: [2023],
    })
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
