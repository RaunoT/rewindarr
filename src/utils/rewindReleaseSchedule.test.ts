import { DEFAULT_SETTINGS } from '@/utils/constants'
import { describe, expect, it } from 'vitest'
import {
  getDueReleaseYear,
  getNextReleaseEmailTime,
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
