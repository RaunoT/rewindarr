import { TopTrack } from '@/types/rewind'
import { Library, MediaStatsType, PlayPeriod } from '@/types/statsSource'
import { groupBy, maxBy } from 'lodash'
import { getLocale, getTranslations } from 'next-intl/server'
import { cache } from 'react'
import { fetchSeerrStats, getMediaUserIds } from './fetchSeerr'
import { formatPercent, secondsToTime } from './formatting'
import getSettings from './getSettings'
import { getAverage, getAverageShares, getDifference } from './helpers'
import { LibrariesSize } from './librariesSize'
import { isCountedPlay } from './playStats'
import { getStatsSource } from './statsSource'

export async function getTopMediaStats(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
) {
  const t = await getTranslations()
  const locale = await getLocale()
  const stats = await getStatsSource().getMediaStats(userId, libraries, period)
  // Shares of the user's own playtime, so they add up across the libraries
  const totalDuration = Object.values(stats).reduce(
    (sum, { duration }) => sum + (duration ?? 0),
    0,
  )

  function formatStats(type: MediaStatsType) {
    const { count, duration } = stats[type]
    const percentage =
      duration && totalDuration
        ? Math.round((duration * 100) / totalDuration)
        : 0

    return {
      count,
      duration: duration === null ? '' : secondsToTime(duration, t),
      durationValue: duration,
      // "0%" would read as if nothing was played
      percentage: percentage > 0 ? formatPercent(percentage, locale) : '',
    }
  }

  return {
    shows: formatStats('shows'),
    movies: formatStats('movies'),
    audio: formatStats('audio'),
  }
}

export async function getlibrariesTotalSize(
  libraries: Library[],
): Promise<LibrariesSize> {
  return getStatsSource().getLibrariesSize(libraries)
}

type MediaDurations = Partial<Record<MediaStatsType, number>>

const MEDIA_SECTION_TYPES = {
  shows: 'show',
  movies: 'movie',
  audio: 'artist',
} as const

// Each user's time on each media type in seconds, by their ID, without
// excluded users. Null when the users can't be ranked.
export async function getUsersDurationByType(
  libraries: Library[],
  period: PlayPeriod,
): Promise<Map<string, MediaDurations> | null> {
  const source = getStatsSource()
  const rankings = await Promise.all(
    Object.entries(MEDIA_SECTION_TYPES).map(async ([type, sectionType]) => {
      const typeLibraries = libraries.filter(
        (library) => library.section_type === sectionType,
      )

      return {
        type: type as MediaStatsType,
        users: typeLibraries.length
          ? await source.getTopUsers({ ...period, libraries: typeLibraries })
          : [],
      }
    }),
  )

  if (rankings.some(({ users }) => users === null)) {
    return null
  }

  const durations = new Map<string, MediaDurations>()

  for (const { type, users } of rankings) {
    for (const user of users ?? []) {
      const id = String(user.user_id)

      durations.set(id, { ...durations.get(id), [type]: user.total_duration })
    }
  }

  return durations
}

export async function getUserTotalDuration(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
) {
  return getStatsSource().getTotalDuration({ ...period, userId, libraries })
}

export async function getTopMediaItems(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
) {
  return getStatsSource().getTopMediaItems(userId, libraries, period)
}

export async function getTopPeople(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
) {
  return getStatsSource().getTopPeople(userId, libraries, period)
}

// The user's most played track, by plays and then listening time. Like the
// other stats, plays short of the percent in the settings only add their
// listening time. Without a track played twice, it's the one with the most
// listening time, also from plays that don't count.
export async function getTopTrack(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
): Promise<TopTrack | null> {
  const settings = getSettings()
  const audioLibraries = libraries.filter(
    (library) => library.section_type === 'artist',
  )

  if (!audioLibraries.length) {
    return null
  }

  const plays = await getStatsSource(settings).getHistoryPlays({
    ...period,
    userId,
    libraries: audioLibraries,
  })
  const tracks = new Map<string, TopTrack>()

  for (const play of plays) {
    if (play.mediaType !== 'track') {
      continue
    }

    // Jellyfin's plays through Tracearr may have no rating key
    const key =
      play.ratingKey ?? play.mediaId ?? `${play.artistName}|${play.title}`
    const track = tracks.get(key) ?? {
      ratingKey: play.ratingKey,
      title: play.title,
      artist: play.artistName,
      plays: 0,
      durationMs: 0,
      isOnly: false,
    }

    if (isCountedPlay(play, settings.general.minPlayPercent)) {
      track.plays += 1
    }

    track.durationMs += play.durationMs
    tracks.set(key, track)
  }

  let top: TopTrack | null = null
  let countedTracks = 0

  for (const track of tracks.values()) {
    if (!track.plays) {
      continue
    }

    countedTracks += 1

    if (
      !top ||
      track.plays > top.plays ||
      (track.plays === top.plays && track.durationMs > top.durationMs)
    ) {
      top = track
    }
  }

  if (!top) {
    return null
  }

  const isOnly = countedTracks === 1

  if (top.plays === 1 && !isOnly) {
    top = maxBy([...tracks.values()], 'durationMs') ?? top
  }

  return { ...top, isOnly }
}

// Anonymizing hides who the match would name, so it isn't looked for
export async function getGenres(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
) {
  const settings = getSettings()

  return getStatsSource(settings).getGenres(
    userId,
    libraries,
    period,
    !settings.general.isAnonymized,
  )
}

function peakIndex(totals: number[]): number | null {
  if (!totals.length) {
    return null
  }

  let maxIndex = 0

  for (let i = 1; i < totals.length; i++) {
    if (totals[i] > totals[maxIndex]) {
      maxIndex = i
    }
  }

  return totals[maxIndex] > 0 ? maxIndex : null
}

export async function getPlaybackHabits(
  userId: string,
  libraries: Library[],
  period: PlayPeriod,
  timeZone?: string,
) {
  const { hourly, daily } = await getStatsSource().getPlaysByTime(
    userId,
    libraries,
    period,
    timeZone,
  )

  return {
    peakHour: peakIndex(hourly),
    peakDayIndex: peakIndex(daily),
    totalPlays: hourly.reduce((sum, plays) => sum + plays, 0),
    hourly,
    daily,
  }
}

// The timeout signal opts Seerr's requests out of fetch's per-render
// deduplication, so the requests' totals and reach share one read.
export const fetchRewindRequests = cache((since: string, until?: string) =>
  fetchSeerrStats('request', since, until),
)

function countRequests(requests: { type: string }[]) {
  return {
    total: requests.length,
    movies: requests.filter((request) => request.type === 'movie').length,
    shows: requests.filter((request) => request.type === 'tv').length,
  }
}

export async function getRequestsTotals(userId: string, period: PlayPeriod) {
  const settings = getSettings()
  const requests = await fetchRewindRequests(period.since, period.until)

  if (!requests) {
    return null
  }

  const isOwn = (request: (typeof requests)[number]) =>
    getMediaUserIds(request.requestedBy).includes(userId)
  // Like the server's time, every user's requests leave excluded users out,
  // unless the rewind is one of theirs
  const counted = requests.filter(
    (request) =>
      isOwn(request) ||
      !getMediaUserIds(request.requestedBy).some((id) =>
        settings.general.excludedUsers.includes(id),
      ),
  )
  const counts = countRequests(counted)
  const user = countRequests(requests.filter(isOwn))
  // Seerr users without Plex or Jellyfin have neither ID, so they're told
  // apart by their Seerr one
  const requesters = new Set(counted.map((request) => request.requestedBy.id))
  const average = getAverage(counts.total, requesters.size)
  const averageShares = getAverageShares(
    Object.values(groupBy(counted, (request) => request.requestedBy.id)).map(
      countRequests,
    ),
    ['movies', 'shows'],
  )
  // Compared with the rounded average the story shows, so they agree
  const averageCount = average === null ? null : Math.round(average)

  return {
    ...counts,
    user,
    average:
      averageCount === null
        ? null
        : {
            count: averageCount,
            difference: getDifference(user.total, averageCount),
          },
    averageShares,
  }
}
