import { describe, expect, it } from 'vitest'
import { createHourAndDayReader, toTimeZone } from './timeZone'

describe('toTimeZone', () => {
  it('keeps a timezone Intl knows, as Intl names it', () => {
    expect(toTimeZone('America/New_York')).toBe('America/New_York')
    expect(toTimeZone('utc')).toBe('UTC')
  })

  it('leaves out anything else', () => {
    expect(toTimeZone('Not/A_Zone')).toBeUndefined()
    expect(toTimeZone('')).toBeUndefined()
    expect(toTimeZone(undefined)).toBeUndefined()
  })
})

describe('createHourAndDayReader', () => {
  // A Saturday at 02:30 in UTC
  const time = new Date('2026-03-07T02:30:00Z').getTime()

  it('reads the hour and the day in the timezone', () => {
    expect(createHourAndDayReader('UTC')(time)).toEqual({ hour: 2, day: 6 })
    // Still Friday evening in New York
    expect(createHourAndDayReader('America/New_York')(time)).toEqual({
      hour: 21,
      day: 5,
    })
  })

  it('reads midnight as hour 0', () => {
    expect(
      createHourAndDayReader('UTC')(new Date('2026-03-08T00:00:00Z').getTime()),
    ).toEqual({ hour: 0, day: 0 })
  })

  it("follows the timezone's daylight saving time", () => {
    const read = createHourAndDayReader('Europe/London')

    expect(read(new Date('2026-01-15T20:00:00Z').getTime()).hour).toBe(20)
    expect(read(new Date('2026-07-15T20:00:00Z').getTime()).hour).toBe(21)
  })
})
