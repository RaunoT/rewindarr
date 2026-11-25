import { Settings } from '@/types/settings'
import { Library, TopItemsQuery } from '@/types/statsSource'
import { clamp } from 'lodash'
import { getTranslations } from 'next-intl/server'
import {
  DASHBOARD_MAX_ITEMS,
  DASHBOARD_PAGE_SIZE,
  SEERR_MEDIA_TYPES,
} from './constants'
import { fetchSeerrStats, fetchSeerrUserId } from './fetchSeerr'
import { bytesToSize } from './formatting'
import { getStatsSource } from './statsSource'

export async function getItems(library: Library, query: TopItemsQuery) {
  return getStatsSource().getTopItems(library, query)
}

// How many rows a dashboard list shows, from its `limit` search parameter
export function getItemsLimit(limitSearchParam?: string): number {
  const limit = Number(limitSearchParam)

  if (!Number.isInteger(limit)) {
    return DASHBOARD_PAGE_SIZE
  }

  return clamp(limit, DASHBOARD_PAGE_SIZE, DASHBOARD_MAX_ITEMS)
}

// The limit "Show more" leads to, if there's more to show
export function getNextItemsLimit(
  limit: number,
  hasMore: boolean,
): number | undefined {
  return hasMore && limit < DASHBOARD_MAX_ITEMS
    ? Math.min(limit + DASHBOARD_PAGE_SIZE, DASHBOARD_MAX_ITEMS)
    : undefined
}

export async function getTotalDuration(
  library: Library,
  period: string,
  settings: Settings,
  userId?: string,
) {
  if (settings.dashboard.activeTotalStatistics.includes('duration')) {
    return getStatsSource(settings).getTotalDuration({
      since: period,
      userId: userId || undefined,
      libraries: [library],
    })
  }

  return undefined
}

// Seerr requests aren't tied to a library, so a library counts the
// requests of its media type. Without a library, every request counts.
export async function getTotalRequests(
  period: string,
  settings: Settings,
  library?: Library,
  userId?: string,
) {
  const { seerrUrl, seerrApiKey } = settings.connection
  const mediaType = library && SEERR_MEDIA_TYPES[library.section_type]

  if (
    !settings.dashboard.activeTotalStatistics.includes('requests') ||
    !seerrUrl ||
    !seerrApiKey ||
    (library && !mediaType)
  ) {
    return undefined
  }

  let endpoint = 'request'

  if (userId) {
    const seerrUserId = await fetchSeerrUserId(userId)

    // Users who never signed in to Seerr have nothing to count
    if (!seerrUserId) {
      return undefined
    }

    endpoint = `user/${seerrUserId}/requests`
  }

  const requests = await fetchSeerrStats(endpoint, period)

  if (!requests) {
    return undefined
  }

  return mediaType
    ? requests.filter((request) => request.type === mediaType).length
    : requests.length
}

// The library's movies, episodes or tracks, or for one user how many of them
// they played in the period
export async function getTotalCount(
  library: Library,
  period: string,
  settings: Settings,
  userId?: string,
) {
  if (!settings.dashboard.activeTotalStatistics.includes('count')) {
    return undefined
  }

  if (userId) {
    return getStatsSource(settings).getPlayedCount(library, {
      since: period,
      userId,
    })
  }

  return Number(
    library.section_type === 'movie' ? library.count : library.child_count,
  )
}

// A library's size says nothing about one user, so it's left out for them
export async function getTotalSize(
  library: Library,
  settings: Settings,
  userId?: string,
) {
  if (settings.dashboard.activeTotalStatistics.includes('size') && !userId) {
    const t = await getTranslations()
    const { size, isPartial } = await getStatsSource(settings).getLibrariesSize(
      [library],
    )
    const formattedSize = bytesToSize(size, 2, t)

    // A Tracearr library spans every media server library of its type, so
    // only some of them can be missing a size.
    return formattedSize && isPartial
      ? t('Dashboard.sizePartial', { size: formattedSize })
      : formattedSize
  }

  return undefined
}
