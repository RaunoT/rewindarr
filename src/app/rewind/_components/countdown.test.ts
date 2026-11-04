import { describe, expect, it } from 'vitest'
import { getCountdownStart } from './countdown'

describe('getCountdownStart', () => {
  it('shows the last place first', () => {
    expect(getCountdownStart(5, 0)).toBe(4)
  })

  it('shows one place more each step, up to the first', () => {
    expect(getCountdownStart(5, 1)).toBe(3)
    expect(getCountdownStart(5, 4)).toBe(0)
  })

  it('stops at the first place', () => {
    expect(getCountdownStart(5, 9)).toBe(0)
  })

  it('shows a single place right away', () => {
    expect(getCountdownStart(1, 0)).toBe(0)
  })
})
