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

// The bars that have a label
function labelled(labels: (string | null)[] | null) {
  return labels?.flatMap((label, index) => (label ? [[index, label]] : []))
}

describe('getYearLabels', () => {
  it("marks the past year's first month and each January with its year", () => {
    expect(labelled(getYearLabels(getMonths('2025-11', 13), 'en-GB'))).toEqual([
      [0, '2025'],
      [2, '2026'],
    ])
  })

  it('marks the first month even when the next year starts right after', () => {
    expect(labelled(getYearLabels(getMonths('2025-12', 13), 'en-GB'))).toEqual([
      [0, '2025'],
      [1, '2026'],
    ])
  })

  it('marks every year of up to 24 months', () => {
    // 2 months of 2024, then a January 2 bars from the end
    expect(labelled(getYearLabels(getMonths('2024-11', 24), 'en-GB'))).toEqual([
      [0, '2024'],
      [2, '2025'],
      [14, '2026'],
    ])
    // 3 months of 2024, and a January on the last bar
    expect(labelled(getYearLabels(getMonths('2024-10', 16), 'en-GB'))).toEqual([
      [0, '2024'],
      [3, '2025'],
      [15, '2026'],
    ])
  })

  it('marks a January on the last bar', () => {
    expect(labelled(getYearLabels(getMonths('2025-01', 13), 'en-GB'))).toEqual([
      [0, '2025'],
      [12, '2026'],
    ])
  })

  it('has none for months in one year', () => {
    expect(getYearLabels(getMonths('2026-01', 11), 'en-GB')).toBeNull()
  })

  it('has none past 24 months, which are labelled with their years', () => {
    expect(getYearLabels(getMonths('2024-03', 25), 'en-GB')).toBeNull()
    expect(getYearLabels(getMonths('2024-06', 30), 'en-GB')).toBeNull()
  })
})
