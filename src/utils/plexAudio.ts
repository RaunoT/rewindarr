import { Settings } from '@/types/settings'
import { createHmac, timingSafeEqual } from 'crypto'
import { REWIND_MUSIC_TYPES } from './constants'
import {
  isGatewayError,
  isHostDown,
  markHostDown,
  markHostUp,
} from './hostBackoff'
import { passAudio } from './rewindMusic'

// An item's theme song, or a song itself
export type PlexAudioKind = 'theme' | 'track'

type AudioPath = {
  path: string | null
  expiresAt: number
}

export const PLEX_THEME_URL = '/api/rewind/theme'
export const PLEX_TRACK_URL = '/api/rewind/track'
export const MAX_AUDIO_PATHS = 500

// Only how long Plex has to start answering; the song itself can take longer
const PLEX_TIMEOUT_MS = 10 * 1000
const AUDIO_PATH_TTL_MS = 60 * 60 * 1000
// Where Plex serves an item's theme song and a song's file. Plex fetches any
// other path with the server's token, so nothing else is requested.
const THEME_PATH = /^\/library\/metadata\/\d+\/theme\/\d+$/
const TRACK_PATH = /^\/library\/parts\/\d+\/\d+\/file\.([a-z0-9]+)$/i
// Browsers ask for parts of the song, each of which would look the item up
const globalForPlexAudio = globalThis as unknown as {
  rewindarrPlexAudioPaths?: Map<string, AudioPath>
  rewindarrPendingPlexAudioPaths?: Map<string, Promise<string | null>>
}
const audioPaths = (globalForPlexAudio.rewindarrPlexAudioPaths ??= new Map())
const pendingAudioPaths = (globalForPlexAudio.rewindarrPendingPlexAudioPaths ??=
  new Map())

// Plex only serves the library with a token. Jellyfin's items aren't Plex's.
export function canStreamFromPlex({ connection }: Settings): boolean {
  return (
    connection.mediaServerType === 'plex' &&
    !!connection.plexUrl &&
    !!connection.plexToken
  )
}

function signAudio(kind: PlexAudioKind, ratingKey: string): Buffer {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(`${kind}:${ratingKey}`)
    .digest()
}

function isSignedAudio(
  kind: PlexAudioKind,
  ratingKey: string,
  signature: string,
): boolean {
  if (!process.env.NEXTAUTH_SECRET) {
    return false
  }

  // As UTF-8 text so decoding cannot accept alternate spellings of the last char
  const expected = Buffer.from(signAudio(kind, ratingKey).toString('base64url'))
  const given = Buffer.from(signature)

  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function getPlexThemeUrl(
  settings: Settings,
  ratingKey: string | number | null | undefined,
): string | null {
  const key = ratingKey ? String(ratingKey) : ''

  if (
    !canStreamFromPlex(settings) ||
    !/^\d+$/.test(key) ||
    !process.env.NEXTAUTH_SECRET
  ) {
    return null
  }

  const signature = signAudio('theme', key).toString('base64url')

  return `${PLEX_THEME_URL}?key=${key}&sig=${signature}`
}

export function isSignedTheme(ratingKey: string, signature: string): boolean {
  return isSignedAudio('theme', ratingKey, signature)
}

// Signed, so viewers can only play the songs their Rewind picked, not any in
// the library, which their Plex share might leave out
export function getPlexTrackUrl(
  settings: Settings,
  ratingKey: string | null | undefined,
): string | null {
  if (
    !canStreamFromPlex(settings) ||
    !ratingKey ||
    !/^\d+$/.test(ratingKey) ||
    !process.env.NEXTAUTH_SECRET
  ) {
    return null
  }

  const signature = signAudio('track', ratingKey).toString('base64url')

  return `${PLEX_TRACK_URL}?key=${ratingKey}&sig=${signature}`
}

export function isSignedTrack(ratingKey: string, signature: string): boolean {
  return isSignedAudio('track', ratingKey, signature)
}

export function isThemePath(path: unknown): path is string {
  return typeof path === 'string' && THEME_PATH.test(path)
}

export function isTrackPath(path: unknown): path is string {
  return typeof path === 'string' && TRACK_PATH.test(path)
}

// A redirect isn't followed, as the token would go with it
async function fetchPlex(
  settings: Settings,
  path: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response | null> {
  const { plexUrl, plexToken } = settings.connection

  if (!plexToken || isHostDown(plexUrl)) {
    return null
  }

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), PLEX_TIMEOUT_MS)

  try {
    const response = await fetch(`${plexUrl}${path}`, {
      headers: { ...headers, 'X-Plex-Token': plexToken },
      redirect: 'manual',
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, timeout.signal])
        : timeout.signal,
    })

    if (isGatewayError(response.status)) {
      markHostDown(plexUrl)
    } else {
      markHostUp(plexUrl)
    }

    return response
  } catch (error) {
    // A visitor moving on isn't Plex being down
    if (!signal?.aborted) {
      markHostDown(plexUrl)
      console.error(`[PLEX] - Couldn't get ${path}!`, error)
    }

    return null
  } finally {
    clearTimeout(timer)
  }
}

// Only a song has a file to play, so a movie's or an episode's isn't served
function findAudioPath(
  kind: PlexAudioKind,
  item: Record<string, unknown> | undefined,
): string | null {
  if (kind === 'theme') {
    const theme = item?.theme

    return isThemePath(theme) ? theme : null
  }

  const media = item?.Media as { Part?: { key?: unknown }[] }[] | undefined
  const part = item?.type === 'track' ? media?.[0]?.Part?.[0]?.key : null

  return isTrackPath(part) ? part : null
}

function getCachedAudioPath(
  cacheKey: string,
  now: number,
): string | null | undefined {
  const cached = audioPaths.get(cacheKey)

  if (!cached) {
    return undefined
  }

  if (cached.expiresAt <= now) {
    audioPaths.delete(cacheKey)

    return undefined
  }

  audioPaths.delete(cacheKey)
  audioPaths.set(cacheKey, cached)

  return cached.path
}

function setCachedAudioPath(
  cacheKey: string,
  path: string | null,
  now: number,
): void {
  for (const [key, entry] of audioPaths) {
    if (entry.expiresAt <= now) {
      audioPaths.delete(key)
    }
  }

  if (audioPaths.has(cacheKey)) {
    audioPaths.delete(cacheKey)
  } else if (audioPaths.size >= MAX_AUDIO_PATHS) {
    const oldestKey = audioPaths.keys().next().value

    if (oldestKey !== undefined) {
      audioPaths.delete(oldestKey)
    }
  }

  audioPaths.set(cacheKey, { path, expiresAt: now + AUDIO_PATH_TTL_MS })
}

async function loadAudioPath(
  settings: Settings,
  kind: PlexAudioKind,
  ratingKey: string,
  cacheKey: string,
): Promise<string | null> {
  const response = await fetchPlex(settings, `/library/metadata/${ratingKey}`, {
    Accept: 'application/json',
  })

  if (!response?.ok) {
    await response?.body?.cancel()

    return null
  }

  const data = await response.json().catch(() => null)
  const path = findAudioPath(kind, data?.MediaContainer?.Metadata?.[0])

  setCachedAudioPath(cacheKey, path, Date.now())

  return path
}

async function getAudioPath(
  settings: Settings,
  kind: PlexAudioKind,
  ratingKey: string,
): Promise<string | null> {
  const cacheKey = `${settings.connection.plexUrl}|${kind}|${ratingKey}`
  const cached = getCachedAudioPath(cacheKey, Date.now())

  if (cached !== undefined) {
    return cached
  }

  let pending = pendingAudioPaths.get(cacheKey)

  if (!pending) {
    pending = loadAudioPath(settings, kind, ratingKey, cacheKey).finally(() => {
      pendingAudioPaths.delete(cacheKey)
    })
    pendingAudioPaths.set(cacheKey, pending)
  }

  return pending
}

// A song is served as its file's type. Plex calls a theme's MP3 audio/mpeg3,
// which isn't a type every browser knows. Null for a file browsers can't play.
function getAudioType(path: string, response: Response): string | null {
  const extension = path.match(TRACK_PATH)?.[1].toLowerCase()

  if (extension) {
    return Object.hasOwn(REWIND_MUSIC_TYPES, extension)
      ? REWIND_MUSIC_TYPES[extension]
      : null
  }

  const type = response.headers.get('content-type') ?? ''

  return type.startsWith('audio/') && type !== 'audio/mpeg3'
    ? type
    : 'audio/mpeg'
}

// The item's audio as Plex serves it, passed on with the parts of the song
// the browser asked for. A 404 without one.
export async function streamPlexAudio(
  settings: Settings,
  kind: PlexAudioKind,
  ratingKey: string,
  request: Request,
): Promise<Response> {
  const path = await getAudioPath(settings, kind, ratingKey)
  const range = request.headers.get('range')
  const audio = path
    ? await fetchPlex(
        settings,
        path,
        range ? { Range: range } : {},
        request.signal,
      )
    : null

  return passAudio(audio, path && audio ? getAudioType(path, audio) : null)
}
