import HistoryReading from '@/components/HistoryReading'
import { authOptions } from '@/lib/auth'
import { RewindTotals, RewindUser, UserRewind } from '@/types/rewind'
import { TautulliItemRow, TautulliLibrary } from '@/types/tautulli'
import { TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import {
  formatMonthYear,
  formatTimeSince,
  secondsToTime,
} from '@/utils/formatting'
import {
  getGenres,
  getLibrariesDurationByType,
  getPlaybackHabits,
  getRequestsTotals,
  getTopMediaItems,
  getTopMediaStats,
  getTopPeople,
  getTopTrack,
  getUserTotalDuration,
  getlibrariesTotalSize,
} from '@/utils/getRewind'
import getRewindSocial from '@/utils/getRewindSocial'
import getSettings from '@/utils/getSettings'
import getUsersTop from '@/utils/getUsersTop'
import {
  canViewFeature,
  getAverage,
  getDifference,
  getRewindStartDate,
  getViewer,
} from '@/utils/helpers'
import { getPlexThemeUrl, getPlexTrackUrl } from '@/utils/plexAudio'
import { toPublicSettings } from '@/utils/publicSettings'
import { getRewindMoments } from '@/utils/rewindMoments'
import { getMusicUrl, getThemeSongUrl } from '@/utils/rewindMusic'
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
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import RewindStories, { RewindData } from './_components/RewindStories'
import Loading from './loading'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Rewind')

  return {
    title: t('title'),
  }
}

async function RewindContent({ userId }: { userId?: string }) {
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
    const queriedUser = users.find((u) => u.user_id == userId)

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

  const startDate = getRewindStartDate(settings)
  const libraries = await getLibraries()
  const progress = await getHistoryProgress(startDate, libraries)

  if (progress) {
    return <HistoryReading progress={progress} isInCard />
  }

  const timeZone = toTimeZone(
    (await cookies()).get(TIME_ZONE_COOKIE_NAME)?.value,
  )
  // Ranked once, for both the users' top and the average user
  const viewersRequest = getStatsSource(settings).getTopUsers({
    since: startDate,
    libraries,
  })
  // Not waited for, so the welcome shows while they're read. The rest reads
  // the totals too, instead of reading them again.
  const totals = getTotals(user.id, libraries, viewersRequest)
  const rewind = getRewind(user, libraries, timeZone, {
    viewersRequest,
    totals,
  })

  return (
    <RewindStories
      user={user}
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
  libraries: TautulliLibrary[],
  viewersRequest: Promise<TautulliItemRow[] | null>,
): Promise<RewindTotals> {
  const settings = getSettings()
  const [
    t,
    userTotalDuration,
    topMediaStats,
    librariesDurationByType,
    viewers,
  ] = await Promise.all([
    getTranslations(),
    getUserTotalDuration(userId, libraries),
    getTopMediaStats(userId, libraries),
    getLibrariesDurationByType(libraries),
    viewersRequest,
  ])
  const isUserExcluded = settings.general.excludedUsers.includes(userId)
  // The server's totals leave excluded users out, so an excluded user's own
  // time is added back, here and in the totals by type
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

  function getServerDuration(type: 'shows' | 'movies' | 'audio') {
    const duration = librariesDurationByType[type]

    return duration === null
      ? null
      : duration +
          (isUserExcluded ? (topMediaStats[type].durationValue ?? 0) : 0)
  }

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
      server_duration_value: getServerDuration('shows'),
      percentage: topMediaStats.shows.percentage,
    },
    movies: {
      count: topMediaStats.movies.count,
      duration: topMediaStats.movies.duration,
      duration_value: topMediaStats.movies.durationValue,
      server_duration_value: getServerDuration('movies'),
      percentage: topMediaStats.movies.percentage,
    },
    audio: {
      count: topMediaStats.audio.count,
      duration: topMediaStats.audio.duration,
      duration_value: topMediaStats.audio.durationValue,
      server_duration_value: getServerDuration('audio'),
      percentage: topMediaStats.audio.percentage,
    },
  }
}

type SharedRequests = {
  viewersRequest: Promise<TautulliItemRow[] | null>
  totals: Promise<RewindTotals>
}

// What the stories after the total show, with the totals
async function getRewind(
  user: RewindUser,
  libraries: TautulliLibrary[],
  timeZone: string | undefined,
  { viewersRequest, totals: totalsRequest }: SharedRequests,
): Promise<RewindData> {
  const settings = getSettings()
  const startDate = getRewindStartDate(settings)
  // Read once, for every stat from the user's own plays
  const userPlaysRequest = getStatsSource(settings).getHistoryPlays({
    since: startDate,
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
    getTopMediaItems(user.id, libraries),
    getlibrariesTotalSize(libraries),
    getMediaServer(),
    viewersRequest.then((users) => getUsersTop(user.id, startDate, { users })),
    getPlaybackHabits(user.id, libraries, timeZone),
    getStatsSource(settings).getFirstPlay(user.id),
    getTopPeople(user.id, libraries),
    getGenres(user.id, libraries),
    getTopTrack(user.id, libraries),
    getRewindSocial(user.id, libraries),
    userPlaysRequest.then((plays) =>
      getRewindMoments(plays, {
        since: startDate,
        minPlayPercent: settings.general.minPlayPercent,
        timeZone,
        getPlayItem: (play) => getStatsSource(settings).getPlayItem(play),
      }),
    ),
  ])
  // The card for the first play needs its poster and ratings looked up. Its
  // all-time watch time and plays wait for the whole history to be read.
  const hasFirstPlayTotals = (await getHistoryStatus()).isComplete
  const firstPlayItem = firstPlay?.play
    ? await getStatsSource(settings).getPlayItem(
        firstPlay.play,
        hasFirstPlayTotals ? user.id : undefined,
      )
    : null
  // The viewer's plays in the period, and all of them once the whole history
  // has been read, for what was new to them and what they never finished
  const [plays, allPlays] = await Promise.all([
    userPlaysRequest,
    hasFirstPlayTotals
      ? getStatsSource(settings).getHistoryPlays({
          since: new Date(0).toISOString(),
          userId: user.id,
          libraries,
        })
      : null,
  ])
  const titleMoments = await getTitleMoments(plays, allPlays)
  const yearOverYear = await getYearOverYear(allPlays, timeZone, {
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
              type: ITEM_TYPES[firstPlay.play.mediaType],
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
    const requestTotals = await getRequestsTotals(user.id)

    userRewind.requests = requestTotals
  }

  const { isThemeMusicActive } = settings.rewind
  const topShow = topMediaItems.shows[0]
  const topMovie = topMediaItems.movies[0]

  return {
    userRewind,
    themes: {
      showThemes: isThemeMusicActive
        ? [
            getPlexThemeUrl(settings, topShow?.rating_key),
            getThemeSongUrl(topShow?.tvdb_id),
          ].filter((url) => url !== null)
        : [],
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

type Props = {
  searchParams: Promise<{
    userId?: string
  }>
}

// What a play rolls up into, as in the dashboard's lists
const ITEM_TYPES = {
  movie: 'movie',
  episode: 'show',
  track: 'artist',
} as const

export default async function RewindPage({ searchParams }: Props) {
  const { userId } = await searchParams

  return (
    <Suspense fallback={<Loading />} key={userId}>
      <RewindContent userId={userId} />
    </Suspense>
  )
}
