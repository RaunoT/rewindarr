import { HistoryPlay } from '@/types/statsSource'
import { describe, expect, it, vi } from 'vitest'
import { SeerrRequestItem } from './fetchSeerr'
import { getOnlyYou, getRequestsReach, getServerYear } from './rewindSocial'

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
