import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'tracearr|http://tracearr:3000|s1'
const users = [{ identityId: 'u1', plexId: '42', username: 'jane' }]

let directory: string

function filePath() {
  return path.join(directory, 'config/source-snapshot.json')
}

function writeFile(content: unknown) {
  fs.writeFileSync(filePath(), JSON.stringify(content, undefined, 2))
}

async function load() {
  return import('./sourceSnapshot')
}

// Lets the save run once its delay is over
async function waitForSave() {
  await vi.advanceTimersByTimeAsync(1000)
  await vi.waitFor(() => expect(fs.existsSync(filePath())).toBe(true))
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rewindarr-snapshot-'))
  fs.mkdirSync(path.join(directory, 'config'))
  vi.spyOn(process, 'cwd').mockReturnValue(directory)
  // The module keeps its state on globalThis, which outlives resetModules
  delete (globalThis as { rewindarrSourceSnapshot?: unknown })
    .rewindarrSourceSnapshot
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('sourceSnapshot', () => {
  it('saves an answer a moment after it changes', async () => {
    const { saveSnapshot, isListOf } = await load()

    await saveSnapshot(`${KEY}|users`, users)
    await saveSnapshot(`${KEY}|serverId`, 'abc')

    expect(fs.existsSync(filePath())).toBe(false)

    await waitForSave()

    expect(JSON.parse(fs.readFileSync(filePath(), 'utf8'))).toEqual({
      version: 1,
      answers: { [`${KEY}|users`]: users, [`${KEY}|serverId`]: 'abc' },
    })

    // After a restart, the saved answer stands in
    delete (globalThis as { rewindarrSourceSnapshot?: unknown })
      .rewindarrSourceSnapshot
    vi.resetModules()

    const { getSnapshot } = await load()

    await expect(getSnapshot(`${KEY}|users`, isListOf)).resolves.toEqual(users)
  })

  it('does not save an answer that did not change', async () => {
    writeFile({ version: 1, answers: { [`${KEY}|users`]: users } })

    const before = fs.readFileSync(filePath(), 'utf8')
    const { saveSnapshot } = await load()

    await saveSnapshot(`${KEY}|users`, structuredClone(users))
    await vi.advanceTimersByTimeAsync(1000)

    expect(fs.readFileSync(filePath(), 'utf8')).toBe(before)
  })

  it('gives nothing back for an answer of the wrong kind', async () => {
    writeFile({ version: 1, answers: { [`${KEY}|serverId`]: ['abc'] } })

    const { getSnapshot, isString } = await load()

    await expect(getSnapshot(`${KEY}|serverId`, isString)).resolves.toBeNull()
    await expect(getSnapshot(`${KEY}|users`, isString)).resolves.toBeNull()
  })

  it('ignores a file of another version', async () => {
    writeFile({ version: 2, answers: { [`${KEY}|serverId`]: 'abc' } })

    const { getSnapshot, hasSnapshot, isString } = await load()

    await expect(getSnapshot(`${KEY}|serverId`, isString)).resolves.toBeNull()
    await expect(hasSnapshot(KEY)).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  it('has a snapshot only for the whole key it was saved under', async () => {
    writeFile({ version: 1, answers: { [`${KEY}|users`]: users } })

    const { hasSnapshot } = await load()

    await expect(hasSnapshot(KEY)).resolves.toBe(true)
    await expect(hasSnapshot('tracearr|http://tracearr:3000|s')).resolves.toBe(
      false,
    )
  })

  it('goes on without saving when the file cannot be written', async () => {
    fs.rmSync(path.join(directory, 'config'), { recursive: true })

    const { getSnapshot, isString, saveSnapshot } = await load()

    await saveSnapshot(`${KEY}|serverId`, 'abc')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledTimes(1))

    // Still answered from memory
    await expect(getSnapshot(`${KEY}|serverId`, isString)).resolves.toBe('abc')
  })

  it('caps saved media entries with LRU eviction while keeping structural keys', async () => {
    const { getSnapshot, isObject, saveSnapshot } = await load()

    await saveSnapshot(`${KEY}|users`, users)
    await saveSnapshot(`${KEY}|serverId`, 'abc')

    for (let i = 0; i < 5005; i++) {
      if (i === 5000) {
        // Keep the oldest media entry hot once the cap is full so later writes
        // evict the least recently used entries instead of it.
        await expect(getSnapshot(`${KEY}|media|0`, isObject)).resolves.toEqual({
          id: 0,
        })
      }

      await saveSnapshot(`${KEY}|media|${i}`, { id: i })
    }

    await waitForSave()

    const saved = JSON.parse(fs.readFileSync(filePath(), 'utf8')).answers

    // Structural keys stay untouched even though they were saved first
    expect(saved[`${KEY}|users`]).toEqual(users)
    expect(saved[`${KEY}|serverId`]).toBe('abc')
    // Promoted media|0 stays while oldest unreferenced media entries are evicted
    expect(saved[`${KEY}|media|0`]).toEqual({ id: 0 })
    expect(saved[`${KEY}|media|1`]).toBeUndefined()
    expect(saved[`${KEY}|media|5`]).toBeUndefined()
    expect(saved[`${KEY}|media|6`]).toEqual({ id: 6 })
    expect(saved[`${KEY}|media|5004`]).toEqual({ id: 5004 })
    expect(
      Object.keys(saved).filter((key) => key.includes('|media|')),
    ).toHaveLength(5000)
  })

  it('prunes oversized media entries when loading a snapshot file from disk', async () => {
    const answers: Record<string, unknown> = { [`${KEY}|users`]: users }

    for (let i = 0; i < 5003; i++) {
      answers[`${KEY}|media|${i}`] = { id: i }
    }

    writeFile({ version: 1, answers })

    const { getSnapshot, isListOf, isObject } = await load()

    await expect(getSnapshot(`${KEY}|users`, isListOf)).resolves.toEqual(users)
    await expect(getSnapshot(`${KEY}|media|0`, isObject)).resolves.toBeNull()
    await expect(getSnapshot(`${KEY}|media|2`, isObject)).resolves.toBeNull()
    await expect(getSnapshot(`${KEY}|media|3`, isObject)).resolves.toEqual({
      id: 3,
    })

    // The oversized file on disk is scheduled to be shrunk
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => {
      const saved = JSON.parse(fs.readFileSync(filePath(), 'utf8')).answers

      expect(
        Object.keys(saved).filter((key) => key.includes('|media|')),
      ).toHaveLength(5000)
    })
  })

  it('drops stale snapshots from the same source while keeping other sources', async () => {
    writeFile({
      version: 1,
      answers: {
        [`${KEY}|users`]: users,
        'tracearr|http://old-tracearr:3000|s1|users': users,
        'tracearr|http://tracearr:3000|s2|libraries': [],
        'tautulli|http://tautulli:8181|users': users,
        'plex|http://plex:32400|serverId': 'plex-1',
      },
    })

    const { dropStaleSnapshots } = await load()

    await dropStaleSnapshots(`${KEY}|`)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() =>
      expect(
        Object.keys(JSON.parse(fs.readFileSync(filePath(), 'utf8')).answers),
      ).toEqual([
        `${KEY}|users`,
        'tautulli|http://tautulli:8181|users',
        'plex|http://plex:32400|serverId',
      ]),
    )
  })
})

describe('validators', () => {
  it('tells lists of objects and of strings apart', async () => {
    const { isListOf, isStringList } = await load()

    expect(isListOf([{ a: 1 }])).toBe(true)
    expect(isListOf(['a'])).toBe(false)
    expect(isStringList(['1', '2'])).toBe(true)
    expect(isStringList([1, 2])).toBe(false)
    expect(isStringList(null)).toBe(false)
  })
})
