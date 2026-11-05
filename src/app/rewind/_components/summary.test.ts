import { UserRewind } from '@/types/rewind'
import { TautulliItemRow } from '@/types/tautulli'
import { describe, expect, it } from 'vitest'
import {
  getSummaryFileName,
  getSummaryHighlights,
  getSummaryTitle,
  getSummaryTops,
} from './summary'

function row(title: string): TautulliItemRow {
  return { title } as TautulliItemRow
}

function rewind(
  shows: TautulliItemRow[],
  movies: TautulliItemRow[],
  audio: TautulliItemRow[],
) {
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

describe('getSummaryTitle', () => {
  const now = new Date('2026-11-04T12:00:00Z')

  it('names this year for the default past year', () => {
    expect(getSummaryTitle('', '', now)).toEqual({
      type: 'default',
      years: '2026',
    })
  })

  it('adds the earlier year of a start date the admin set in one', () => {
    expect(getSummaryTitle('', '2026-01-01', now)).toEqual({
      type: 'default',
      years: '2026',
    })
    expect(getSummaryTitle('', '2024-11-04', now)).toEqual({
      type: 'default',
      years: '2024–2026',
    })
  })

  it("uses the server's name when the admin set one", () => {
    expect(getSummaryTitle('Home Cinema', '', now)).toEqual({
      type: 'server',
      serverName: 'Home Cinema',
      years: '2026',
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
    expect(getSummaryFileName('Rewind 2025–2026', 'R. T.')).toBe(
      'rewind-2025-2026-r-t.png',
    )
  })

  it('keeps letters from other scripts', () => {
    expect(getSummaryFileName('Rewind', 'Юлия')).toBe('rewind-юлия.png')
  })

  it('falls back to a name of its own', () => {
    expect(getSummaryFileName('!!!')).toBe('rewind.png')
  })
})
