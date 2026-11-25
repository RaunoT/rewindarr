import { DEFAULT_SETTINGS } from '@/utils/constants'
import { describe, expect, it } from 'vitest'
import {
  getDueReleaseYear,
  getNextReleaseEmailTime,
  isReleaseEmailOn,
  RELEASE_EMAIL_HOUR,
} from './rewindReleaseSchedule'

const SETTINGS = {
  rewind: {
    ...DEFAULT_SETTINGS.rewind,
    period: 'calendarYear' as const,
    releaseDate: '12-01',
  },
}

describe('getDueReleaseYear', () => {
  it('is due from the hour of the release day', () => {
    expect(
      getDueReleaseYear(
        SETTINGS,
        2025,
        new Date(2026, 11, 1, RELEASE_EMAIL_HOUR - 1),
      ),
    ).toBeNull()
    expect(
      getDueReleaseYear(
        SETTINGS,
        2025,
        new Date(2026, 11, 1, RELEASE_EMAIL_HOUR),
      ),
    ).toBe(2026)
  })

  it("isn't due once that edition was handled", () => {
    expect(getDueReleaseYear(SETTINGS, 2026, new Date(2026, 11, 5))).toBeNull()
  })

  it("isn't sent months late, after the edition stops being new", () => {
    expect(getDueReleaseYear(SETTINGS, 2025, new Date(2027, 0, 31))).toBe(2026)
    expect(getDueReleaseYear(SETTINGS, 2025, new Date(2027, 1, 1))).toBeNull()
  })

  it('is due for a release date after January', () => {
    const march = { rewind: { ...SETTINGS.rewind, releaseDate: '03-01' } }

    // The 2026 edition comes out on 1 March 2027
    expect(
      getDueReleaseYear(march, 2025, new Date(2027, 2, 1, RELEASE_EMAIL_HOUR)),
    ).toBe(2026)
  })

  it('is only for yearly editions, which have a release day', () => {
    expect(
      getDueReleaseYear(
        { rewind: { ...SETTINGS.rewind, period: 'pastYear' } },
        null,
        new Date(2026, 11, 5),
      ),
    ).toBeNull()
  })
})

describe('getNextReleaseEmailTime', () => {
  it('is the next release day once this one was handled', () => {
    expect(
      getNextReleaseEmailTime(SETTINGS, 2026, new Date(2026, 11, 5)),
    ).toEqual(new Date(2027, 11, 1, RELEASE_EMAIL_HOUR))
  })

  it("is this year's before the release", () => {
    expect(
      getNextReleaseEmailTime(SETTINGS, 2025, new Date(2026, 9, 1)),
    ).toEqual(new Date(2026, 11, 1, RELEASE_EMAIL_HOUR))
  })
})

describe('isReleaseEmailOn', () => {
  const on = {
    rewind: { ...SETTINGS.rewind, isActive: true, isReleaseEmailActive: true },
  }

  it('needs Rewind on, open to users and by the calendar year', () => {
    expect(isReleaseEmailOn(on)).toBe(true)
    expect(
      isReleaseEmailOn({ rewind: { ...on.rewind, isActive: false } }),
    ).toBe(false)
    expect(
      isReleaseEmailOn({ rewind: { ...on.rewind, isAdminOnly: true } }),
    ).toBe(false)
    expect(
      isReleaseEmailOn({ rewind: { ...on.rewind, period: 'pastYear' } }),
    ).toBe(false)
    expect(
      isReleaseEmailOn({
        rewind: { ...on.rewind, isReleaseEmailActive: false },
      }),
    ).toBe(false)
  })
})
