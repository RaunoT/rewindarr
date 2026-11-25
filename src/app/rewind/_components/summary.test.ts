import { UserRewind } from '@/types/rewind'
import { ItemRow } from '@/types/statsSource'
import { describe, expect, it } from 'vitest'
import {
  getSummaryFileName,
  getSummaryHighlights,
  getSummaryTitle,
  getSummaryTops,
} from './summary'

function row(title: string): ItemRow {
  return { title } as ItemRow
}

function rewind(shows: ItemRow[], movies: ItemRow[], audio: ItemRow[]) {
  return {
    shows: { top: shows },
    movies: { top: movies },
    audio: { top: audio },
  } as unknown as UserRewind
}

describe('getSummaryTops', () => {
  it('takes the top show, movie and artist', () => {
    expect(
      getSummaryTops(
        rewind(
          [row('Severance'), row('The Bear')],
          [row('Dune')],
          [row('Radiohead')],
        ),
      ),
    ).toEqual([
      { type: 'show', item: row('Severance') },
      { type: 'movie', item: row('Dune') },
      { type: 'artist', item: row('Radiohead') },
    ])
  })

  it('leaves out a kind without any', () => {
    expect(getSummaryTops(rewind([], [row('Dune')], []))).toEqual([
      { type: 'movie', item: row('Dune') },
    ])
    expect(getSummaryTops(rewind([], [], []))).toEqual([])
  })
})

// Lines don't break in the months, around the dash Intl sets between thin
// spaces either
function unbroken(period: string) {
  return period
    .replace(/ – /g, '\u202f\u2060–\u2060\u202f')
    .replace(/ /g, '\u00a0')
}

describe('getSummaryTitle', () => {
  const now = new Date('2026-11-04T12:00:00Z')

  it("names the past year after its months, up to the viewer's today", () => {
    expect(
      getSummaryTitle(
        '',
        { since: '2025-11-04', year: null, today: '2026-11-04' },
        'en-GB',
      ),
    ).toEqual({
      type: 'default',
      period: unbroken('Nov 2025 – Nov 2026'),
    })
  })

  it("ends in the viewer's month when it's ahead of UTC's", () => {
    expect(
      getSummaryTitle(
        '',
        { since: '2025-12-01', year: null, today: '2026-12-01' },
        'en-GB',
        new Date('2026-11-30T23:30:00Z'),
      ).period,
    ).toBe(unbroken('Dec 2025 – Dec 2026'))
  })

  it("names a custom period after its months, in the viewer's language", () => {
    expect(
      getSummaryTitle('', { since: '2026-01-15', year: null }, 'en-GB', now),
    ).toEqual({
      type: 'default',
      period: unbroken('Jan – Nov 2026'),
    })
    expect(
      getSummaryTitle('', { since: '2024-11-04', year: null }, 'de', now),
    ).toEqual({
      type: 'default',
      period: unbroken('Nov. 2024 – Nov. 2026'),
    })
  })

  it('names a period that began this month, or has yet to, after one month', () => {
    expect(
      getSummaryTitle('', { since: '2026-11-01', year: null }, 'en-GB', now),
    ).toEqual({
      type: 'default',
      period: unbroken('Nov 2026'),
    })
    expect(
      getSummaryTitle('', { since: '2027-02-01', year: null }, 'en-GB', now),
    ).toEqual({
      type: 'default',
      period: unbroken('Feb 2027'),
    })
  })

  it("names an edition after its year, even once it's over", () => {
    expect(
      getSummaryTitle(
        '',
        { since: '2024-12-31T22:00:00.000Z', year: 2025 },
        'en-GB',
        now,
      ),
    ).toEqual({
      type: 'default',
      period: '2025',
    })
  })

  it("uses the server's name when the admin set one", () => {
    expect(
      getSummaryTitle(
        'Home Cinema',
        { since: '2025-12-31T22:00:00.000Z', year: 2026 },
        'en-GB',
        now,
      ),
    ).toEqual({
      type: 'server',
      serverName: 'Home Cinema',
      period: '2026',
    })
  })
})

// A viewer with every highlight, and no personality to repeat one
function withHighlights(overrides: Partial<UserRewind> = {}) {
  return {
    duration: { topPercent: 5 },
    genres: {
      shows: [{ name: 'Drama', share: 0.6 }],
      movies: [{ name: 'Sci-Fi', share: 0.8 }],
      match: null,
    },
    shows: { duration_value: 100 },
    movies: { duration_value: 50 },
    moments: {
      monthly: {
        months: [
          { month: '2026-02', duration: 10 },
          { month: '2026-03', duration: 30 },
        ],
        peakIndex: 1,
      },
      binge: {
        episodes: 9,
        title: 'Severance',
        date: '2026-03-01',
        duration: 18240,
      },
      streak: { days: 12, start: '2026-03-01', end: '2026-03-12' },
      biggestDay: null,
    },
    habits: { peakDayIndex: 6 },
    personality: null,
    ...overrides,
  } as unknown as UserRewind
}

describe('getSummaryHighlights', () => {
  it('picks the three most telling, the rank and the taste first', () => {
    expect(getSummaryHighlights(withHighlights())).toEqual([
      { type: 'topPercent', percent: 5 },
      { type: 'genre', name: 'Drama' },
      { type: 'binge', episodes: 9, title: 'Severance', duration: 18240 },
    ])
  })

  it("takes the genre from what took more of the viewer's time", () => {
    expect(
      getSummaryHighlights(
        withHighlights({
          movies: { duration_value: 200 } as UserRewind['movies'],
        }),
      )[1],
    ).toEqual({ type: 'genre', name: 'Sci-Fi' })
  })

  it("leaves out those the viewer doesn't have", () => {
    const rewind = withHighlights()

    expect(
      getSummaryHighlights({
        ...rewind,
        duration: { ...rewind.duration, topPercent: null },
        genres: { shows: [], movies: [], match: null },
        moments: { ...rewind.moments, binge: null },
      }),
    ).toEqual([
      { type: 'streak', days: 12 },
      { type: 'month', month: '2026-03' },
      { type: 'day', day: 6 },
    ])
  })

  it("doesn't repeat the stat that earned the personality", () => {
    expect(
      getSummaryHighlights(
        withHighlights({ personality: { type: 'binger', stats: [] } }),
      ),
    ).toEqual([
      { type: 'topPercent', percent: 5 },
      { type: 'genre', name: 'Drama' },
      { type: 'streak', days: 12 },
    ])
  })
})

describe('getSummaryFileName', () => {
  it('joins the words with dashes, without accents or symbols', () => {
    expect(getSummaryFileName('My Plex', 'Rewind', 'Jüri')).toBe(
      'my-plex-rewind-juri.png',
    )
    expect(getSummaryFileName('Rewind Nov. 2025 – Nov. 2026', 'R. T.')).toBe(
      'rewind-nov-2025-nov-2026-r-t.png',
    )
  })

  it('keeps letters from other scripts', () => {
    expect(getSummaryFileName('Rewind', 'Юлия')).toBe('rewind-юлия.png')
  })

  it('falls back to a name of its own', () => {
    expect(getSummaryFileName('!!!')).toBe('rewind.png')
  })
})
