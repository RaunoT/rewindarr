import { describe, expect, it } from 'vitest'
import { getStatementDuration, StatementContent } from './autoplay'

const NOTHING: StatementContent = {
  headline: 0,
  detail: 0,
  images: 0,
  charts: 0,
}

describe('getStatementDuration', () => {
  it('gives a longer statement more time', () => {
    const short = getStatementDuration({ ...NOTHING, headline: 40 }, false)
    const long = getStatementDuration({ ...NOTHING, headline: 90 }, false)

    expect(short).toBe(3400)
    expect(long).toBe(6150)
  })

  it('gives the text of cards and lists less time than the statement', () => {
    expect(
      getStatementDuration({ ...NOTHING, headline: 30, detail: 70 }, false),
    ).toBeLessThan(getStatementDuration({ ...NOTHING, headline: 100 }, false))
  })

  it('adds time for images and charts', () => {
    const text = getStatementDuration({ ...NOTHING, headline: 40 }, false)

    expect(
      getStatementDuration({ ...NOTHING, headline: 40, images: 4 }, false),
    ).toBe(text + 1600)
    expect(
      getStatementDuration({ ...NOTHING, headline: 40, charts: 1 }, false),
    ).toBe(text + 2000)
  })

  it('keeps a few words up long enough to be noticed', () => {
    expect(getStatementDuration({ ...NOTHING, headline: 5 }, false)).toBe(2500)
  })

  it('moves on from a statement with a lot in it', () => {
    expect(
      getStatementDuration(
        { headline: 200, detail: 600, images: 12, charts: 1 },
        false,
      ),
    ).toBe(9000)
  })

  it("gives each of a countdown's places the same time", () => {
    expect(getStatementDuration(null, false)).toBe(2500)
  })

  it("stays a beat longer on a story's last statement", () => {
    expect(getStatementDuration(null, true)).toBe(3500)
    expect(getStatementDuration({ ...NOTHING, headline: 5 }, true)).toBe(3500)
    expect(getStatementDuration({ ...NOTHING, headline: 500 }, true)).toBe(
      10000,
    )
  })
})
