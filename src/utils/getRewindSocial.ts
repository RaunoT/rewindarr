import { RewindSocial, SocialItem } from '@/types/rewindSocial'
import { Library } from '@/types/statsSource'
import { uniqBy } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { secondsToTime } from './formatting'
import { fetchRewindRequests } from './getRewind'
import getSettings from './getSettings'
import { getRewindStartDate } from './helpers'
import { isSeerrActive } from './historyRequests'
import {
  getOnlyYou,
  getRequestsReach,
  getServerYear,
  TitleStat,
} from './rewindSocial'
import { getStatsSource } from './statsSource'

// How the user's year compares with everyone else's. Everyone's plays are read
// once for all of it.
export default async function getRewindSocial(
  userId: string,
  libraries: Library[],
): Promise<RewindSocial> {
  const settings = getSettings()
  const source = getStatsSource(settings)
  const since = getRewindStartDate(settings)
  const { excludedUsers, minPlayPercent } = settings.general
  const [t, serverPlays, userPlays, requests] = await Promise.all([
    getTranslations(),
    source.getHistoryPlays({ since, libraries }),
    // Everyone's plays leave excluded users out, so an excluded user's own
    // are added back
    excludedUsers.includes(userId)
      ? source.getHistoryPlays({ since, userId, libraries })
      : [],
    isSeerrActive(settings) ? fetchRewindRequests(since) : null,
  ])
  const plays = uniqBy([...serverPlays, ...userPlays], 'id')
  const onlyYou = getOnlyYou(plays, userId, minPlayPercent)
  const reach =
    requests && getRequestsReach(requests, plays, userId, minPlayPercent)
  const server = getServerYear(plays, userId, minPlayPercent)

  // The poster and ratings, with the story's own plays, time and people
  async function toItem(title?: TitleStat | null): Promise<SocialItem | null> {
    if (!title) {
      return null
    }

    const data = await source.getPlayItem(title.play)

    return {
      data: {
        ...data,
        total_plays: title.plays,
        total_duration: title.duration,
        users_watched: title.users,
      },
      type: title.play.mediaType === 'movie' ? 'movie' : 'show',
    }
  }

  const [onlyYouItem, reachItem, movieItem, showItem] = await Promise.all([
    toItem(onlyYou?.top),
    toItem(reach?.top),
    toItem(server?.movie),
    toItem(server?.show),
  ])

  return {
    onlyYou:
      onlyYou && onlyYouItem
        ? { count: onlyYou.count, share: onlyYou.share, item: onlyYouItem }
        : null,
    requestsReach:
      reach && reachItem
        ? {
            users: reach.users,
            requests: reach.requests,
            duration: secondsToTime(reach.duration, t),
            item: reachItem,
            isItemWatched: reach.isTopWatched,
          }
        : null,
    serverYear: server && {
      duration: secondsToTime(server.duration, t),
      users: server.users,
      share: server.share,
      movie: movieItem,
      show: showItem,
    },
  }
}
