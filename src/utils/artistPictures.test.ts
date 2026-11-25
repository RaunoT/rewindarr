import { ItemRow } from '@/types/statsSource'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addArtistPictures } from './artistPictures'
import { searchArtistPicture } from './musicPreviewSources'

vi.mock('./musicPreviewSources', () => ({ searchArtistPicture: vi.fn() }))

const PICTURE = 'https://cdn-images.dzcdn.net/images/artist/abc/500x500.jpg'

function artist(title: string) {
  return { title } as ItemRow
}

describe('addArtistPictures', () => {
  beforeEach(() => {
    vi.useRealTimers()
    // The cache outlives each test, so each uses its own artist
    vi.mocked(searchArtistPicture).mockReset()
  })

  it("adds Deezer's picture of each artist", async () => {
    vi.mocked(searchArtistPicture).mockImplementation(async (name) =>
      name === 'Known' ? PICTURE : null,
    )

    const items = await addArtistPictures([artist('Known'), artist('Unknown')])

    expect(items.map((item) => item.fallback_poster)).toEqual([PICTURE, null])
  })

  it('looks each artist up once', async () => {
    vi.mocked(searchArtistPicture).mockResolvedValue(PICTURE)

    await addArtistPictures([artist('Cached')])
    await addArtistPictures([artist('Cached')])

    expect(searchArtistPicture).toHaveBeenCalledTimes(1)
  })

  it('asks again after a day', async () => {
    vi.useFakeTimers()
    vi.mocked(searchArtistPicture).mockResolvedValue(null)

    await addArtistPictures([artist('Later')])
    vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    await addArtistPictures([artist('Later')])

    expect(searchArtistPicture).toHaveBeenCalledTimes(2)
  })

  it("asks again when Deezer couldn't be asked", async () => {
    vi.mocked(searchArtistPicture)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(PICTURE)

    const [first] = await addArtistPictures([artist('Flaky')])
    const [second] = await addArtistPictures([artist('Flaky')])

    expect(first.fallback_poster).toBeNull()
    expect(second.fallback_poster).toBe(PICTURE)
  })
})
