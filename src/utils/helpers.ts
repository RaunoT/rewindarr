import { DashboardSearchParams } from '@/types/dashboard'
import { RewindTotals, UserRewind } from '@/types/rewind'
import { PublicSettings, Settings, StatisticsSource } from '@/types/settings'
import { Library } from '@/types/statsSource'
import kebabCase from 'lodash/kebabCase'
import { Session } from 'next-auth'
import { SETTINGS_PAGES } from './constants'

function getSettingValue(settings: Settings, keyPath: string): unknown {
  let current: unknown = settings

  for (const segment of keyPath.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

const SOURCE_REQUIRED_SETTINGS: Record<StatisticsSource, string[]> = {
  tautulli: ['connection.tautulliUrl', 'connection.tautulliApiKey'],
  tracearr: ['connection.tracearrUrl', 'connection.tracearrApiKey'],
}
const REQUIRED_SETTINGS = [
  'connection.complete',
  'general.complete',
  'rewind.complete',
  'dashboard.customPeriod',
  'dashboard.complete',
  'activity.complete',
  'history.complete',
]

export function isTracearrSource(settings: Settings): boolean {
  return settings.connection.statisticsSource === 'tracearr'
}

// What a library goes by in URLs and in the saved active libraries
export function getLibrarySlug(library: Library): string {
  return kebabCase(library.section_name)
}

// In the order the admin sorted them in the settings
export function sortByActiveLibraries(
  libraries: Library[],
  settings: Settings,
): Library[] {
  return settings.general.activeLibraries
    .map((libSlug) => libraries.find((lib) => getLibrarySlug(lib) === libSlug))
    .filter((lib): lib is Library => lib !== undefined)
}

export type Feature = 'rewind' | 'dashboard' | 'activity' | 'history'

export type Viewer = {
  isLoggedIn: boolean
  isAdmin: boolean
}

export function getViewer(session: Session | null): Viewer {
  return { isLoggedIn: !!session, isAdmin: !!session?.user?.isAdmin }
}

// Layouts don't run for every request that renders a page or action, so pages
// and server actions check this too. A rewind is always someone's, so outside
// access doesn't open it up.
export function canViewFeature(
  settings: Pick<PublicSettings, 'general' | Feature>,
  feature: Feature,
  viewer: Viewer,
): boolean {
  const { isActive, isAdminOnly } = settings[feature]

  if (!isActive) {
    return false
  }

  if (isAdminOnly) {
    return viewer.isAdmin
  }

  // A visitor has nothing of their own to show
  if (isOwnOnlyFeature(feature) && settings[feature].isOwnOnly) {
    return viewer.isLoggedIn
  }

  return (
    viewer.isLoggedIn ||
    (feature !== 'rewind' && settings.general.isOutsideAccess)
  )
}

function isOwnOnlyViewer<F extends OwnOnlyFeature>(
  settings: Pick<PublicSettings, F>,
  feature: F,
  viewer: Viewer,
): boolean {
  const { isOwnOnly, isOwnOnlyForAdmin } = settings[feature]

  return (
    viewer.isLoggedIn && isOwnOnly && (!viewer.isAdmin || isOwnOnlyForAdmin)
  )
}

// A rewind is always the viewer's own
export type OwnOnlyFeature = Exclude<Feature, 'rewind'>

function isOwnOnlyFeature(feature: Feature): feature is OwnOnlyFeature {
  return feature !== 'rewind'
}

// The user whose own stats, streams or plays alone the page shows, or none
// for everyone's
export function getOwnOnlyUserId<F extends OwnOnlyFeature>(
  settings: Pick<PublicSettings, F>,
  feature: F,
  session: Session | null | undefined,
): string | undefined {
  if (!session || !isOwnOnlyViewer(settings, feature, getViewer(session))) {
    return undefined
  }

  return String(session.user.id)
}

const FEATURES: Feature[] = ['rewind', 'dashboard', 'activity', 'history']

// The users page is all about everyone else, so a viewer who only sees their
// own stats doesn't get it
export function isUsersPageVisible(
  settings: Pick<PublicSettings, 'dashboard'>,
  session: Session | null | undefined,
): boolean {
  return (
    settings.dashboard.isUsersPageActive &&
    !getOwnOnlyUserId(settings, 'dashboard', session)
  )
}

// A page a logged-out visitor can't open but a login could, so the proxy
// sends them to log in instead of to a missing page
export function isLoginRequired(settings: Settings, pathname: string): boolean {
  const section = pathname.split('/')[1]

  if (section === 'settings') {
    return !isInitialSetup(settings)
  }

  const feature = FEATURES.find((feature) => feature === section)

  return (
    !!feature &&
    !canViewFeature(settings, feature, { isLoggedIn: false, isAdmin: false }) &&
    canViewFeature(settings, feature, { isLoggedIn: true, isAdmin: true })
  )
}

// The home page's tiles, so it knows when it has none to show
export function getHomeTiles(
  settings: Pick<PublicSettings, 'general' | Feature>,
  viewer: Viewer,
  libraryCount: number,
) {
  return {
    rewind: canViewFeature(settings, 'rewind', viewer),
    activity: canViewFeature(settings, 'activity', viewer),
    history: canViewFeature(settings, 'history', viewer),
    libraries:
      canViewFeature(settings, 'dashboard', viewer) && libraryCount > 0,
  }
}

// The pages a viewer can open. A dashboard with no libraries and no users
// page for that viewer has nothing in it.
export function getOpenPages(
  settings: Pick<PublicSettings, 'general' | Feature>,
  viewer: Viewer,
): Feature[] {
  const hasUsersPage =
    settings.dashboard.isUsersPageActive &&
    !isOwnOnlyViewer(settings, 'dashboard', viewer)

  return FEATURES.filter(
    (feature) =>
      canViewFeature(settings, feature, viewer) &&
      (feature !== 'dashboard' ||
        settings.general.activeLibraries.length > 0 ||
        hasUsersPage),
  )
}

// With nothing else to show, the home page would only lead to Rewind, so
// Rewind takes its place
export function isRewindOnly(
  settings: Pick<PublicSettings, 'general' | Feature>,
  viewer: Viewer,
): boolean {
  const pages = getOpenPages(settings, viewer)

  return pages.length === 1 && pages[0] === 'rewind'
}

export function checkRequiredSettings(settings: Settings): string | null {
  const sourceRequiredSettings = isTracearrSource(settings)
    ? SOURCE_REQUIRED_SETTINGS.tracearr
    : SOURCE_REQUIRED_SETTINGS.tautulli
  // Plex's URL only adds links, but Jellyfin's is needed to sign in
  const serverRequiredSettings =
    settings.connection.mediaServerType === 'jellyfin'
      ? ['connection.jellyfinUrl']
      : []

  for (const key of [
    ...sourceRequiredSettings,
    ...serverRequiredSettings,
    ...REQUIRED_SETTINGS,
  ]) {
    if (!getSettingValue(settings, key)) {
      return key
    }
  }

  return null
}

// The other settings pages read their options from the statistics source
export function isSettingsPageLocked(
  key: string,
  settings: { connection: { complete: boolean } },
): boolean {
  return !settings.connection.complete && key !== 'connection'
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

// A reverse proxy chain can join headers like X-Forwarded-Proto with commas,
// with the client-facing hop first.
export function getFirstHeaderValue(value: string | null): string | undefined {
  const first = value?.split(',')[0].trim()

  return first || undefined
}

export function getSettingsPage(missingSettingKey: string): string | undefined {
  return SETTINGS_PAGES.find((page) => missingSettingKey.startsWith(page.key))
    ?.href
}

// The formatted durations in a rewind are always truthy ("0 mins"), so whether
// the user played anything comes from the play counts.
export function hasRewindPlays({
  shows,
  movies,
  audio,
}: Pick<RewindTotals, 'shows' | 'movies' | 'audio'>): boolean {
  return shows.count + movies.count + audio.count > 0
}

export type RewindBreakdownItem = {
  type: 'show' | 'movie' | 'artist'
  // The user's time or count, shown next to the type
  value: string
  // Of the user's total across the listed types, from 0 to 1, null when only
  // every user's is split
  share: number | null
  // What the user's share is compared with: the average user's share of their
  // own total, or every user's together when the user has none. Null without
  // anyone to compare with.
  otherShare: number | null
}

function sortBreakdown<T extends Omit<RewindBreakdownItem, 'value'>>(
  items: T[],
): T[] {
  return items.sort(
    (a, b) =>
      (b.share ?? 0) - (a.share ?? 0) ||
      (b.otherShare ?? 0) - (a.otherShare ?? 0),
  )
}

// Each user's split of their own total, averaged over the users with any, so
// a heavy user counts as much as a light one. Null with fewer than two such
// users, as there's nobody else to compare with.
export function getAverageShares<K extends string>(
  users: Partial<Record<K, number>>[],
  keys: readonly K[],
): Record<K, number> | null {
  const splits = users.flatMap((user) => {
    const total = keys.reduce((sum, key) => sum + (user[key] ?? 0), 0)

    return total > 0 ? [{ user, total }] : []
  })

  if (splits.length < 2) {
    return null
  }

  return Object.fromEntries(
    keys.map((key) => [
      key,
      splits.reduce(
        (sum, { user, total }) => sum + (user[key] ?? 0) / total,
        0,
      ) / splits.length,
    ]),
  ) as Record<K, number>
}

// The user's time split by media type next to the average user's, most played
// by the user first. The story is about the user, so a type they didn't play
// is left out even when others did, and without any time of the user's own
// there is nothing to split.
export function getRewindBreakdown({
  shows,
  movies,
  audio,
}: Pick<RewindTotals, 'shows' | 'movies' | 'audio'>): RewindBreakdownItem[] {
  const types = [
    { type: 'show' as const, ...shows },
    { type: 'movie' as const, ...movies },
    { type: 'artist' as const, ...audio },
  ].filter((item) => item.duration_value)
  const total = types.reduce((sum, item) => sum + (item.duration_value ?? 0), 0)

  if (!total) {
    return []
  }

  return sortBreakdown(
    types.map((item) => ({
      type: item.type,
      value: item.duration,
      share: (item.duration_value ?? 0) / total,
      otherShare: item.average_share,
    })),
  )
}

// The user's requests split by type next to the average user's, like the
// breakdown of the time, leaving out a type the user didn't request. Without
// requests of the user's own, every user's are split together instead, to go
// with their counts.
export function getRequestsBreakdown(
  requests: NonNullable<UserRewind['requests']>,
): (Omit<RewindBreakdownItem, 'value' | 'type'> & {
  type: 'movie' | 'show'
  count: number
})[] {
  const { user, averageShares } = requests
  const types = [
    {
      type: 'movie' as const,
      count: requests.movies,
      userCount: user.movies,
      averageShare: averageShares?.movies ?? null,
    },
    {
      type: 'show' as const,
      count: requests.shows,
      userCount: user.shows,
      averageShare: averageShares?.shows ?? null,
    },
  ]
  // Split over the listed types only, like the average user's, so requests of
  // any other type don't shrink one side's bars
  const userTotal = user.movies + user.shows
  const total = requests.movies + requests.shows

  return sortBreakdown(
    types
      .map((item) => ({
        type: item.type,
        count: userTotal ? item.userCount : item.count,
        share: userTotal ? item.userCount / userTotal : null,
        otherShare: userTotal ? item.averageShare : item.count / total,
      }))
      .filter((item) => item.count),
  )
}

// Of everyone who has a value, the user included. Null with nobody else to
// compare with.
export function getAverage(total: number, count: number): number | null {
  return count < 2 || total <= 0 ? null : total / count
}

// In percent, positive above the average and negative below it
export function getDifference(value: number, average: number): number {
  return Math.round(((value - average) * 100) / average)
}

export function isInitialSetup(settings: Settings): boolean {
  // Initial setup is when setupComplete is false, meaning the app has never been fully configured
  return !settings.setupComplete
}

export function isPostUpdateMissingSettings(settings: Settings): boolean {
  // Post-update missing settings is when setupComplete is true (app was configured before)
  // but there are currently missing required settings (new settings were added)
  return settings.setupComplete && checkRequiredSettings(settings) !== null
}

// Option lists read alphabetically, by the rules of the viewer's language
export function sortByLabel<T extends { label: string }>(
  items: T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale)

  return [...items].sort((a, b) => collator.compare(a.label, b.label))
}

// Plays are the default, so the URL and the saved filters only keep the others
export function getDashboardSort(
  value?: string | null,
): DashboardSearchParams['sortBy'] {
  return value === 'duration' || value === 'users' ? value : undefined
}
