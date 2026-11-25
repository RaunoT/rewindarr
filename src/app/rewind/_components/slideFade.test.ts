import { describe, expect, it } from 'vitest'
import { getMoreBelow } from './slideFade'

describe('getMoreBelow', () => {
  it('measures what is left below the screen', () => {
    expect(getMoreBelow(800, 0, 680)).toBe(120)
    expect(getMoreBelow(800, 100, 680)).toBe(20)
  })

  it('has nothing below a story that fits', () => {
    expect(getMoreBelow(680, 0, 680)).toBe(0)
  })

  it('has nothing below once scrolled to the end', () => {
    expect(getMoreBelow(800, 120, 680)).toBe(0)
  })

  it('ignores the part of a pixel a zoomed screen leaves', () => {
    expect(getMoreBelow(800, 119.5, 680)).toBe(0)
  })

  it('has nothing below while the scroll bounces past the end', () => {
    expect(getMoreBelow(800, 140, 680)).toBe(0)
  })
})
