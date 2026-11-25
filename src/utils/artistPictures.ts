import { ItemRow } from '@/types/statsSource'
import { createHmac, timingSafeEqual } from 'crypto'
import { searchArtistPicture } from './musicPreviewSources'

type CachedPicture = {
  picture: string | null
  expiresAt: number
}

export const ARTIST_PICTURE_URL = '/api/image'

// Deezer can add a picture later, so a missing one is asked for again
const PICTURE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_PICTURES = 1000
// The same artists come up on every page and in every email
const globalForPictures = globalThis as typeof globalThis & {
  rewindarrArtistPictureCache?: Map<string, CachedPicture>
  rewindarrPendingArtistPictures?: Map<string, Promise<string | null>>
}
const pictures = (globalForPictures.rewindarrArtistPictureCache ??= new Map())
const pendingPictures = (globalForPictures.rewindarrPendingArtistPictures ??=
  new Map())

// The name as Deezer's search matches it
function toKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function getCached(key: string): CachedPicture | undefined {
  const cached = pictures.get(key)

  // Moved to the end, so the artists asked for most stay longest
  if (cached) {
    pictures.delete(key)
    pictures.set(key, cached)
  }

  return cached
}

function setCached(key: string, picture: string | null): void {
  pictures.delete(key)

  if (pictures.size >= MAX_PICTURES) {
    const oldestKey = pictures.keys().next().value

    if (oldestKey !== undefined) {
      pictures.delete(oldestKey)
    }
  }

  pictures.set(key, { picture, expiresAt: Date.now() + PICTURE_TTL_MS })
}

async function loadPicture(
  key: string,
  stale: CachedPicture | undefined,
): Promise<string | null> {
  try {
    const picture = await searchArtistPicture(key)

    setCached(key, picture)

    return picture
  } catch {
    // Deezer couldn't be asked, so it's tried again next time
    return stale?.picture ?? null
  }
}

// Deezer's picture of the artist, or null without one
export function getArtistPicture(name: string): Promise<string | null> {
  const key = toKey(name)

  if (!key) {
    return Promise.resolve(null)
  }

  const cached = getCached(key)

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.picture)
  }

  let pending = pendingPictures.get(key)

  if (!pending) {
    pending = loadPicture(key, cached).finally(() => {
      pendingPictures.delete(key)
    })
    pendingPictures.set(key, pending)
  }

  return pending
}

function sign(name: string): Buffer {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(`artist:${toKey(name)}`)
    .digest()
}

// Signed, so only the artists the app lists are searched for, not any text
export function getArtistPictureUrl(name: string): string | null {
  if (!process.env.NEXTAUTH_SECRET || !toKey(name)) {
    return null
  }

  const params = new URLSearchParams({
    artist: name,
    sig: sign(name).toString('base64url'),
  })

  return `${ARTIST_PICTURE_URL}?${params}`
}

export function isSignedArtist(name: string, signature: string): boolean {
  if (!process.env.NEXTAUTH_SECRET) {
    return false
  }

  const expected = sign(name)
  const given = Buffer.from(signature, 'base64url')

  return given.length === expected.length && timingSafeEqual(given, expected)
}

// A link to Deezer's picture of each artist, for when the media server has
// none, as for an artist no longer in the library. Deezer is only asked once
// the media server's picture fails to load.
export function addArtistPictures(items: ItemRow[]): ItemRow[] {
  return items.map((item) => ({
    ...item,
    fallback_poster: getArtistPictureUrl(item.title),
  }))
}
