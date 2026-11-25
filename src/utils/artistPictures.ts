import { ItemRow } from '@/types/statsSource'
import { searchArtistPicture } from './musicPreviewSources'

type CachedPicture = {
  picture: string | null
  expiresAt: number
}

// Deezer can add a picture later, so a missing one is asked for again
const PICTURE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_PICTURES = 1000
// The same artists come up on every page and in every email
const globalForPictures = globalThis as typeof globalThis & {
  rewindarrArtistPictures?: Map<string, CachedPicture>
}
const pictures = (globalForPictures.rewindarrArtistPictures ??= new Map())

async function getArtistPicture(name: string): Promise<string | null> {
  const now = Date.now()
  const cached = pictures.get(name)

  if (cached && cached.expiresAt > now) {
    return cached.picture
  }

  try {
    const picture = await searchArtistPicture(name)

    pictures.delete(name)

    if (pictures.size >= MAX_PICTURES) {
      pictures.delete(pictures.keys().next().value!)
    }

    pictures.set(name, { picture, expiresAt: now + PICTURE_TTL_MS })

    return picture
  } catch {
    // Deezer couldn't be asked, so it's tried again next time
    return cached?.picture ?? null
  }
}

// Deezer's picture of each artist, for when the media server has none, as
// for an artist no longer in the library
export function addArtistPictures(items: ItemRow[]): Promise<ItemRow[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      fallback_poster: await getArtistPicture(item.title),
    })),
  )
}
