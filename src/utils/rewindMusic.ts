import { RewindMusic, Settings } from '@/types/settings'
import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { REWIND_MUSIC_MAX_BYTES, REWIND_MUSIC_TYPES } from './constants'

export const REWIND_MUSIC_PATH = path.join(process.cwd(), 'config/rewind-music')
export const REWIND_MUSIC_URL = '/api/rewind/music'

export type ByteRange = {
  start: number
  end: number
}

// Plex's own theme songs, by the show's TVDB ID. Not every show has one.
export function getThemeSongUrl(tvdbId: number | null | undefined) {
  return tvdbId ? `https://tvthemes.plexapp.com/${tvdbId}.mp3` : null
}

// Null when there's no track, or its file has gone missing
export function getMusicUrl({ rewind }: Settings): string | null {
  if (!rewind.music || !fs.existsSync(REWIND_MUSIC_PATH)) {
    return null
  }

  return `${REWIND_MUSIC_URL}?v=${rewind.music.updatedAt}`
}

// Null for a file that isn't one of the audio types browsers can play
export function getMusicType(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  return Object.hasOwn(REWIND_MUSIC_TYPES, extension)
    ? REWIND_MUSIC_TYPES[extension]
    : null
}

// Safari only plays audio from servers that answer range requests. Multiple
// ranges are served whole, which browsers don't ask for anyway.
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | 'invalid' | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)

  if (!match || (!match[1] && !match[2])) {
    return null
  }

  const [, from, to] = match
  // "bytes=-500" is the last 500 bytes
  const start = from ? Number(from) : Math.max(size - Number(to), 0)
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1

  if (start >= size || start > end) {
    return 'invalid'
  }

  return { start, end }
}

// What another server's audio answers with that the browser needs for seeking
const PASSED_STATUSES = [200, 206, 416]
const PASSED_HEADERS = ['Content-Length', 'Content-Range', 'Accept-Ranges']

// Another server's audio, passed on with the parts of it the browser asked
// for. A 404 when there's none, or it isn't a type browsers can play.
export async function passAudio(
  audio: Response | null,
  type: string | null,
): Promise<Response> {
  if (!audio || !type || !PASSED_STATUSES.includes(audio.status)) {
    await audio?.body?.cancel()

    return new Response(null, { status: 404 })
  }

  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'private, max-age=86400',
    'Content-Security-Policy': 'sandbox',
  })

  for (const name of PASSED_HEADERS) {
    const value = audio.headers.get(name)

    if (value) {
      headers.set(name, value)
    }
  }

  return new Response(audio.body, { status: audio.status, headers })
}

class TooLargeError extends Error {}

function limitSize(maxBytes: number) {
  let size = 0

  return async function* (chunks: AsyncIterable<Uint8Array>) {
    for await (const chunk of chunks) {
      size += chunk.byteLength

      if (size > maxBytes) {
        throw new TooLargeError()
      }

      yield chunk
    }
  }
}

// Written to a temporary file first, so a failed upload keeps the old track.
export async function saveMusic(
  body: ReadableStream<Uint8Array>,
  name: string,
  type: string,
): Promise<RewindMusic | 'tooLarge' | 'empty'> {
  const tempPath = `${REWIND_MUSIC_PATH}.${randomBytes(6).toString('hex')}.tmp`

  try {
    await pipeline(
      Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
      limitSize(REWIND_MUSIC_MAX_BYTES),
      fs.createWriteStream(tempPath),
    )

    const { size } = fs.statSync(tempPath)

    if (size === 0) {
      fs.rmSync(tempPath, { force: true })

      return 'empty'
    }

    fs.renameSync(tempPath, REWIND_MUSIC_PATH)

    return { name, type, size, updatedAt: Date.now() }
  } catch (error) {
    fs.rmSync(tempPath, { force: true })

    if (error instanceof TooLargeError) {
      return 'tooLarge'
    }

    throw error
  }
}

export function removeMusic() {
  fs.rmSync(REWIND_MUSIC_PATH, { force: true })
}
