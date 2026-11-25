import { describe, expect, it } from 'vitest'
import { fitSpanLabels } from './spanLabels'

// A 320px phone's plot, with the widest axis label, and a year's label
const PLOT = 220
const LABEL = 34

// The labels' boxes at these bars, of so many
function boxes(indexes: number[], count: number, plotWidth = PLOT) {
  return indexes.map((index) => ({
    start: (index / count) * plotWidth,
    width: LABEL,
  }))
}

const FITS = { isEndAligned: false, isHidden: false }

describe('fitSpanLabels', () => {
  it('starts each at its bar while there is room', () => {
    // A 390px phone's
    expect(fitSpanLabels(boxes([0, 2], 13, 310), 310)).toEqual([FITS, FITS])
  })

  it("leaves out the first month's when the next year starts too soon", () => {
    // 2 bars of 13 are 34px, too close for a 34px label and the gap
    expect(fitSpanLabels(boxes([0, 2], 13), PLOT)).toEqual([
      { isEndAligned: false, isHidden: true },
      FITS,
    ])
    // 3 bars of 24 are 27.5px
    expect(fitSpanLabels(boxes([0, 3, 15], 24), PLOT)).toEqual([
      { isEndAligned: false, isHidden: true },
      FITS,
      FITS,
    ])
    expect(fitSpanLabels(boxes([0, 6, 18], 24), PLOT)).toEqual([
      FITS,
      FITS,
      FITS,
    ])
  })

  it('sets one that would run past the end against it', () => {
    // A January 2 bars from the end of 24 months, at 91.67%
    expect(fitSpanLabels(boxes([0, 10, 22], 24), PLOT)).toEqual([
      FITS,
      FITS,
      { isEndAligned: true, isHidden: false },
    ])
  })

  it('leaves out one the end-aligned label runs into', () => {
    expect(
      fitSpanLabels(
        [
          { start: 150, width: LABEL },
          { start: 210, width: LABEL },
        ],
        PLOT,
      ),
    ).toEqual([
      { isEndAligned: false, isHidden: true },
      { isEndAligned: true, isHidden: false },
    ])
  })
})
