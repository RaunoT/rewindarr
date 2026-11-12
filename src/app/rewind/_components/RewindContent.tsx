import HistoryReading from '@/components/HistoryReading'
import { authOptions } from '@/lib/auth'
import {
  RewindPeriod,
  RewindTotals,
  RewindUser,
  UserRewind,
} from '@/types/rewind'
import { ItemRow, Library } from '@/types/statsSource'
import { PLAY_LIBRARY_TYPES, TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import {
  formatMonthYear,
  formatTimeSince,
  secondsToTime,
} from '@/utils/formatting'
import {
  getGenres,
  getPlaybackHabits,
  getRequestsTotals,
  getTopMediaItems,
  getTopMediaStats,
  getTopPeople,
  getTopTrack,
  getUserTotalDuration,
  getUsersDurationByType,
  getlibrariesTotalSize,
} from '@/utils/getRewind'
import getRewindSocial from '@/utils/getRewindSocial'
import getSettings from '@/utils/getSettings'
import getUsersTop from '@/utils/getUsersTop'
import {
  canViewFeature,
  getAverage,
  getAverageShares,
  getDifference,
  getViewer,
} from '@/utils/helpers'
import { getPlexThemeUrl, getPlexTrackUrl } from '@/utils/plexAudio'
import { toPublicSettings } from '@/utils/publicSettings'
import { getRewindMoments } from '@/utils/rewindMoments'
import { getMusicUrl, getThemeSongUrl } from '@/utils/rewindMusic'
import {
  getLatestEditionYear,
  getRewindPeriod,
  parseEditionYear,
} from '@/utils/rewindPeriod'
import {
  getPersonality,
  getPersonalitySignals,
  getPlaySignals,
} from '@/utils/rewindPersonality'
import { getTopPercent } from '@/utils/rewindTotal'
import {
  getActiveUsers,
  getHistoryProgress,
  getHistoryStatus,
  getLibraries,
  getMediaServer,
  getStatsSource,
} from '@/utils/statsSource'
import { toTimeZone } from '@/utils/timeZone'
import { getTitleMoments } from '@/utils/titleMoments'
import { getYearOverYear } from '@/utils/yearOverYear'
import { sumBy } from 'lodash'
import { getServerSession } from 'next-auth'
import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import RewindStories, { RewindData } from './RewindStories'

// The viewer's Rewind, or with an admin's userId another user's.
// Shared by the Rewind page and the player page.
export default async function RewindContent({
  userId,
  year,
}: {
  userId?: string
  year?: string
}) {
  const session = await getServerSession(authOptions)
  const settings = getSettings()

  if (!canViewFeature(settings, 'rewind', getViewer(session))) {
    return notFound()
  }

  let user: RewindUser | undefined = session?.user && {
    id: session.user.id,
    name: session.user.name ?? '',
    image: session.user.image,
    isAdmin: session.user.isAdmin,
  }

  // Only admins can open another user's rewind.
  if (session?.user.isAdmin && userId) {
    const users = await getActiveUsers(settings)
    const queriedUser = users.find((u) => String(u.user_id) === userId)

    if (queriedUser) {
      user = {
        image: queriedUser.thumb,
        name: queriedUser.friendly_name,
        id: userId,
        isAdmin: false,
      }
    }
  }

  if (!user) {
    return notFound()
  }

  const timeZone = toTimeZone(
    (await cookies()).get(TIME_ZONE_COOKIE_NAME)?.value,
  )
  const period = getRewindPeriod(settings, {
    year: parseEditionYear(year, getLatestEditionYear(settings, timeZone)),
    timeZone,
  })
  const libraries = await getLibraries()
  const progress = await getHistoryProgress(period.since, libraries)

  if (progress) {
    return <HistoryReading progress={progress} isInCard />
  }

  // Ranked once, for both the users' top and the average user
  const viewersRequest = getStatsSource(settings).getTopUsers({
    since: period.since,
    until: period.until,
    libraries,
  })
  // Not waited for, so the welcome shows while they're read. The rest reads
  // the totals too, instead of reading them again.
  const totals = getTotals(user.id, libraries, period, viewersRequest)
  const rewind = getRewind(user, libraries, period, timeZone, {
    viewersRequest,
    totals,
  })

  return (
    <RewindStories
      user={user}
      period={period}
      settings={toPublicSettings(settings)}
      track={getMusicUrl(settings)}
      totals={totals}
      rewind={rewind}
    />
  )
}

// The total story's, which only need the plays, so they're in long before the
// rest
async function getTotals(
  userId: string,
  libraries: Library[],
  period: RewindPeriod,
  viewersRequest: Promise<ItemRow[] | null>,
): Promise<RewindTotals> {
  const settings = getSettings()
  const [t, userTotalDuration, topMediaStats, usersDurationByType, viewers] =
    await Promise.all([
      getTranslations(),
      getUserTotalDuration(userId, libraries, period),
      getTopMediaStats(userId, libraries, period),
      getUsersDurationByType(libraries, period),
      viewersRequest,
    ])
  const isUserExcluded = settings.general.excludedUsers.includes(userId)
  // The server's totals leave excluded users out, so an excluded user's own
  // time is added back, here and in the average split by type
  const isUserAddedBack = isUserExcluded && userTotalDuration > 0
  // From the ranked users' own time, so plays nobody can be matched to aren't
  // spread over the users who can
  const averageDuration =
    viewers &&
    getAverage(
      sumBy(viewers, 'total_duration') +
        (isUserAddedBack ? userTotalDuration : 0),
      viewers.length + (isUserAddedBack ? 1 : 0),
    )
  // Each user's own split, so heavy users don't outweigh the rest
  const averageShares =
    usersDurationByType &&
    getAverageShares(
      [
        ...usersDurationByType.values(),
        ...(isUserAddedBack
          ? [
              {
                shows: topMediaStats.shows.durationValue ?? 0,
                movies: topMediaStats.movies.durationValue ?? 0,
                audio: topMediaStats.audio.durationValue ?? 0,
              },
            ]
          : []),
      ],
      ['shows', 'movies', 'audio'],
    )

  return {
    duration: {
      user: secondsToTime(userTotalDuration, t),
      average: averageDuration
        ? {
            duration: secondsToTime(averageDuration, t),
            difference: getDifference(userTotalDuration, averageDuration),
          }
        : null,
      topPercent: viewers && getTopPercent(viewers, userId, userTotalDuration),
    },
    shows: {
      count: topMediaStats.shows.count,
      duration: topMediaStats.shows.duration,
      duration_value: topMediaStats.shows.durationValue,
      average_share: averageShares?.shows ?? null,
      percentage: topMediaStats.shows.percentage,
    },
    movies: {
      count: topMediaStats.movies.count,
      duration: topMediaStats.movies.duration,
      duration_value: topMediaStats.movies.durationValue,
      average_share: averageShares?.movies ?? null,
      percentage: topMediaStats.movies.percentage,
    },
    audio: {
      count: topMediaStats.audio.count,
      duration: topMediaStats.audio.duration,
      duration_value: topMediaStats.audio.durationValue,
      average_share: averageShares?.audio ?? null,
      percentage: topMediaStats.audio.percentage,
    },
  }
}

type SharedRequests = {
  viewersRequest: Promise<ItemRow[] | null>
  totals: Promise<RewindTotals>
}

// What the stories after the total show, with the totals
async function getRewind(
  user: RewindUser,
  libraries: Library[],
  period: RewindPeriod,
  timeZone: string | undefined,
  { viewersRequest, totals: totalsRequest }: SharedRequests,
): Promise<RewindData> {
  const settings = getSettings()
  const { since, until } = period
  // Read once, for every stat from the user's own plays
  const userPlaysRequest = getStatsSource(settings).getHistoryPlays({
    since,
    until,
    userId: user.id,
    libraries,
  })
  const [
    locale,
    totals,
    topMediaItems,
    librariesTotalSize,
    mediaServer,
    usersTop,
    habits,
    firstPlay,
    people,
    genres,
    topTrack,
    social,
    moments,
  ] = await Promise.all([
    getLocale(),
    totalsRequest,
    getTopMediaItems(user.id, libraries, period),
    getlibrariesTotalSize(libraries),
    getMediaServer(),
    viewersRequest.then((users) =>
      getUsersTop(user.id, since, { users, until }),
    ),
    getPlaybackHabits(user.id, libraries, period, timeZone),
    // A user who joined after an edition has no first play in it
    getStatsSource(settings)
      .getFirstPlay(user.id)
      .then((play) =>
        play && (!until || Date.parse(play.date) < Date.parse(until))
          ? play
          : null,
      ),
    getTopPeople(user.id, libraries, period),
    getGenres(user.id, libraries, period),
    getTopTrack(user.id, libraries, period),
    getRewindSocial(user.id, libraries, period),
    userPlaysRequest.then((plays) =>
      getRewindMoments(plays, {
        since,
        // The chart stops at the edition's last month
        until: until ? Math.min(Date.now(), Date.parse(until) - 1) : undefined,
        minPlayPercent: settings.general.minPlayPercent,
        timeZone,
        getPlayItem: (play) => getStatsSource(settings).getPlayItem(play),
      }),
    ),
  ])
  // The card for the first play needs its poster and ratings looked up. Its
  // all-time watch time and plays, up to an edition's end, wait for the whole
  // history to be read.
  const hasFirstPlayTotals = (await getHistoryStatus()).isComplete
  const firstPlayItem = firstPlay?.play
    ? await getStatsSource(settings).getPlayItem(
        firstPlay.play,
        hasFirstPlayTotals ? user.id : undefined,
        until,
      )
    : null
  // The viewer's plays in the period, and all of them up to its end once the
  // whole history has been read, for what was new to them and what they never
  // finished
  const [plays, allPlays] = await Promise.all([
    userPlaysRequest,
    hasFirstPlayTotals
      ? getStatsSource(settings).getHistoryPlays({
          since: new Date(0).toISOString(),
          until,
          userId: user.id,
          libraries,
        })
      : null,
  ])
  const titleMoments = await getTitleMoments(plays, allPlays, until)
  const yearOverYear = await getYearOverYear(allPlays, period, timeZone, {
    shows: topMediaItems.shows[0],
    movies: topMediaItems.movies[0],
  })
  const userRewind: UserRewind = {
    duration: totals.duration,
    usersTop: usersTop?.items ?? null,
    shows: { top: topMediaItems.shows, ...totals.shows },
    movies: { top: topMediaItems.movies, ...totals.movies },
    people,
    genres,
    audio: { top: topMediaItems.audio, ...totals.audio, topTrack },
    titleMoments,
    yearOverYear,
    habits: habits,
    firstPlay: firstPlay && {
      date: formatMonthYear(firstPlay.date, locale, 'long'),
      timeSince: formatTimeSince(firstPlay.date, locale),
      title: firstPlay.title,
      item:
        firstPlay.play && firstPlayItem
          ? {
              data: firstPlayItem,
              type: PLAY_LIBRARY_TYPES[firstPlay.play.mediaType],
              hasTotals: hasFirstPlayTotals,
            }
          : null,
    },
    moments,
    libraries: libraries,
    libraries_total_size: librariesTotalSize.size,
    libraries_size_is_partial: librariesTotalSize.isPartial,
    media_server: mediaServer,
    social,
    user: user,
    period,
  }

  // Read from the stats above, once they're all in
  userRewind.personality = getPersonality(
    getPersonalitySignals(
      userRewind,
      getPlaySignals(plays, settings.general.minPlayPercent),
    ),
  )

  const isSeerrActive =
    settings.connection.seerrUrl && settings.connection.seerrApiKey

  if (isSeerrActive) {
    const requestTotals = await getRequestsTotals(user.id, period, plays)

    userRewind.requests = requestTotals
  }

  const { isThemeMusicActive } = settings.rewind
  const topShow = topMediaItems.shows[0]
  const topMovie = topMediaItems.movies[0]
  // From the library first, then Plex's own theme songs
  const getShowThemes = (show: ItemRow | null | undefined) =>
    isThemeMusicActive
      ? [
          getPlexThemeUrl(settings, show?.rating_key),
          getThemeSongUrl(show?.tvdb_id),
        ].filter((url) => url !== null)
      : []

  return {
    userRewind,
    themes: {
      showThemes: getShowThemes(topShow),
      bingeThemes: getShowThemes(userRewind.moments.binge?.item),
      movieThemes: isThemeMusicActive
        ? [getPlexThemeUrl(settings, topMovie?.rating_key)].filter(
            (url) => url !== null,
          )
        : [],
      topTrack: isThemeMusicActive
        ? getPlexTrackUrl(settings, topTrack?.ratingKey)
        : null,
    },
  }
}
