import { describe, expect, it } from 'vitest'
import { toProgressPercent } from './ProgressBar'

describe('toProgressPercent', () => {
  it('rounds finite values clamped to 0..100', () => {
    expect(toProgressPercent(0)).toBe(0)
    expect(toProgressPercent(0.456)).toBe(46)
    expect(toProgressPercent(1)).toBe(100)
    expect(toProgressPercent(-0.25)).toBe(0)
    expect(toProgressPercent(1.5)).toBe(100)
  })

  it('returns 0 for non-finite values', () => {
    expect(toProgressPercent(Number.NaN)).toBe(0)
    expect(toProgressPercent(Number.POSITIVE_INFINITY)).toBe(0)
    expect(toProgressPercent(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
