import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import fs from 'fs'
import { cloneDeep } from 'lodash'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const canManageSettingsMock = vi.fn<() => Promise<boolean>>()
const canPlayRewindMock = vi.fn<() => Promise<boolean>>()
const getSettingsMock = vi.fn<() => Settings>()
const writeSettingsMock = vi.fn<(settings: Settings) => void>()

vi.mock('@/lib/access', () => ({
  canManageSettings: canManageSettingsMock,
  canPlayRewind: canPlayRewindMock,
}))
vi.mock('@/utils/getSettings', () => ({
  default: getSettingsMock,
  writeSettings: writeSettingsMock,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let directory: string
let musicPath: string
let route: typeof import('./route')

function settingsWithMusic(): Settings {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.music = {
    name: 'theme.mp3',
    type: 'audio/mpeg',
    size: 5,
    updatedAt: 1000,
  }

  return settings
}

beforeEach(async () => {
  vi.resetModules()
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rewindarr-music-'))
  fs.mkdirSync(path.join(directory, 'config'))
  musicPath = path.join(directory, 'config/rewind-music')

  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)

  try {
    route = await import('./route')
  } finally {
    cwd.mockRestore()
  }

  vi.spyOn(console, 'error').mockImplementation(() => {})
  canManageSettingsMock.mockResolvedValue(true)
  canPlayRewindMock.mockResolvedValue(true)
  getSettingsMock.mockReturnValue(cloneDeep(DEFAULT_SETTINGS))
  writeSettingsMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('/api/rewind/music', () => {
  describe('GET', () => {
    it('serves full and ranged audio responses', async () => {
      fs.writeFileSync(musicPath, '0123456789')
      getSettingsMock.mockReturnValue(settingsWithMusic())

      const full = await route.GET(
        new Request('http://localhost/api/rewind/music'),
      )

      expect(full.status).toBe(200)
      expect(full.headers.get('Content-Length')).toBe('10')
      expect(await full.text()).toBe('0123456789')

      const partial = await route.GET(
        new Request('http://localhost/api/rewind/music', {
          headers: { Range: 'bytes=2-5' },
        }),
      )

      expect(partial.status).toBe(206)
      expect(partial.headers.get('Content-Range')).toBe('bytes 2-5/10')
      expect(await partial.text()).toBe('2345')
    })

    it('returns 416 for unsatisfiable ranges and Content-Disposition on download', async () => {
      fs.writeFileSync(musicPath, '01234')
      getSettingsMock.mockReturnValue(settingsWithMusic())

      const badRange = await route.GET(
        new Request('http://localhost/api/rewind/music?download', {
          headers: { Range: 'bytes=99-' },
        }),
      )

      expect(badRange.status).toBe(416)
      expect(badRange.headers.get('Content-Range')).toBe('bytes */5')
      expect(badRange.headers.get('Content-Disposition')).toContain(
        'filename="theme.mp3"',
      )
    })

    it('streams the file it opened when the track is replaced or removed', async () => {
      fs.writeFileSync(musicPath, '0123456789')
      getSettingsMock.mockReturnValue(settingsWithMusic())

      const replaced = await route.GET(
        new Request('http://localhost/api/rewind/music'),
      )
      const tempPath = `${musicPath}.tmp`

      fs.writeFileSync(tempPath, 'new')
      fs.renameSync(tempPath, musicPath)

      expect(replaced.headers.get('Content-Length')).toBe('10')
      expect(await replaced.text()).toBe('0123456789')

      const removed = await route.GET(
        new Request('http://localhost/api/rewind/music', {
          headers: { Range: 'bytes=1-2' },
        }),
      )

      fs.rmSync(musicPath)

      expect(removed.status).toBe(206)
      expect(await removed.text()).toBe('ew')
    })

    it('returns 404 when the file is missing', async () => {
      getSettingsMock.mockReturnValue(settingsWithMusic())

      expect(
        (await route.GET(new Request('http://localhost/api/rewind/music')))
          .status,
      ).toBe(404)
    })

    it('returns 404 when empty or unauthorized', async () => {
      fs.writeFileSync(musicPath, '')
      getSettingsMock.mockReturnValue(settingsWithMusic())

      expect(
        (await route.GET(new Request('http://localhost/api/rewind/music')))
          .status,
      ).toBe(404)

      fs.writeFileSync(musicPath, '01234')
      canPlayRewindMock.mockResolvedValue(false)
      canManageSettingsMock.mockResolvedValue(false)

      expect(
        (
          await route.GET(
            new Request('http://localhost/api/rewind/music?download'),
          )
        ).status,
      ).toBe(404)
    })
  })

  describe('PUT', () => {
    it('rejects unauthorized requests', async () => {
      canManageSettingsMock.mockResolvedValue(false)

      const res = await route.PUT(
        new Request('http://localhost/api/rewind/music', { method: 'PUT' }),
      )

      expect(res.status).toBe(403)
    })

    it('returns 400 on malformed x-file-name encoding', async () => {
      const res = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: { 'x-file-name': '%E0%A4%A' },
          body: 'audio',
        }),
      )

      expect(res.status).toBe(400)
    })

    it('rejects unsupported file types with 415', async () => {
      const res = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: { 'x-file-name': 'evil.html', 'content-length': '5' },
          body: '<svg/>',
        }),
      )

      expect(res.status).toBe(415)
    })

    it('rejects 0-byte uploads and oversized Content-Length', async () => {
      const zeroLength = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: { 'x-file-name': 'song.mp3', 'content-length': '0' },
          body: new Uint8Array(0),
        }),
      )

      expect(zeroLength.status).toBe(400)
      await expect(zeroLength.json()).resolves.toEqual({ error: 'empty' })

      const emptyStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })
      const emptyChunked = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: { 'x-file-name': 'song.mp3' },
          body: emptyStream,
          // @ts-expect-error - required by undici for ReadableStream request bodies
          duplex: 'half',
        }),
      )

      expect(emptyChunked.status).toBe(400)
      await expect(emptyChunked.json()).resolves.toEqual({ error: 'empty' })

      const oversized = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: {
            'x-file-name': 'song.mp3',
            'content-length': String(100 * 1024 * 1024),
          },
          body: 'x',
        }),
      )

      expect(oversized.status).toBe(413)
    })

    it('accepts chunked uploads without a Content-Length header', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('mp3-data'))
          controller.close()
        },
      })
      const res = await route.PUT(
        new Request('http://localhost/api/rewind/music', {
          method: 'PUT',
          headers: { 'x-file-name': encodeURIComponent('my song.mp3') },
          body: stream,
          // @ts-expect-error - required by undici for ReadableStream request bodies
          duplex: 'half',
        }),
      )

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({
        music: { name: 'my song.mp3', type: 'audio/mpeg', size: 8 },
      })
      expect(fs.readFileSync(musicPath, 'utf-8')).toBe('mp3-data')
      expect(writeSettingsMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('DELETE', () => {
    it('enforces settings access and removes the saved music file', async () => {
      fs.writeFileSync(musicPath, 'mp3-data')
      getSettingsMock.mockReturnValue(settingsWithMusic())

      canManageSettingsMock.mockResolvedValueOnce(false)
      expect((await route.DELETE()).status).toBe(403)
      expect(fs.existsSync(musicPath)).toBe(true)

      const res = await route.DELETE()

      expect(res.status).toBe(200)
      expect(fs.existsSync(musicPath)).toBe(false)
      expect(writeSettingsMock).toHaveBeenCalledTimes(1)
    })
  })
})
