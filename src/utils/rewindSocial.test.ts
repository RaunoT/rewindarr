import { HistoryPlay } from '@/types/statsSource'
import { describe, expect, it, vi } from 'vitest'
import { SeerrRequestItem } from './fetchSeerr'
import {
  getOnlyYou,
  getRequestsReach,
  getRequestsWatched,
  getServerYear,
} from './rewindSocial'

vi.mock('./getSettings', () => ({ default: vi.fn() }))

const HOUR_MS = 60 * 60 * 1000
const MIN_PERCENT = 50
const ALICE = { identityId: 'alice', userId: '1', userName: 'Alice' }
const BOB = { identityId: 'bob', userId: '2', userName: 'Bob' }
const CAROL = { identityId: 'carol', userId: '3', userName: 'Carol' }
const DAVE = { identityId: 'dave', userId: '4', userName: 'Dave' }
// A user the source no longer lists
const GONE = { identityId: 'gone', userId: '', userName: '' }

// Tautulli's plays, which carry no media IDs and group by title
function play(
  id: string,
  user: typeof ALICE,
  overrides: Partial<HistoryPlay> = {},
): HistoryPlay {
  return {
    id,
    startedAt: new Date('2026-06-01T20:00:00Z').getTime(),
    mediaType: 'movie',
    durationMs: HOUR_MS,
    percentComplete: 100,
    title: id,
    showTitle: null,
    artistName: null,
    year: 2026,
    thumb: '',
    ratingKey: null,
    grandparentRatingKey: null,
    mediaId: null,
    showMediaId: null,
    imdbId: null,
    tmdbId: null,
    avatar: '',
    seasonNumber: null,
    episodeNumber: null,
    transcodeDecision: null,
    lengthMs: null,
    ...user,
    ...overrides,
  }
}

function episode(
  id: string,
  user: typeof ALICE,
  show: string,
  overrides: Partial<HistoryPlay> = {},
): HistoryPlay {
  return play(id, user, {
    mediaType: 'episode',
    showTitle: show,
    seasonNumber: 1,
    ...overrides,
  })
}

// Made by Alice, whose Plex ID is 1
function request(
  id: number,
  overrides: Partial<SeerrRequestItem> = {},
): SeerrRequestItem {
  return {
    id,
    createdAt: '2026-05-01T00:00:00Z',
    type: 'movie',
    status: 2,
    media: { tmdbId: id },
    requestedBy: { id: 7, plexId: 1 },
    ...overrides,
  }
}

describe('getOnlyYou', () => {
  it('counts the titles nobody else watched and picks the longest', () => {
    const plays = [
      play('arrival-1', ALICE, { title: 'Arrival' }),
      play('arrival-2', ALICE, { title: 'Arrival', durationMs: 2 * HOUR_MS }),
      play('brick', ALICE, { title: 'Brick' }),
      play('coco', ALICE, { title: 'Coco' }),
      play('coco-bob', BOB, { title: 'Coco' }),
    ]

    expect(getOnlyYou(plays, '1', MIN_PERCENT)).toMatchObject({
      count: 2,
      share: 2 / 3,
      top: {
        play: { title: 'Arrival' },
        plays: 2,
        duration: 3 * 60 * 60,
        users: 1,
      },
    })
  })

  it("doesn't let someone else's play that doesn't count take a title", () => {
    const plays = [
      play('coco', ALICE, { title: 'Coco' }),
      play('coco-bob', BOB, { title: 'Coco', percentComplete: 10 }),
      play('brick-bob', BOB, { title: 'Brick' }),
    ]

    expect(getOnlyYou(plays, '1', MIN_PERCENT)).toMatchObject({
      count: 1,
      share: 1,
      top: { play: { title: 'Coco' }, plays: 1 },
    })
  })

  it('rolls episodes up into their show', () => {
    const plays = [
      episode('severance-1', ALICE, 'Severance'),
      episode('severance-2', ALICE, 'Severance'),
      episode('dark', ALICE, 'Dark'),
      episode('dark-bob', BOB, 'Dark'),
    ]

    expect(getOnlyYou(plays, '1', MIN_PERCENT)).toMatchObject({
      count: 1,
      share: 1 / 2,
      top: { play: { showTitle: 'Severance' }, plays: 2 },
    })
  })

  it('counts a user the source no longer lists as someone else', () => {
    const plays = [
      play('coco', ALICE, { title: 'Coco' }),
      play('coco-gone', GONE, { title: 'Coco' }),
    ]

    expect(getOnlyYou(plays, '1', MIN_PERCENT)).toBeNull()
  })

  it('leaves out a server where nobody else watched a movie or show', () => {
    const plays = [
      play('coco', ALICE, { title: 'Coco' }),
      play('track-bob', BOB, { mediaType: 'track', artistName: 'Björk' }),
    ]

    expect(getOnlyYou(plays, '1', MIN_PERCENT)).toBeNull()
  })

  it('leaves out a user who watched nothing', () => {
    expect(getOnlyYou([play('coco-bob', BOB)], '1', MIN_PERCENT)).toBeNull()
  })
})

describe('getRequestsReach', () => {
  it('counts the people who watched what the user asked for in Plex', () => {
    const requests = [
      request(1, { media: { tmdbId: 1, ratingKey: '100' } }),
      request(2, { type: 'tv', media: { tmdbId: 2, ratingKey: '200' } }),
      request(3, { media: { tmdbId: 3, ratingKey: '300' } }),
    ]
    const plays = [
      play('arrival', ALICE, { title: 'Arrival', ratingKey: '100' }),
      play('arrival-bob', BOB, { title: 'Arrival', ratingKey: '100' }),
      play('arrival-carol', CAROL, { title: 'Arrival', ratingKey: '100' }),
      episode('severance-1', BOB, 'Severance', { grandparentRatingKey: '200' }),
      episode('severance-2', BOB, 'Severance', { grandparentRatingKey: '200' }),
      play('brick', ALICE, { title: 'Brick', ratingKey: '300' }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toMatchObject({
      users: 2,
      requests: 2,
      duration: 4 * 60 * 60,
      // Seen by more people, though the show has as many plays
      top: { play: { title: 'Arrival' }, users: 2, plays: 2 },
      isTopWatched: true,
    })
  })

  it('tells whether the user watched the top one, even before asking', () => {
    const requests = [
      request(1, { media: { tmdbId: 1, ratingKey: '100' } }),
      request(2, { type: 'tv', media: { tmdbId: 2, ratingKey: '200' } }),
    ]
    const otherPlays = [
      play('arrival-bob', BOB, { title: 'Arrival', ratingKey: '100' }),
      play('arrival-carol', CAROL, { title: 'Arrival', ratingKey: '100' }),
      episode('dark-bob', BOB, 'Dark', { grandparentRatingKey: '200' }),
    ]

    // Only the one fewer people watched
    expect(
      getRequestsReach(
        requests,
        [
          ...otherPlays,
          episode('dark', ALICE, 'Dark', { grandparentRatingKey: '200' }),
        ],
        '1',
        MIN_PERCENT,
      ),
    ).toMatchObject({
      top: { play: { title: 'Arrival' } },
      isTopWatched: false,
    })
    // Not far enough to count
    expect(
      getRequestsReach(
        requests,
        [
          ...otherPlays,
          play('arrival', ALICE, { ratingKey: '100', percentComplete: 10 }),
        ],
        '1',
        MIN_PERCENT,
      ),
    ).toMatchObject({ isTopWatched: false })
    expect(
      getRequestsReach(
        requests,
        [
          ...otherPlays,
          play('arrival', ALICE, {
            ratingKey: '100',
            startedAt: new Date('2026-04-01T20:00:00Z').getTime(),
          }),
        ],
        '1',
        MIN_PERCENT,
      ),
    ).toMatchObject({ isTopWatched: true })
  })

  it('leaves out another show with the same name', () => {
    const requests = [
      request(1, { type: 'tv', media: { tmdbId: 2, ratingKey: '200' } }),
    ]
    const plays = [
      episode('office-bob', BOB, 'The Office', { grandparentRatingKey: '200' }),
      // The British one
      episode('office-carol', CAROL, 'The Office', {
        grandparentRatingKey: '900',
      }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toMatchObject({
      users: 1,
      top: { play: { id: 'office-bob' }, users: 1 },
    })
  })

  it("matches Jellyfin's IDs and movies' TMDB IDs, not episodes'", () => {
    const requests = [
      request(1, { media: { tmdbId: 1, jellyfinMediaId: 'AB12-CD34' } }),
      request(2, { media: { tmdbId: 55 } }),
      request(3, { type: 'tv', media: { tmdbId: 77 } }),
    ]
    const plays = [
      play('arrival-bob', BOB, { title: 'Arrival', ratingKey: 'ab12cd34' }),
      play('brick-carol', CAROL, { title: 'Brick', tmdbId: 55 }),
      // Tracearr's episodes carry their own TMDB ID
      episode('dark-bob', BOB, 'Dark', { tmdbId: 77 }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toMatchObject({
      users: 2,
      requests: 2,
    })
  })

  it("follows a title's plays once it was asked for", () => {
    const requests = [
      request(1, { media: { tmdbId: 1, ratingKey: '100' } }),
      // Someone else's
      request(2, {
        media: { tmdbId: 2, ratingKey: '200' },
        requestedBy: { id: 8, plexId: 2 },
      }),
      request(3, { media: { tmdbId: 3, ratingKey: '300' }, status: 3 }),
      request(4, {
        type: 'tv',
        media: { tmdbId: 4, ratingKey: '400' },
        seasons: [{ seasonNumber: 2 }],
      }),
    ]
    const plays = [
      play('arrival-bob', BOB, {
        title: 'Arrival',
        ratingKey: '100',
        startedAt: new Date('2026-04-30T20:00:00Z').getTime(),
      }),
      play('arrival', ALICE, { title: 'Arrival', ratingKey: '100' }),
      play('brick-carol', CAROL, { title: 'Brick', ratingKey: '200' }),
      play('coco-bob', BOB, { title: 'Coco', ratingKey: '300' }),
      episode('dark-bob', BOB, 'Dark', { grandparentRatingKey: '400' }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toBeNull()
  })

  it('counts the plays of a title asked for twice once', () => {
    const requests = [
      request(1, { type: 'tv', media: { tmdbId: 1, ratingKey: '100' } }),
      request(2, { type: 'tv', media: { tmdbId: 1, ratingKey: '100' } }),
    ]
    const plays = [
      episode('dark-1', BOB, 'Dark', { grandparentRatingKey: '100' }),
      episode('dark-2', BOB, 'Dark', { grandparentRatingKey: '100' }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toMatchObject({
      users: 1,
      requests: 2,
      duration: 2 * 60 * 60,
    })
  })

  it("doesn't count someone whose plays don't count", () => {
    const requests = [request(1, { media: { tmdbId: 1, ratingKey: '100' } })]
    const plays = [
      play('arrival-bob', BOB, { ratingKey: '100', percentComplete: 10 }),
    ]

    expect(getRequestsReach(requests, plays, '1', MIN_PERCENT)).toBeNull()
  })
})

describe('getRequestsWatched', () => {
  it('counts the requests in the media server the user watched', () => {
    const requests = [
      request(1, { media: { tmdbId: 1, ratingKey: '100', status: 5 } }),
      request(2, {
        type: 'tv',
        media: { tmdbId: 2, ratingKey: '200', status: 4 },
      }),
      request(3, { media: { tmdbId: 3, ratingKey: '300', status: 5 } }),
      // Not there yet
      request(4, { media: { tmdbId: 4, status: 3 } }),
      // Declined, though someone else's request brought it
      request(5, {
        media: { tmdbId: 5, ratingKey: '500', status: 5 },
        status: 3,
      }),
      // Someone else's
      request(6, {
        media: { tmdbId: 6, ratingKey: '600', status: 5 },
        requestedBy: { id: 8, plexId: 2 },
      }),
    ]
    const plays = [
      play('arrival', ALICE, { ratingKey: '100' }),
      episode('dark', ALICE, 'Dark', { grandparentRatingKey: '200' }),
      // Not far enough to count
      play('brick', ALICE, { ratingKey: '300', percentComplete: 10 }),
      play('coco', ALICE, { ratingKey: '500' }),
      // Someone else watching it doesn't count
      play('brick-bob', BOB, { ratingKey: '300' }),
    ]

    expect(getRequestsWatched(requests, plays, '1', MIN_PERCENT)).toEqual({
      added: 3,
      watched: 2,
    })
  })

  it("only counts a show's requested seasons", () => {
    const requests = [
      request(1, {
        type: 'tv',
        media: { tmdbId: 1, ratingKey: '100', status: 5 },
        seasons: [{ seasonNumber: 2 }],
      }),
    ]

    expect(
      getRequestsWatched(
        requests,
        [episode('dark-1', ALICE, 'Dark', { grandparentRatingKey: '100' })],
        '1',
        MIN_PERCENT,
      ),
    ).toEqual({ added: 1, watched: 0 })
    expect(
      getRequestsWatched(
        requests,
        [
          episode('dark-2', ALICE, 'Dark', {
            grandparentRatingKey: '100',
            seasonNumber: 2,
          }),
        ],
        '1',
        MIN_PERCENT,
      ),
    ).toEqual({ added: 1, watched: 1 })
  })

  it('reads the 4K fields of a 4K request', () => {
    const requests = [
      request(1, {
        is4k: true,
        media: { tmdbId: 1, status: 5, ratingKey: '100', status4k: 5 },
      }),
      request(2, {
        is4k: true,
        type: 'tv',
        media: { tmdbId: 2, status: 1, status4k: 4, ratingKey4k: '200' },
      }),
    ]
    const plays = [
      // The other version
      play('arrival', ALICE, { ratingKey: '100' }),
      episode('dark', ALICE, 'Dark', { grandparentRatingKey: '200' }),
    ]

    // The 4K movie has no ID to match by
    expect(getRequestsWatched(requests, plays, '1', MIN_PERCENT)).toEqual({
      added: 1,
      watched: 1,
    })
  })

  it('matches deleted movies by TMDB ID when the plays carry one', () => {
    const requests = [
      request(1, { status: 5, media: { tmdbId: 1, status: 7 } }),
      request(2, { status: 5, media: { tmdbId: 2, status: 7 } }),
      // A show has no ID left to match by
      request(3, { type: 'tv', status: 5, media: { tmdbId: 3, status: 7 } }),
    ]

    expect(
      getRequestsWatched(
        requests,
        [play('arrival', ALICE, { tmdbId: 1 })],
        '1',
        MIN_PERCENT,
      ),
    ).toEqual({ added: 2, watched: 1 })
    // Tautulli's plays carry no TMDB ID
    expect(
      getRequestsWatched(requests, [play('arrival', ALICE)], '1', MIN_PERCENT),
    ).toBeNull()
  })

  it('is null without any request in the media server', () => {
    const requests = [request(1, { media: { tmdbId: 1, status: 2 } })]

    expect(getRequestsWatched(requests, [], '1', MIN_PERCENT)).toBeNull()
  })
})

describe('getServerYear', () => {
  it("adds up everyone's year and finds the most watched", () => {
    const plays = [
      play('arrival', ALICE, { title: 'Arrival', durationMs: 2 * HOUR_MS }),
      play('arrival-bob', BOB, { title: 'Arrival' }),
      play('brick-carol-1', CAROL, { title: 'Brick' }),
      play('brick-carol-2', CAROL, { title: 'Brick' }),
      episode('dark-bob', BOB, 'Dark'),
      play('track-dave', DAVE, { mediaType: 'track', artistName: 'Björk' }),
    ]

    expect(getServerYear(plays, '1', MIN_PERCENT)).toMatchObject({
      duration: 7 * 60 * 60,
      users: 4,
      share: 2 / 7,
      // More people watched it than the one with more plays
      movie: { play: { title: 'Arrival' }, users: 2, plays: 2 },
      show: { play: { showTitle: 'Dark' }, users: 1 },
    })
  })

  it('ranks by plays between titles as many people watched', () => {
    const plays = [
      play('arrival-bob', BOB, { title: 'Arrival', durationMs: 3 * HOUR_MS }),
      play('brick-carol-1', CAROL, { title: 'Brick' }),
      play('brick-carol-2', CAROL, { title: 'Brick' }),
    ]

    expect(getServerYear(plays, '1', MIN_PERCENT)).toMatchObject({
      movie: { play: { title: 'Brick' } },
      show: null,
    })
  })

  it("gives a user who played nothing everyone else's year", () => {
    const plays = [
      play('arrival-bob', BOB, { title: 'Arrival' }),
      play('brick-carol', CAROL, { title: 'Brick', percentComplete: 10 }),
    ]

    expect(getServerYear(plays, '1', MIN_PERCENT)).toMatchObject({
      duration: 2 * 60 * 60,
      users: 1,
      share: 0,
      movie: { play: { title: 'Arrival' } },
    })
  })

  it('leaves out a server nobody else played anything on', () => {
    const plays = [
      play('arrival', ALICE),
      play('brick-bob', BOB, { percentComplete: 10 }),
    ]

    expect(getServerYear(plays, '1', MIN_PERCENT)).toBeNull()
  })
})
