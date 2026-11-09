import { HistoryStatus } from '@/types/playHistory'
import { Settings, StatisticsSource } from '@/types/settings'
import {
  Activity,
  Library,
  MediaServer,
  ServerMembership,
  SourceUser,
  StatsSource,
} from '@/types/statsSource'
import getSettings from './getSettings'
import { getLibrarySlug } from './helpers'
import {
  getReadFrom,
  getReadProgress,
  getReadStatus,
  getUpdatedAt,
  readAgain,
  startReading,
} from './playHistory'
import { hasSnapshot } from './sourceSnapshot'
import tautulliSource from './tautulliSource'
import tracearrSource from './tracearrSource'

const SOURCES: Record<StatisticsSource, StatsSource> = {
  tautulli: tautulliSource,
  tracearr: tracearrSource,
}

// Tautulli is the default, so any other value falls back to it
function getSourceByName(source: string | undefined): StatsSource {
  return source && Object.hasOwn(SOURCES, source)
    ? SOURCES[source as StatisticsSource]
    : SOURCES.tautulli
}

export function getStatsSource(
  settings: Settings = getSettings(),
): StatsSource {
  return getSourceByName(settings.connection.statisticsSource)
}

export async function isStatsSourceReachable(
  settings: Settings = getSettings(),
): Promise<boolean> {
  return getStatsSource(settings).isReachable()
}

// The stats come from the source's play history, which is read once before a
// period can be shown. Null when the period can be shown, otherwise how far
// the read has got. Without libraries, every library's history counts. It
// waits a few seconds for the read, unless `timeout` says otherwise.
export async function getHistoryProgress(
  since: string | Date,
  libraries?: Library[],
  timeout?: number,
): Promise<HistoryStatus | null> {
  const sinceTime = new Date(since).getTime()

  if (!Number.isFinite(sinceTime)) {
    return null
  }

  const readers = await getStatsSource().getHistoryReaders(libraries)

  return getReadProgress(readers, sinceTime, timeout)
}

// How far back the history has every play, without waiting for a read. A
// period that starts after it can be shown straight away. Without libraries,
// every library's history counts.
export async function getHistoryReadFrom(
  libraries?: Library[],
): Promise<number> {
  return getReadFrom(await getStatsSource().getHistoryReaders(libraries))
}

// So that pages find the history ready, instead of starting on it themselves
export function startHistoryRead(settings: Settings = getSettings()): void {
  if (!settings.connection.complete) {
    return
  }

  getStatsSource(settings)
    .getHistoryReaders()
    .then(startReading)
    .catch((error) => {
      console.error('[HISTORY] - Unable to start reading the history!', error)
    })
}

// Each source keeps its history, so the one asked for can be another than
// the saved one, as long as its connection is saved too.
function getHistorySource(source?: StatisticsSource): StatsSource {
  return source ? getSourceByName(source) : getStatsSource()
}

export async function getHistoryStatus(
  source?: StatisticsSource,
): Promise<HistoryStatus> {
  return getReadStatus(await getHistorySource(source).getHistoryReaders())
}

// Reads the whole history again, or on from where it stopped
export async function readHistoryAgain(
  source?: StatisticsSource,
): Promise<void> {
  await readAgain(await getHistorySource(source).getHistoryReaders())
}

export async function getMediaServer(): Promise<MediaServer | null> {
  return getStatsSource().getMediaServer()
}

export async function getLibraries(excludeInactive = true): Promise<Library[]> {
  const settings = getSettings()
  const libraries = await getStatsSource(settings).getLibraries()
  const activeLibraries = settings.general.activeLibraries

  return excludeInactive
    ? libraries.filter((library) =>
        activeLibraries.includes(getLibrarySlug(library)),
      )
    : libraries
}

// Null when the source can't be reached and nothing was saved to stand in for
// it, which an empty list can't show
export async function getReachableLibraries(
  excludeInactive = true,
): Promise<Library[] | null> {
  const [libraries, isReachable, hasSaved] = await Promise.all([
    getLibraries(excludeInactive),
    isStatsSourceReachable(),
    hasSnapshot(getStatsSource().getSnapshotKey()),
  ])

  return isReachable || hasSaved ? libraries : null
}

// While the source can't be reached, the stats come from what was saved
export type SourceOutage = {
  // When the saved plays were last brought up to date, null without any
  updatedAt: number | null
}

// Null while the source answers, or when nothing was saved to stand in for it
export async function getSourceOutage(
  settings: Settings = getSettings(),
): Promise<SourceOutage | null> {
  if (!settings.connection.complete) {
    return null
  }

  const source = getStatsSource(settings)
  const [isReachable, hasSaved] = await Promise.all([
    isStatsSourceReachable(settings),
    hasSnapshot(source.getSnapshotKey()),
  ])

  if (isReachable || !hasSaved) {
    return null
  }

  return { updatedAt: await getUpdatedAt(await source.getHistoryReaders()) }
}

// Includes excluded users, so that the settings can list them.
export async function getUsers(
  settings: Settings = getSettings(),
): Promise<SourceUser[]> {
  return getStatsSource(settings).getUsers()
}

export async function getActiveUsers(
  settings: Settings = getSettings(),
): Promise<SourceUser[]> {
  const users = await getUsers(settings)
  const excludedUsers = settings.general.excludedUsers

  return users.filter((user) => !excludedUsers.includes(String(user.user_id)))
}

export async function getServerUser(
  userId: string,
  email: string,
): Promise<ServerMembership> {
  return getStatsSource().getServerUser(userId, email)
}

export async function getUsersCount(settings: Settings) {
  if (settings.dashboard.activeTotalStatistics.includes('count')) {
    const users = await getActiveUsers(settings)

    return users.length
  }

  return undefined
}

export async function getActivity(): Promise<Activity | null> {
  return getStatsSource().getActivity()
}
