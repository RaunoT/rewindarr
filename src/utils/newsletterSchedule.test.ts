import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getDueSendTime,
  getLatestSendTime,
  getNewsletterPeriod,
  getNextSendTime,
  isSameSchedule,
  NewsletterSchedule,
} from './newsletterSchedule'

const WEEKLY: NewsletterSchedule = {
  isNewsletterActive: true,
  newsletterFrequency: 'weekly',
  // Monday
  newsletterWeekday: 1,
  newsletterMonthDay: 1,
  newsletterHour: 9,
}
const MONTHLY: NewsletterSchedule = {
  ...WEEKLY,
  newsletterFrequency: 'monthly',
}
const QUARTERLY: NewsletterSchedule = {
  ...WEEKLY,
  newsletterFrequency: 'quarterly',
}

// Local times, as the schedule is in the server's time zone. 23 November 2026
// is a Monday.
function local(day: number, hour = 0, month = 10, minute = 0) {
  return new Date(2026, month, day, hour, minute)
}

describe('getLatestSendTime', () => {
  it('is the same day once the hour has come', () => {
    expect(getLatestSendTime(WEEKLY, local(23, 9))).toEqual(local(23, 9))
    expect(getLatestSendTime(WEEKLY, local(23, 15))).toEqual(local(23, 9))
  })

  it('is the week before until the hour comes', () => {
    expect(getLatestSendTime(WEEKLY, local(23, 8, 10, 59))).toEqual(
      local(16, 9),
    )
  })

  it('goes back to the weekday', () => {
    // Thursday
    expect(getLatestSendTime(WEEKLY, local(26, 12))).toEqual(local(23, 9))
    // Sunday
    expect(getLatestSendTime(WEEKLY, local(29, 23))).toEqual(local(23, 9))
  })

  it('is the 1st of the month for a monthly one', () => {
    expect(getLatestSendTime(MONTHLY, local(23, 12))).toEqual(local(1, 9))
    expect(getLatestSendTime(MONTHLY, local(1, 8))).toEqual(local(1, 9, 9))
  })

  it('goes back across a year', () => {
    expect(getLatestSendTime(MONTHLY, new Date(2026, 0, 1, 3))).toEqual(
      new Date(2025, 11, 1, 9),
    )
  })

  it('is the 1st of the quarter for a quarterly one', () => {
    // 1 October, as November is in the quarter it starts
    expect(getLatestSendTime(QUARTERLY, local(23, 12))).toEqual(local(1, 9, 9))
    expect(getLatestSendTime(QUARTERLY, local(1, 8, 9))).toEqual(local(1, 9, 6))
    expect(getLatestSendTime(QUARTERLY, new Date(2026, 1, 3))).toEqual(
      new Date(2026, 0, 1, 9),
    )
    expect(getLatestSendTime(QUARTERLY, new Date(2026, 0, 1, 3))).toEqual(
      new Date(2025, 9, 1, 9),
    )
  })
})

describe('getNextSendTime', () => {
  it('is a week after the latest', () => {
    expect(getNextSendTime(WEEKLY, local(23, 12))).toEqual(local(30, 9))
    expect(getNextSendTime(WEEKLY, local(23, 8))).toEqual(local(23, 9))
  })

  it('is the next 1st for a monthly one', () => {
    expect(getNextSendTime(MONTHLY, local(23, 12))).toEqual(local(1, 9, 11))
  })

  it('goes out on the day of the month picked', () => {
    const tenth = { ...MONTHLY, newsletterMonthDay: 10 }

    expect(getLatestSendTime(tenth, local(5, 12))).toEqual(local(10, 9, 9))
    expect(getNextSendTime(tenth, local(5, 12))).toEqual(local(10, 9))
    expect(getNextSendTime(tenth, local(10, 12))).toEqual(local(10, 9, 11))
  })

  it('is the next quarter for a quarterly one', () => {
    expect(getNextSendTime(QUARTERLY, local(23, 12))).toEqual(
      new Date(2027, 0, 1, 9),
    )
  })
})

describe('getNewsletterPeriod', () => {
  it('covers the 7 days before a weekly one', () => {
    expect(getNewsletterPeriod(WEEKLY, local(23, 9))).toEqual({
      since: local(16).toISOString(),
      until: local(23).toISOString(),
    })
  })

  it('covers the month before a monthly one', () => {
    expect(getNewsletterPeriod(MONTHLY, local(1, 9))).toEqual({
      since: local(1, 0, 9).toISOString(),
      until: local(1).toISOString(),
    })
  })

  it('covers the calendar month before, whichever day it goes out on', () => {
    expect(getNewsletterPeriod(MONTHLY, local(10, 9))).toEqual({
      since: local(1, 0, 9).toISOString(),
      until: local(1).toISOString(),
    })
  })

  it('covers the 3 months before a quarterly one', () => {
    expect(getNewsletterPeriod(QUARTERLY, local(1, 9, 9))).toEqual({
      since: local(1, 0, 6).toISOString(),
      until: local(1, 0, 9).toISOString(),
    })
  })
})

describe('getDueSendTime', () => {
  it('is the latest send time until it has gone out', () => {
    const now = local(23, 9, 10, 5)

    expect(getDueSendTime(WEEKLY, null, now)).toEqual(local(23, 9))
    expect(getDueSendTime(WEEKLY, local(16, 9), now)).toEqual(local(23, 9))
    expect(getDueSendTime(WEEKLY, local(23, 9), now)).toBeNull()
  })

  it('is nothing while the newsletter is off', () => {
    expect(
      getDueSendTime(
        { ...WEEKLY, isNewsletterActive: false },
        null,
        local(23, 10),
      ),
    ).toBeNull()
  })

  it('still sends a day late, but not later', () => {
    expect(getDueSendTime(WEEKLY, null, local(24, 8))).toEqual(local(23, 9))
    expect(getDueSendTime(WEEKLY, null, local(24, 10))).toBeNull()
  })
})

describe('isSameSchedule', () => {
  it('compares what decides when it goes out', () => {
    expect(isSameSchedule(WEEKLY, { ...WEEKLY })).toBe(true)
    expect(isSameSchedule(WEEKLY, MONTHLY)).toBe(false)
    expect(isSameSchedule(WEEKLY, { ...WEEKLY, newsletterHour: 10 })).toBe(
      false,
    )
  })
})

describe('across a change to summer time', () => {
  const zone = process.env.TZ
  // Saturdays at 3, the hour the clocks skip in Tallinn on Sunday 29 March 2026
  const SATURDAY_3AM: NewsletterSchedule = {
    ...WEEKLY,
    newsletterWeekday: 6,
    newsletterHour: 3,
  }

  beforeAll(() => {
    process.env.TZ = 'Europe/Tallinn'
  })

  afterAll(() => {
    if (zone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = zone
    }
  })

  it("keeps the week's send time on the day the clocks change", () => {
    const saturday = new Date(2026, 2, 28, 3)

    expect(getLatestSendTime(SATURDAY_3AM, new Date(2026, 2, 29, 1))).toEqual(
      saturday,
    )
    expect(
      getDueSendTime(SATURDAY_3AM, saturday, new Date(2026, 2, 29, 1)),
    ).toBeNull()
    expect(getNextSendTime(SATURDAY_3AM, new Date(2026, 2, 29, 1))).toEqual(
      new Date(2026, 3, 4, 3),
    )
  })
})
