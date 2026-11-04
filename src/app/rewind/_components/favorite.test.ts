import { describe, expect, it } from 'vitest'
import { isFavorite } from './favorite'

describe('isFavorite', () => {
  it('is a favourite once it was played again', () => {
    expect(isFavorite({ total_plays: 2 })).toBe(true)
  })

  it("isn't a favourite after a single play or none that counts", () => {
    expect(isFavorite({ total_plays: 1 })).toBe(false)
    expect(isFavorite({ total_plays: 0 })).toBe(false)
  })
})
