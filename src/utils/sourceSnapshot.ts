import fs from 'fs/promises'
import { isEqual, isPlainObject } from 'lodash'
import path from 'path'
import { getErrorCode, replaceFile } from './files'

// The statistics source's answers besides the plays, such as its libraries and
// users. They stand in for the source while it can't be reached, so the stats
// can still be shown from the saved plays.

type SnapshotFile = {
  version: number
  // By `source|url|…|name`, so another source's or URL's answers never stand in
  answers: Record<string, unknown>
}

type SnapshotState = {
  answers: Promise<Map<string, unknown>> | null
  droppedPrefixes: Map<string, string>
  saveTimer: ReturnType<typeof setTimeout> | null
  saving: Promise<void>
  hasLoggedSaveError: boolean
}

const VERSION = 1
// A page asks for several answers at once, which go into one save
const SAVE_DELAY = 1000
// Cap cached per-title metadata so long-running instances don't grow without limit
const MAX_MEDIA_ENTRIES = 5000
// Next.js can bundle this file into more than one chunk, and each copy would
// otherwise save its own answers.
const globalForSnapshot = globalThis as unknown as {
  rewindarrSourceSnapshot?: SnapshotState
}
const state = (globalForSnapshot.rewindarrSourceSnapshot ??= {
  answers: null,
  droppedPrefixes: new Map(),
  saveTimer: null,
  saving: Promise.resolve(),
  hasLoggedSaveError: false,
})

state.droppedPrefixes ??= new Map()

function isMediaKey(key: string): boolean {
  return key.includes('|media|')
}

function pruneMediaEntries(answers: Map<string, unknown>): boolean {
  let mediaCount = 0

  for (const key of answers.keys()) {
    if (isMediaKey(key)) {
      mediaCount++
    }
  }

  let excess = mediaCount - MAX_MEDIA_ENTRIES

  if (excess <= 0) {
    return false
  }

  for (const key of answers.keys()) {
    if (excess <= 0) {
      break
    }

    if (isMediaKey(key)) {
      answers.delete(key)
      excess--
    }
  }

  return true
}

export function getSnapshotFilePath(): string {
  return path.join(process.cwd(), 'config/source-snapshot.json')
}

function isSnapshotFile(file: unknown): file is SnapshotFile {
  return (
    isPlainObject(file) &&
    (file as SnapshotFile).version === VERSION &&
    isPlainObject((file as SnapshotFile).answers)
  )
}

// Empty when nothing was saved yet, or the file can't be read
async function readSnapshotFile(): Promise<Map<string, unknown>> {
  const filePath = getSnapshotFilePath()

  let file: unknown

  try {
    file = JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      console.warn(
        `[SNAPSHOT] - Unable to read the saved source answers from ${filePath}!`,
        error,
      )
    }

    return new Map()
  }

  if (!isSnapshotFile(file)) {
    console.warn(
      `[SNAPSHOT] - The saved source answers in ${filePath} aren't valid! They're saved again once the source answers.`,
    )

    return new Map()
  }

  const answers = new Map(Object.entries(file.answers))

  if (pruneMediaEntries(answers)) {
    saveSoon()
  }

  return answers
}

function getAnswers(): Promise<Map<string, unknown>> {
  state.answers ??= readSnapshotFile()

  return state.answers
}

async function writeSnapshotFile(): Promise<void> {
  const answers = await getAnswers()
  const file: SnapshotFile = {
    version: VERSION,
    answers: Object.fromEntries(answers),
  }
  const filePath = getSnapshotFilePath()

  try {
    await replaceFile(filePath, JSON.stringify(file))
    state.hasLoggedSaveError = false
  } catch (error) {
    if (!state.hasLoggedSaveError) {
      state.hasLoggedSaveError = true
      console.error(
        `[SNAPSHOT] - Unable to save the source answers to ${filePath}! Without them, the stats can't be shown while the source is down.`,
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
    state.saving = state.saving.then(writeSnapshotFile)
  }, SAVE_DELAY)
}

// Keeps the source's latest answer, which is only saved when it changed
export async function saveSnapshot(
  key: string,
  answer: unknown,
): Promise<void> {
  const answers = await getAnswers()
  const hasKey = answers.has(key)

  if (hasKey ? isEqual(answers.get(key), answer) : answer === undefined) {
    if (hasKey && isMediaKey(key)) {
      const existing = answers.get(key)

      answers.delete(key)
      answers.set(key, existing)
    }

    return
  }

  answers.delete(key)
  answers.set(key, answer)

  if (isMediaKey(key)) {
    pruneMediaEntries(answers)
  }

  const source = `${key.split('|')[0] ?? ''}|`
  const currentPrefix = state.droppedPrefixes.get(source)

  if (currentPrefix && !key.startsWith(currentPrefix)) {
    state.droppedPrefixes.delete(source)
  }

  saveSoon()
}

// The saved answer, or null without a valid one
export async function getSnapshot<T>(
  key: string,
  isValid: (answer: unknown) => answer is T,
): Promise<T | null> {
  const answers = await getAnswers()

  if (!answers.has(key)) {
    return null
  }

  const answer = answers.get(key)

  if (!isValid(answer)) {
    return null
  }

  if (isMediaKey(key)) {
    answers.delete(key)
    answers.set(key, answer)
  }

  return answer
}

// Drops a source's snapshots other than the current prefix, such as from an
// old URL or server, while keeping snapshots from other sources intact.
export async function dropStaleSnapshots(currentPrefix: string): Promise<void> {
  const source = `${currentPrefix.split('|')[0] ?? ''}|`

  if (source === '|' || state.droppedPrefixes.get(source) === currentPrefix) {
    return
  }

  const answers = await getAnswers()

  let deleted = false

  for (const key of answers.keys()) {
    if (key.startsWith(source) && !key.startsWith(currentPrefix)) {
      answers.delete(key)
      deleted = true
    }
  }

  state.droppedPrefixes.set(source, currentPrefix)

  if (deleted) {
    saveSoon()
  }
}

// Whether the source with this key prefix answered since snapshots were saved
export async function hasSnapshot(keyPrefix: string): Promise<boolean> {
  const answers = await getAnswers()

  return [...answers.keys()].some((key) => key.startsWith(`${keyPrefix}|`))
}

export function isObject<T>(answer: unknown): answer is T {
  return isPlainObject(answer)
}

export function isListOf<T>(answer: unknown): answer is T[] {
  return Array.isArray(answer) && answer.every(isPlainObject)
}

export function isString(answer: unknown): answer is string {
  return typeof answer === 'string'
}

export function isStringList(answer: unknown): answer is string[] {
  return Array.isArray(answer) && answer.every(isString)
}
