import { createHmac, timingSafeEqual } from 'crypto'
import fs from 'fs/promises'
import { isEqual, isPlainObject, orderBy, sumBy, uniq, uniqBy } from 'lodash'
import path from 'path'
import { REWIND_MUSIC_TYPES } from './constants'
import fetchTmdb from './fetchTmdb'
import { getErrorCode, replaceFile } from './files'
import { normalizeTitle, SoundtrackTitle } from './musicPreviewMatch'
import {
  fetchDeezerPreview,
  isPreviewUrl,
  MusicPreview,
  searchSong,
  searchSoundtrack,
} from './musicPreviewSources'
import { passAudio } from './rewindMusic'

// Rewind's music for what the media server and Plex's theme songs can't play:
// a preview of a movie's or show's soundtrack, or of a song. Which track it is
// gets saved, so each is only searched for once.

// What a preview is of. A movie and a show go by their TMDB ID.
export type PreviewItem =
  | { kind: 'movie' | 'show'; tmdbId: number }
  | { kind: 'song'; artist: string; title: string }

type SavedPreview = {
  // Null for an item without one
  preview: MusicPreview | null
  checkedAt: number
}

type PreviewFile = {
  version: number
  // By `movie:603`, `show:1399` and `song:artist|title`
  previews: Record<string, SavedPreview>
}

type PreviewLink = {
  url: string
  expiresAt: number
}

type PreviewState = {
  saved: Promise<Map<string, SavedPreview>> | null
  saveTimer: ReturnType<typeof setTimeout> | null
  saving: Promise<void>
  hasLoggedSaveError: boolean
  // The searches under way, so an item asked for twice is searched for once
  searches: Map<string, Promise<MusicPreview | null>>
  // The titles being read from TMDB, and the ones waiting to be
  reading: number
  waiting: (() => void)[]
  // Deezer's links by track
  links: Map<number, Promise<PreviewLink | null>>
  warnedAt: number
}

type TmdbMovie = {
  title?: string
  original_title?: string
  release_date?: string
  credits?: { crew?: { name?: string; job?: string }[] }
}

type TmdbShow = {
  name?: string
  original_name?: string
  first_air_date?: string
  // A show's crew has a job per season
  aggregate_credits?: {
    crew?: {
      name?: string
      jobs?: { job?: string; episode_count?: number }[]
    }[]
  }
}

export const PREVIEW_URL = '/api/rewind/preview'

const VERSION = 1
// A page asks for several previews at once, which go into one save
const SAVE_DELAY = 1000
// Music gets added to the services, and previews taken down
const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MISSING_TTL_MS = 7 * 24 * 60 * 60 * 1000
// The oldest are dropped beyond this, so the file stays small
const MAX_SAVED = 5000
// A Rewind asks for dozens of titles at once, which TMDB rate-limits. The
// searches after it wait their turn at each service instead.
const TITLE_CONCURRENCY = 8
// How long the browser is kept waiting for a search. The player gives up on
// music that fails for as long as the Rewind is open, so it's long enough
// for a Rewind's worth of searches. A search goes on after it, and the
// preview plays the next time.
const SEARCH_WAIT_MS = 30 * 1000
// What a service answers for a preview it took down
const GONE_STATUSES = [403, 404, 410]
// Only how long the service has to start answering
const PREVIEW_TIMEOUT_MS = 10 * 1000
// A link is asked for again before it stops working
const LINK_MARGIN_MS = 60 * 1000
// For a link that doesn't say when it stops working
const LINK_TTL_MS = 5 * 60 * 1000
const WARN_INTERVAL_MS = 60 * 1000
const COMPOSER_JOBS = [
  'Original Music Composer',
  'Main Title Theme Composer',
  'Music',
  'Composer',
]
const SAVED_KEY = /^((movie|show):\d+|song:.+)$/
// Next.js can bundle this file into more than one chunk, and each copy would
// otherwise search and save on its own.
const globalForPreviews = globalThis as unknown as {
  rewindarrMusicPreviews?: PreviewState
}
const state: PreviewState = (globalForPreviews.rewindarrMusicPreviews ??= {
  saved: null,
  saveTimer: null,
  saving: Promise.resolve(),
  hasLoggedSaveError: false,
  searches: new Map(),
  reading: 0,
  waiting: [],
  links: new Map(),
  warnedAt: 0,
})

export function getPreviewFilePath(): string {
  return path.join(process.cwd(), 'config/music-previews.json')
}

// Null for a movie or show TMDB doesn't know
export function toSoundtrackItem(
  kind: 'movie' | 'show',
  tmdbId: number | null | undefined,
): PreviewItem | null {
  return tmdbId ? { kind, tmdbId } : null
}

// Null for a song without an artist, which a search by its title alone could
// mistake for another's
export function toSongItem(
  song: { artist: string | null; title: string } | null | undefined,
): PreviewItem | null {
  return song?.artist && song.title
    ? { kind: 'song', artist: song.artist, title: song.title }
    : null
}

// The item's fields as JSON, so no two items sign the same
function sign(item: PreviewItem): Buffer {
  const fields =
    item.kind === 'song'
      ? [item.kind, item.artist, item.title]
      : [item.kind, item.tmdbId]

  return createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(`preview:${JSON.stringify(fields)}`)
    .digest()
}

function isSigned(item: PreviewItem, signature: string): boolean {
  if (!process.env.NEXTAUTH_SECRET) {
    return false
  }

  const expected = sign(item)
  const given = Buffer.from(signature, 'base64url')

  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Signed, so viewers can only have the titles and songs their Rewind picked
// searched for, not any ID or text
export function getPreviewUrl(item: PreviewItem): string | null {
  if (!process.env.NEXTAUTH_SECRET) {
    return null
  }

  const params = new URLSearchParams(
    item.kind === 'song'
      ? { artist: item.artist, title: item.title }
      : { [item.kind]: String(item.tmdbId) },
  )

  params.set('sig', sign(item).toString('base64url'))

  return `${PREVIEW_URL}?${params}`
}

function readItem(params: URLSearchParams): PreviewItem | null {
  for (const kind of ['movie', 'show'] as const) {
    const tmdbId = params.get(kind)

    if (tmdbId !== null) {
      return /^[1-9]\d{0,9}$/.test(tmdbId)
        ? { kind, tmdbId: Number(tmdbId) }
        : null
    }
  }

  const artist = params.get('artist')
  const title = params.get('title')

  return artist && title ? { kind: 'song', artist, title } : null
}

// The item a preview URL is for. Null for one that isn't valid, or that
// Rewind didn't sign.
export function parsePreviewItem(params: URLSearchParams): PreviewItem | null {
  const item = readItem(params)

  return item && isSigned(item, params.get('sig') ?? '') ? item : null
}

function getKey(item: PreviewItem): string {
  return item.kind === 'song'
    ? `song:${normalizeTitle(item.artist)}|${normalizeTitle(item.title)}`
    : `${item.kind}:${item.tmdbId}`
}

function isMusicPreview(preview: unknown): preview is MusicPreview | null {
  if (preview === null) {
    return true
  }

  if (!isPlainObject(preview)) {
    return false
  }

  const { source, id, url } = preview as Record<string, unknown>

  return source === 'deezer'
    ? Number.isSafeInteger(id)
    : source === 'itunes' && isPreviewUrl(url)
}

function isSavedPreview(saved: unknown): saved is SavedPreview {
  return (
    isPlainObject(saved) &&
    typeof (saved as SavedPreview).checkedAt === 'number' &&
    isMusicPreview((saved as SavedPreview).preview)
  )
}

// Empty when nothing was saved yet, or the file can't be read
async function readPreviewFile(): Promise<Map<string, SavedPreview>> {
  const filePath = getPreviewFilePath()
  const saved = new Map<string, SavedPreview>()

  let file: unknown

  try {
    file = JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      console.warn(
        `[PREVIEW] - Unable to read the saved music previews from ${filePath}!`,
        error,
      )
    }

    return saved
  }

  if (
    !isPlainObject(file) ||
    (file as PreviewFile).version !== VERSION ||
    !isPlainObject((file as PreviewFile).previews)
  ) {
    return saved
  }

  const { previews } = file as PreviewFile

  for (const [key, preview] of Object.entries(previews)) {
    if (SAVED_KEY.test(key) && isSavedPreview(preview)) {
      saved.set(key, preview)
    }
  }

  return saved
}

function getSaved(): Promise<Map<string, SavedPreview>> {
  state.saved ??= readPreviewFile()

  return state.saved
}

async function writePreviewFile(): Promise<void> {
  const file: PreviewFile = {
    version: VERSION,
    previews: Object.fromEntries(await getSaved()),
  }
  const filePath = getPreviewFilePath()

  try {
    await replaceFile(filePath, JSON.stringify(file))
    state.hasLoggedSaveError = false
  } catch (error) {
    if (!state.hasLoggedSaveError) {
      state.hasLoggedSaveError = true
      console.error(
        `[PREVIEW] - Unable to save the music previews to ${filePath}! Without them, each is searched for again after a restart.`,
        error,
      )
    }
  }
}

function saveSoon(): void {
  if (state.saveTimer) {
    return
  }

  state.saveTimer = setTimeout(() => {
    state.saveTimer = null
    state.saving = state.saving.then(writePreviewFile)
  }, SAVE_DELAY)
}

async function save(key: string, preview: MusicPreview | null): Promise<void> {
  const saved = await getSaved()

  // Moved to the end, so the ones checked the longest ago come first
  saved.delete(key)
  saved.set(key, { preview, checkedAt: Date.now() })

  for (const oldest of saved.keys()) {
    if (saved.size <= MAX_SAVED) {
      break
    }

    saved.delete(oldest)
  }

  saveSoon()
}

function isStale({ preview, checkedAt }: SavedPreview): boolean {
  return Date.now() - checkedAt > (preview ? FOUND_TTL_MS : MISSING_TTL_MS)
}

function toYear(date: string | undefined): number | null {
  return Number(date?.slice(0, 4)) || null
}

async function getMovie(tmdbId: number): Promise<SoundtrackTitle | null> {
  const movie = await fetchTmdb<TmdbMovie>(`movie/${tmdbId}`, {
    append_to_response: 'credits',
  })

  if (!movie?.title) {
    return null
  }

  return {
    kind: 'movie',
    titles: uniq([movie.title, movie.original_title ?? movie.title]),
    year: toYear(movie.release_date),
    composers: uniq(
      (movie.credits?.crew ?? [])
        .filter(({ job }) => !!job && COMPOSER_JOBS.includes(job))
        .flatMap(({ name }) => (name ? [name] : [])),
    ),
  }
}

// Whoever scored the most episodes comes first
async function getShow(tmdbId: number): Promise<SoundtrackTitle | null> {
  const show = await fetchTmdb<TmdbShow>(`tv/${tmdbId}`, {
    append_to_response: 'aggregate_credits',
  })

  if (!show?.name) {
    return null
  }

  const composers = (show.aggregate_credits?.crew ?? []).flatMap((member) => {
    const jobs = (member.jobs ?? []).filter(
      ({ job }) => !!job && COMPOSER_JOBS.includes(job),
    )

    return member.name && jobs.length
      ? [{ name: member.name, episodes: sumBy(jobs, 'episode_count') }]
      : []
  })

  return {
    kind: 'show',
    titles: uniq([show.name, show.original_name ?? show.name]),
    year: toYear(show.first_air_date),
    composers: uniq(orderBy(composers, 'episodes', 'desc').map((c) => c.name)),
  }
}

async function takeTurn<T>(task: () => Promise<T>): Promise<T> {
  while (state.reading >= TITLE_CONCURRENCY) {
    await new Promise<void>((resolve) => state.waiting.push(resolve))
  }

  state.reading += 1

  try {
    return await task()
  } finally {
    state.reading -= 1
    state.waiting.shift()?.()
  }
}

// What a soundtrack is searched by. Null when TMDB can't say.
function getTitle(
  item: Exclude<PreviewItem, { kind: 'song' }>,
): Promise<SoundtrackTitle | null> {
  return takeTurn(() =>
    item.kind === 'movie' ? getMovie(item.tmdbId) : getShow(item.tmdbId),
  )
}

// A service that's down would otherwise warn once per item
function warn(key: string, error: unknown): void {
  if (Date.now() - state.warnedAt < WARN_INTERVAL_MS) {
    return
  }

  state.warnedAt = Date.now()
  console.warn(
    `[PREVIEW] - Couldn't search for the music of '${key}'! It's searched for again the next time.`,
    error,
  )
}

// A search that couldn't be made isn't saved, and leaves what was saved
async function search(
  item: PreviewItem,
  previous: SavedPreview | undefined,
): Promise<MusicPreview | null> {
  const key = getKey(item)

  try {
    let preview: MusicPreview | null

    if (item.kind === 'song') {
      preview = await searchSong(item)
    } else {
      const title = await getTitle(item)

      if (!title) {
        return previous?.preview ?? null
      }

      preview = await searchSoundtrack(title)
    }

    await save(key, preview)

    return preview
  } catch (error) {
    warn(key, error)

    return previous?.preview ?? null
  }
}

// The item's saved preview, searched for when it isn't or it's been a while.
// Null without one.
export async function findPreview(
  item: PreviewItem,
): Promise<MusicPreview | null> {
  const key = getKey(item)
  const previous = (await getSaved()).get(key)

  if (previous && !isStale(previous)) {
    return previous.preview
  }

  let searching = state.searches.get(key)

  if (!searching) {
    searching = search(item, previous).finally(() => state.searches.delete(key))
    state.searches.set(key, searching)
  }

  return searching
}

// Searched for while the page is read, so they're ready when their stories
// show
export function warmPreviews(items: PreviewItem[]): void {
  for (const item of uniqBy(items, getKey)) {
    void findPreview(item).catch(() => null)
  }
}

// Deezer's links carry when they stop working, in seconds
function getExpiry(url: string): number {
  const expiry = Number(url.match(/exp=(\d+)/)?.[1]) * 1000

  return (expiry || Date.now() + LINK_TTL_MS) - LINK_MARGIN_MS
}

// Dropped only while it's still the item's pick, as a search may have saved
// another since
async function forget(item: PreviewItem, preview: MusicPreview): Promise<void> {
  const saved = await getSaved()
  const key = getKey(item)

  if (isEqual(saved.get(key)?.preview, preview)) {
    saved.delete(key)
    saveSoon()
  }
}

// Null when Deezer couldn't be asked, or no longer has the track, in which
// case the item is searched for again
async function fetchDeezerLink(
  item: PreviewItem,
  id: number,
): Promise<PreviewLink | null> {
  let url: string | null

  try {
    url = await fetchDeezerPreview(id)
  } catch {
    return null
  }

  if (!url) {
    await forget(item, { source: 'deezer', id })

    return null
  }

  return { url, expiresAt: getExpiry(url) }
}

// The browser asks for parts of a preview at a time, which share one request
// for the link
async function getDeezerLink(
  item: PreviewItem,
  id: number,
): Promise<string | null> {
  const cached = state.links.get(id)
  const link = cached && (await cached)

  if (link && link.expiresAt > Date.now()) {
    return link.url
  }

  let request = state.links.get(id)

  // Another part may have asked for a new link meanwhile
  if (!request || request === cached) {
    const refresh: Promise<PreviewLink | null> = fetchDeezerLink(item, id).then(
      (fresh) => {
        if (!fresh && state.links.get(id) === refresh) {
          state.links.delete(id)
        }

        return fresh
      },
    )

    request = refresh
    state.links.set(id, request)
  }

  return (await request)?.url ?? null
}

// A redirect isn't followed, as only the services' own hosts are fetched
async function fetchAudio(
  url: string,
  request: Request,
): Promise<Response | null> {
  const range = request.headers.get('range')
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), PREVIEW_TIMEOUT_MS)

  try {
    return await fetch(url, {
      headers: range ? { Range: range } : {},
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, timeout.signal]),
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// By the file's extension, as the services name the types their own way.
// Null for a file browsers can't play.
function getAudioType(url: string, response: Response): string | null {
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? ''

  if (Object.hasOwn(REWIND_MUSIC_TYPES, extension)) {
    return REWIND_MUSIC_TYPES[extension]
  }

  const type = response.headers.get('content-type') ?? ''

  return type.startsWith('audio/') ? type : null
}

// Null once the time is up or the browser has gone
async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  signal: AbortSignal,
): Promise<T | null> {
  if (signal.aborted) {
    return null
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let giveUp = () => {}

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        giveUp = () => resolve(null)
        timer = setTimeout(giveUp, ms)
        signal.addEventListener('abort', giveUp, { once: true })
      }),
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', giveUp)
  }
}

// The preview as its service serves it, passed on with the parts of it the
// browser asked for, so the browser isn't sent to the service itself. A 404
// without one.
export async function streamPreview(
  item: PreviewItem,
  request: Request,
): Promise<Response> {
  const preview = await withDeadline(
    findPreview(item),
    SEARCH_WAIT_MS,
    request.signal,
  )
  const url =
    preview?.source === 'deezer'
      ? await getDeezerLink(item, preview.id)
      : (preview?.url ?? null)
  const audio = url ? await fetchAudio(url, request) : null

  // A link that stopped working early is asked for again, and a preview
  // that was taken down searched for again
  if (preview?.source === 'deezer' && audio && audio.status >= 400) {
    state.links.delete(preview.id)
  } else if (preview && audio && GONE_STATUSES.includes(audio.status)) {
    await forget(item, preview)
  }

  return passAudio(audio, url && audio ? getAudioType(url, audio) : null)
}
