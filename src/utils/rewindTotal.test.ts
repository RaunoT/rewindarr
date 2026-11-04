import { describe, expect, it } from 'vitest'
import { getNonStopDays, getTopPercent } from './rewindTotal'

// Ranked by their time, most first, like the source ranks them
function rankedUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    user_id: i + 1,
    total_duration: (count - i) * 3600,
  }))
}

describe('getTopPercent', () => {
  it('gives the top percent the user is in', () => {
    const users = rankedUsers(20)

    expect(getTopPercent(users, '1', 0)).toBe(5)
    expect(getTopPercent(users, '2', 0)).toBe(10)
    expect(getTopPercent(users, '5', 0)).toBe(25)
  })

  it('rounds up to whole percents below 10, then to fives', () => {
    expect(getTopPercent(rankedUsers(300), '1', 0)).toBe(1)
    expect(getTopPercent(rankedUsers(100), '7', 0)).toBe(7)
    expect(getTopPercent(rankedUsers(12), '1', 0)).toBe(9)
    expect(getTopPercent(rankedUsers(12), '2', 0)).toBe(20)
    expect(getTopPercent(rankedUsers(30), '4', 0)).toBe(15)
  })

  it('is null outside the top quarter', () => {
    const users = rankedUsers(20)

    expect(getTopPercent(users, '6', 0)).toBeNull()
    expect(getTopPercent(users, '20', 0)).toBeNull()
  })

  it('is null with too few users', () => {
    expect(getTopPercent(rankedUsers(9), '1', 0)).toBeNull()
    expect(getTopPercent(rankedUsers(10), '1', 0)).toBe(10)
  })

  it('compares Jellyfin IDs as strings', () => {
    const users = rankedUsers(10).map((user, i) => ({
      ...user,
      user_id: i ? `user${i}` : 'a1b2c3',
    }))

    expect(getTopPercent(users, 'a1b2c3', 0)).toBe(10)
  })

  it('places a user who is not ranked by their own time', () => {
    const users = rankedUsers(19)

    // Ahead of everyone, as one of 20
    expect(getTopPercent(users, 'excluded', 100 * 3600)).toBe(5)
    // Behind the top 2, as the 3rd of 20
    expect(getTopPercent(users, 'excluded', 17.5 * 3600)).toBe(15)
    expect(getTopPercent(users, 'excluded', 3600)).toBeNull()
  })

  it('counts a user who is not ranked towards the minimum', () => {
    expect(getTopPercent(rankedUsers(9), 'excluded', 100 * 3600)).toBe(10)
  })

  it('is null for a user who is not ranked and has no time', () => {
    expect(getTopPercent(rankedUsers(20), 'excluded', 0)).toBeNull()
  })
})

describe('getNonStopDays', () => {
  it('is null under a day', () => {
    expect(getNonStopDays(0)).toBeNull()
    expect(getNonStopDays(86399)).toBeNull()
  })

  it('gives the days to one decimal below ten days', () => {
    expect(getNonStopDays(86400)).toBe(1)
    expect(getNonStopDays(3.4 * 86400 + 600)).toBe(3.4)
    expect(getNonStopDays(9.96 * 86400)).toBe(10)
  })

  it('gives whole days from ten days up', () => {
    expect(getNonStopDays(45.3 * 86400)).toBe(45)
    expect(getNonStopDays(45.5 * 86400)).toBe(46)
  })
})
