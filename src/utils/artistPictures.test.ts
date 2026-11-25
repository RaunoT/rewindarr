import { ItemRow } from '@/types/statsSource'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addArtistPictures,
  getArtistPicture,
  getArtistPictureUrl,
  isSignedArtist,
} from './artistPictures'
import { searchArtistPicture } from './musicPreviewSources'

vi.mock('./musicPreviewSources', () => ({ searchArtistPicture: vi.fn() }))

const PICTURE = 'https://cdn-images.dzcdn.net/images/artist/abc/500x500.jpg'

beforeEach(() => {
  vi.stubEnv('NEXTAUTH_SECRET', 'secret')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.mocked(searchArtistPicture).mockReset()
})

// The cache outlives each test, so each uses its own artist
describe('getArtistPicture', () => {
  it("gives Deezer's picture, or null without one", async () => {
    vi.mocked(searchArtistPicture).mockImplementation(async (name) =>
      name === 'known' ? PICTURE : null,
    )

    await expect(getArtistPicture('Known')).resolves.toBe(PICTURE)
    await expect(getArtistPicture('Unknown')).resolves.toBeNull()
  })

  it('looks each artist up once, whatever the case and spacing', async () => {
    vi.mocked(searchArtistPicture).mockResolvedValue(PICTURE)

    await Promise.all([getArtistPicture('Cached'), getArtistPicture('cached ')])
    await getArtistPicture('CACHED')

    expect(searchArtistPicture).toHaveBeenCalledTimes(1)
  })

  it('asks again after a day', async () => {
    vi.useFakeTimers()
    vi.mocked(searchArtistPicture).mockResolvedValue(null)

    await getArtistPicture('Later')
    vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    await getArtistPicture('Later')

    expect(searchArtistPicture).toHaveBeenCalledTimes(2)
  })

  it("asks again when Deezer couldn't be asked", async () => {
    vi.mocked(searchArtistPicture)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(PICTURE)

    await expect(getArtistPicture('Flaky')).resolves.toBeNull()
    await expect(getArtistPicture('Flaky')).resolves.toBe(PICTURE)
  })

  it("doesn't search for an empty name", async () => {
    await expect(getArtistPicture('  ')).resolves.toBeNull()

    expect(searchArtistPicture).not.toHaveBeenCalled()
  })
})

describe('getArtistPictureUrl', () => {
  it('signs the artist, so no other name is searched for', () => {
    const url = new URL(getArtistPictureUrl('Albert King')!, 'http://app')
    const sig = url.searchParams.get('sig')!

    expect(url.pathname).toBe('/api/image')
    expect(url.searchParams.get('artist')).toBe('Albert King')
    expect(isSignedArtist('Albert King', sig)).toBe(true)
    expect(isSignedArtist('B.B. King', sig)).toBe(false)
  })

  it('gives nothing without a secret to sign with', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')

    expect(getArtistPictureUrl('Albert King')).toBeNull()
    expect(isSignedArtist('Albert King', '')).toBe(false)
  })
})

describe('addArtistPictures', () => {
  it("links each artist's picture without searching for it yet", () => {
    const [item] = addArtistPictures([{ title: 'Albert King' } as ItemRow])

    expect(item.fallback_poster).toBe(getArtistPictureUrl('Albert King'))
    expect(searchArtistPicture).not.toHaveBeenCalled()
  })
})
