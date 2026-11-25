import { describe, expect, it } from 'vitest'
import {
  getMonthLabels,
  getYearLabels,
  SHORT_LABEL_MONTHS,
  WIDE_SHORT_LABEL_MONTHS,
} from './monthLabels'

// YYYY-MM months from the first, for as many as asked
function getMonths(first: string, count: number): string[] {
  const [year, month] = first.split('-').map(Number)

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1))

    return date.toISOString().slice(0, 7)
  })
}

describe('getMonthLabels', () => {
  it('gives short names while they fit, and letters past that', () => {
    expect(
      getMonthLabels(getMonths('2026-01', 3), 'en-GB', SHORT_LABEL_MONTHS),
    ).toEqual(['Jan', 'Feb', 'Mar'])
    expect(
      getMonthLabels(getMonths('2025-11', 13), 'en-GB', SHORT_LABEL_MONTHS),
    ).toEqual(['N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N'])
    expect(
      getMonthLabels(
        getMonths('2025-11', 13),
        'en-GB',
        WIDE_SHORT_LABEL_MONTHS,
      )[12],
    ).toBe('Nov')
  })

  it('labels only each January, with its year, past 24 months', () => {
    const labels = getMonthLabels(
      getMonths('2024-06', 30),
      'en-GB',
      SHORT_LABEL_MONTHS,
    )

    expect(labels.filter(Boolean)).toEqual(['2025', '2026'])
    expect(labels[7]).toBe('2025')
  })
})

describe('getYearLabels', () => {
  it("marks the past year's first month and each January with its year", () => {
    const labels = getYearLabels(getMonths('2025-11', 13), 'en-GB')

    expect(labels).toEqual([
      '2025',
      null,
      '2026',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it("leaves out the first month's year when the next starts right after", () => {
    const labels = getYearLabels(getMonths('2025-12', 13), 'en-GB')

    expect(labels?.[0]).toBeNull()
    expect(labels?.[1]).toBe('2026')
  })

  it('marks a January on the last bar', () => {
    const labels = getYearLabels(getMonths('2025-01', 13), 'en-GB')

    expect(labels?.[0]).toBe('2025')
    expect(labels?.[12]).toBe('2026')
    expect(labels?.filter(Boolean)).toHaveLength(2)
  })

  it('has none for months in one year', () => {
    expect(getYearLabels(getMonths('2026-01', 11), 'en-GB')).toBeNull()
  })

  it('has none past 24 months, which are labelled with their years', () => {
    expect(getYearLabels(getMonths('2024-06', 30), 'en-GB')).toBeNull()
  })
})
