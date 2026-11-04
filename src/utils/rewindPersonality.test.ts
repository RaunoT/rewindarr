import { Play } from '@/types/playHistory'
import { UserRewind } from '@/types/rewind'
import { TautulliItemRow } from '@/types/tautulli'
import { describe, expect, it } from 'vitest'
import {
  getPersonality,
  getPersonalitySignals,
  getPlaySignals,
  PersonalitySignals,
} from './rewindPersonality'

const HOUR = 60 * 60
const DAY_MS = 24 * HOUR * 1000
const YEAR = 2026
const NOW = Date.parse('2026-11-04T12:00:00Z')

// Plays per hour, from the hours given
function hours(plays: Record<number, number>): number[] {
  return Array.from({ length: 24 }, (_, hour) => plays[hour] ?? 0)
}

// A viewer with nothing that stands out: 100 plays, mostly in the evening and
// on a Wednesday, and a year spread over shows, movies and music
function signals(
  overrides: Partial<PersonalitySignals> = {},
): PersonalitySignals {
  return {
    durations: { shows: 60 * HOUR, movies: 30 * HOUR, audio: 10 * HOUR },
    counts: { shows: 60, movies: 15, audio: 40 },
    hourly: hours({ 18: 20, 19: 25, 20: 30, 21: 15, 22: 5, 23: 5 }),
    daily: [14, 14, 14, 16, 14, 14, 14],
    binge: { episodes: 4, title: 'Severance' },
    streak: 5,
    movies: { started: 15, finished: 12 },
    titles: 40,
    discoveries: { shows: 2, artists: 5 },
    timeTravel: {
      decade: 2010,
      share: 0.4,
      oldest: { year: 1994, title: 'Pulp Fiction' },
    },
    comfortWatch: null,
    topTitle: { title: 'Severance', duration: 15 * HOUR },
    ...overrides,
  }
}

describe('getPersonality', () => {
  it('calls a viewer with nothing striking a free spirit', () => {
    expect(getPersonality(signals(), YEAR)).toEqual({
      type: 'freeSpirit',
      stats: [
        { type: 'total', duration: 100 * HOUR },
        { type: 'titles', count: 40 },
      ],
    })
  })

  it('leaves out a viewer with too little to go on', () => {
    expect(
      getPersonality(
        signals({ counts: { shows: 5, movies: 2, audio: 2 } }),
        YEAR,
      ),
    ).toBeNull()
    expect(
      getPersonality(
        signals({ durations: { shows: 2 * HOUR, movies: null, audio: null } }),
        YEAR,
      ),
    ).toBeNull()
  })

  it('finds a night owl by the plays late at night', () => {
    expect(
      getPersonality(
        signals({ hourly: hours({ 20: 30, 21: 20, 23: 35, 1: 15 }) }),
        YEAR,
      ),
    ).toEqual({
      type: 'nightOwl',
      stats: [
        { type: 'hoursShare', share: 0.5, from: 22, to: 4 },
        { type: 'peakHour', hour: 23 },
      ],
    })
  })

  it('needs the busiest hour at night for a night owl', () => {
    expect(
      getPersonality(signals({ hourly: hours({ 20: 60, 23: 40 }) }), YEAR)
        ?.type,
    ).toBe('freeSpirit')
  })

  it('needs enough plays to read the hours', () => {
    expect(
      getPersonality(signals({ hourly: hours({ 23: 10, 0: 5 }) }), YEAR)?.type,
    ).toBe('freeSpirit')
  })

  it('finds an early bird by the plays in the morning', () => {
    expect(
      getPersonality(
        signals({ hourly: hours({ 7: 40, 8: 10, 20: 30 }) }),
        YEAR,
      ),
    ).toEqual({
      type: 'earlyBird',
      stats: [
        { type: 'hoursShare', share: 0.625, from: 5, to: 10 },
        { type: 'peakHour', hour: 7 },
      ],
    })
  })

  it('finds a weekend warrior by the plays on Saturdays and Sundays', () => {
    expect(
      getPersonality(signals({ daily: [30, 5, 5, 5, 5, 10, 40] }), YEAR),
    ).toEqual({
      type: 'weekendWarrior',
      stats: [
        { type: 'weekendShare', share: 0.7 },
        { type: 'peakDay', day: 6 },
      ],
    })
  })

  it('finds a binger by the most episodes in one go', () => {
    expect(
      getPersonality(
        signals({ binge: { episodes: 12, title: 'The Bear' } }),
        YEAR,
      ),
    ).toEqual({
      type: 'binger',
      stats: [
        { type: 'binge', episodes: 12, title: 'The Bear' },
        { type: 'count', media: 'shows', count: 60 },
      ],
    })
  })

  it('finds a marathoner by the longest streak', () => {
    expect(getPersonality(signals({ streak: 30 }), YEAR)).toEqual({
      type: 'marathoner',
      stats: [
        { type: 'streak', days: 30 },
        { type: 'total', duration: 100 * HOUR },
      ],
    })
  })

  it('finds a completionist by the movies they finished', () => {
    expect(
      getPersonality(signals({ movies: { started: 20, finished: 20 } }), YEAR),
    ).toEqual({
      type: 'completionist',
      stats: [
        { type: 'completion', started: 20, finished: 20 },
        { type: 'total', duration: 100 * HOUR },
      ],
    })
  })

  it("doesn't count a handful of finished movies", () => {
    expect(
      getPersonality(signals({ movies: { started: 8, finished: 8 } }), YEAR)
        ?.type,
    ).toBe('freeSpirit')
  })

  it('finds an explorer by what was new to them, the stronger find first', () => {
    expect(
      getPersonality(signals({ discoveries: { shows: 3, artists: 50 } }), YEAR),
    ).toEqual({
      type: 'explorer',
      stats: [
        { type: 'newArtists', count: 50 },
        { type: 'newShows', count: 3 },
        { type: 'titles', count: 40 },
      ],
    })
  })

  it('leaves out a kind of find there were none of', () => {
    expect(
      getPersonality(signals({ discoveries: { shows: 10, artists: 0 } }), YEAR)
        ?.stats,
    ).toEqual([
      { type: 'newShows', count: 10 },
      { type: 'titles', count: 40 },
    ])
  })

  it('finds a time traveller by a decade at least two back', () => {
    const timeTravel = {
      decade: 1990,
      share: 0.5,
      oldest: { year: 1972, title: 'The Godfather' },
    }

    expect(getPersonality(signals({ timeTravel }), YEAR)).toEqual({
      type: 'timeTraveller',
      stats: [
        { type: 'decade', decade: 1990, share: 0.5 },
        { type: 'oldest', year: 1972, title: 'The Godfather' },
      ],
    })
    expect(
      getPersonality(
        signals({ timeTravel: { ...timeTravel, decade: 2010, share: 0.9 } }),
        YEAR,
      )?.type,
    ).toBe('freeSpirit')
    expect(
      getPersonality(
        signals({ timeTravel: { ...timeTravel, decade: 2010 } }),
        2030,
      )?.type,
    ).toBe('timeTraveller')
  })

  it('finds a loyalist by the time on one title or the rewatches', () => {
    expect(
      getPersonality(
        signals({ topTitle: { title: 'Severance', duration: 45 * HOUR } }),
        YEAR,
      ),
    ).toEqual({
      type: 'loyalist',
      stats: [
        { type: 'topTitle', title: 'Severance', share: 0.45 },
        { type: 'total', duration: 100 * HOUR },
      ],
    })
    expect(
      getPersonality(
        signals({
          comfortWatch: { title: 'Paddington 2', show: null, watches: 6 },
        }),
        YEAR,
      ),
    ).toEqual({
      type: 'loyalist',
      stats: [
        {
          type: 'comfortWatch',
          title: 'Paddington 2',
          show: null,
          watches: 6,
        },
        { type: 'topTitle', title: 'Severance', share: 0.15 },
      ],
    })
  })

  it('finds a cinephile, a series devotee or a music lover by their time', () => {
    expect(
      getPersonality(
        signals({
          durations: { shows: 25 * HOUR, movies: 70 * HOUR, audio: 5 * HOUR },
        }),
        YEAR,
      ),
    ).toEqual({
      type: 'cinephile',
      stats: [
        { type: 'share', media: 'movies', share: 0.7 },
        { type: 'count', media: 'movies', count: 15 },
      ],
    })
    expect(
      getPersonality(
        signals({
          durations: { shows: 95 * HOUR, movies: 5 * HOUR, audio: 0 },
        }),
        YEAR,
      )?.type,
    ).toBe('seriesDevotee')
    expect(
      getPersonality(
        signals({
          durations: { shows: 20 * HOUR, movies: 10 * HOUR, audio: 70 * HOUR },
          counts: { shows: 20, movies: 5, audio: 300 },
        }),
        YEAR,
      )?.type,
    ).toBe('musicLover')
  })

  it('needs another kind of media on the server to tell a taste from what there is', () => {
    expect(
      getPersonality(
        signals({
          durations: { shows: null, movies: 100 * HOUR, audio: null },
        }),
        YEAR,
      )?.type,
    ).toBe('freeSpirit')
    // Movies and music, but no shows
    expect(
      getPersonality(
        signals({
          durations: { shows: null, movies: 90 * HOUR, audio: 10 * HOUR },
          counts: { shows: 0, movies: 30, audio: 40 },
        }),
        YEAR,
      )?.type,
    ).toBe('cinephile')
  })

  it('goes with the strongest signal', () => {
    // A strong night share beats a binge halfway to strong
    expect(
      getPersonality(
        signals({
          hourly: hours({ 20: 30, 23: 40, 0: 30 }),
          binge: { episodes: 12, title: 'The Bear' },
        }),
        YEAR,
      )?.type,
    ).toBe('nightOwl')
    // A strong binge beats a night share just past its threshold
    expect(
      getPersonality(
        signals({
          hourly: hours({ 20: 30, 21: 30, 23: 36, 0: 4 }),
          binge: { episodes: 16, title: 'The Bear' },
        }),
        YEAR,
      )?.type,
    ).toBe('binger')
  })

  it('settles a tie between strong signals by the rarer personality', () => {
    expect(
      getPersonality(
        signals({ streak: 60, binge: { episodes: 20, title: 'The Bear' } }),
        YEAR,
      )?.type,
    ).toBe('binger')
  })
})

function play(startedAt: number, overrides: Partial<Play> = {}): Play {
  return {
    id: `${startedAt}-${overrides.title ?? 'Dune'}`,
    startedAt,
    mediaType: 'movie',
    durationMs: 2 * HOUR * 1000,
    percentComplete: 100,
    title: 'Dune',
    showTitle: null,
    artistName: null,
    year: 2021,
    mediaId: null,
    showMediaId: null,
    ...overrides,
  } as Play
}

describe('getPlaySignals', () => {
  it('counts the movies started and finished, without misclicks or ones still in progress', () => {
    const plays = [
      play(NOW - 30 * DAY_MS),
      // Finished on a second go
      play(NOW - 60 * DAY_MS, { title: 'Arrival', percentComplete: 40 }),
      play(NOW - 59 * DAY_MS, { title: 'Arrival', percentComplete: 100 }),
      play(NOW - 90 * DAY_MS, { title: 'Tenet', percentComplete: 30 }),
      play(NOW - 90 * DAY_MS, {
        title: 'Cats',
        percentComplete: 2,
        durationMs: 2 * 60 * 1000,
      }),
      play(NOW - 3 * DAY_MS, { title: 'Oppenheimer', percentComplete: 20 }),
    ]

    expect(getPlaySignals(plays, 50, NOW).movies).toEqual({
      started: 3,
      finished: 2,
    })
  })

  it('counts the movies, shows and artists with a play that counts', () => {
    const plays = [
      play(NOW - DAY_MS),
      play(NOW - 2 * DAY_MS),
      play(NOW - DAY_MS, {
        mediaType: 'episode',
        title: 'Good News About Hell',
        showTitle: 'Severance',
      }),
      play(NOW - 2 * DAY_MS, {
        mediaType: 'episode',
        title: 'Half Loop',
        showTitle: 'Severance',
      }),
      play(NOW - DAY_MS, {
        mediaType: 'track',
        title: 'Reckoner',
        artistName: 'Radiohead',
      }),
      play(NOW - DAY_MS, { title: 'Tenet', percentComplete: 10 }),
    ]

    expect(getPlaySignals(plays, 50, NOW).titles).toBe(3)
  })
})

function row(title: string, duration: number): TautulliItemRow {
  return { title, total_duration: duration } as TautulliItemRow
}

describe('getPersonalitySignals', () => {
  it("reads the signals from the rewind's stats", () => {
    const rewind = {
      shows: {
        count: 40,
        duration_value: 50 * HOUR,
        top: [row('Severance', 20 * HOUR)],
      },
      movies: {
        count: 10,
        duration_value: 25 * HOUR,
        top: [row('Dune', 5 * HOUR)],
      },
      audio: { count: 0, duration_value: null, top: [] },
      habits: { hourly: hours({ 20: 3 }), daily: [0, 0, 0, 3, 0, 0, 0] },
      moments: {
        binge: { episodes: 5, title: 'Severance', date: '2026-03-01' },
        streak: { days: 4, start: '2026-03-01', end: '2026-03-04' },
      },
      titleMoments: {
        comfortWatch: {
          item: row('Severance', 0),
          type: 'show',
          episode: 'Half Loop',
          watches: 3,
        },
        timeTravel: {
          decade: 2020,
          share: 0.8,
          oldest: { item: row('Alien', 0), type: 'movie', year: 1979 },
        },
        discoveries: null,
        gaveUp: null,
      },
    } as unknown as UserRewind

    expect(
      getPersonalitySignals(rewind, {
        movies: { started: 10, finished: 9 },
        titles: 12,
      }),
    ).toEqual({
      durations: { shows: 50 * HOUR, movies: 25 * HOUR, audio: null },
      counts: { shows: 40, movies: 10, audio: 0 },
      hourly: hours({ 20: 3 }),
      daily: [0, 0, 0, 3, 0, 0, 0],
      binge: { episodes: 5, title: 'Severance' },
      streak: 4,
      movies: { started: 10, finished: 9 },
      titles: 12,
      discoveries: null,
      timeTravel: {
        decade: 2020,
        share: 0.8,
        oldest: { year: 1979, title: 'Alien' },
      },
      comfortWatch: { title: 'Half Loop', show: 'Severance', watches: 3 },
      topTitle: { title: 'Severance', duration: 20 * HOUR },
    })
  })
})
