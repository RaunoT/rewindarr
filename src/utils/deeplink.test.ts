import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { describe, expect, it } from 'vitest'
import { generateDeeplinkUrl, getRowDeeplink } from './deeplink'

const PLEX: MediaServer = { type: 'plex', id: 'abc123', url: '' }

function row(fields: Partial<TautulliItemRow>): TautulliItemRow {
  return {
    rating_key: 10,
    grandparent_rating_key: 20,
    is_deleted: false,
    ...fields,
  } as TautulliItemRow
}

describe('getRowDeeplink', () => {
  it("links a movie or show by its rating key and an artist by the artist's", () => {
    expect(getRowDeeplink(row({}), 'movie', PLEX)).toEqual({
      mediaServer: PLEX,
      ratingKey: 10,
    })
    expect(getRowDeeplink(row({}), 'artist', PLEX)?.ratingKey).toBe(20)
  })

  it('leaves out an item without a server, a rating key or one deleted', () => {
    expect(getRowDeeplink(row({}), 'movie', null)).toBeNull()
    expect(getRowDeeplink(null, 'movie', PLEX)).toBeNull()
    expect(getRowDeeplink(row({ is_deleted: true }), 'show', PLEX)).toBeNull()
    expect(getRowDeeplink(row({ rating_key: 0 }), 'show', PLEX)).toBeNull()
  })
})

describe('generateDeeplinkUrl', () => {
  it("opens Plex's app on iOS and app.plex.tv elsewhere", () => {
    expect(generateDeeplinkUrl(10, PLEX, true)).toBe(
      'plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F10&server=abc123',
    )
    expect(generateDeeplinkUrl(10, PLEX, false)).toBe(
      'https://app.plex.tv/desktop#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F10',
    )
  })
})
