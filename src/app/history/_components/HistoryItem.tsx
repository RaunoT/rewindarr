import { STAT_ICONS } from '@/components/icons'
import MediaCard, { STAT_PILL } from '@/components/MediaCard'
import SeerrButton from '@/components/MediaItem/SeerrButton'
import ProgressBar from '@/components/ProgressBar'
import { DECISION_ICONS, getDecisionKind } from '@/components/StreamDecision'
import { PublicSettings } from '@/types/settings'
import { HistoryPlay, ItemRow, MediaServer } from '@/types/statsSource'
import { getRequestUrl, getSeerrUrl } from '@/utils/deeplink'
import { formatPercent, secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import clsx from 'clsx'
import { sumBy } from 'lodash'
import { useLocale, useTranslations } from 'next-intl'
import HistoryBingeCard from './HistoryBingeCard'
import HistoryTime from './HistoryTime'

type Props = {
  play: HistoryPlay
  // The episodes or tracks played in a row with it, newest first
  binge?: HistoryPlay[]
  // The title's year, ratings and IDs
  item: ItemRow | null | undefined
  mediaServer: MediaServer | null
  settings: PublicSettings
  // Who played it stays hidden, as on the activity page
  isAnonymous: boolean
  // Left out of one user's history, where it's the same on every card
  isUserShown: boolean
}

const TYPES = { movie: 'movie', episode: 'show', track: 'artist' } as const

// A deleted item has nothing left to open in the media server. A re-added one
// has a new rating key, and so do its episodes, which the show's stands in for.
function getRatingKey(
  play: HistoryPlay,
  item: ItemRow | null | undefined,
): number | string | null {
  if (item?.is_deleted) {
    return null
  }

  const playedKey =
    play.mediaType === 'movie' ? play.ratingKey : play.grandparentRatingKey

  if (item?.rating_key && playedKey && String(item.rating_key) !== playedKey) {
    return item.rating_key
  }

  return play.ratingKey
}

// The episodes from the first played to the last, in one season or across two
function getEpisodeRange(
  plays: HistoryPlay[],
  t: ReturnType<typeof useTranslations>,
): string | null {
  const numbers = plays.map(({ seasonNumber, episodeNumber }) =>
    seasonNumber !== null && episodeNumber !== null
      ? { season: seasonNumber, episode: episodeNumber }
      : null,
  )
  const first = numbers[numbers.length - 1]
  const last = numbers[0]

  if (!first || !last || numbers.includes(null)) {
    return null
  }

  if (first.season !== last.season) {
    return t('History.range', {
      from: t('History.episodeNumber', first),
      to: t('History.episodeNumber', last),
    })
  }

  return first.episode === last.episode
    ? t('History.episodeNumber', last)
    : t('History.episodeRange', {
        season: last.season,
        first: first.episode,
        last: last.episode,
      })
}

type BingeEntry = {
  // The newest of its plays
  play: HistoryPlay
  // When the first of them started
  startedAt: number
  durationMs: number
}

// A resumed episode or track is the same one twice in a row, so it's one row,
// from when it was first started and with the time of both. Newest first.
function mergeResumed(plays: HistoryPlay[]): BingeEntry[] {
  const entries: BingeEntry[] = []

  for (const play of plays) {
    const last = entries.at(-1)

    if (last && getItemKey(last.play) === getItemKey(play)) {
      last.startedAt = play.startedAt
      last.durationMs += play.durationMs
    } else {
      entries.push({
        play,
        startedAt: play.startedAt,
        durationMs: play.durationMs,
      })
    }
  }

  return entries
}

function getItemKey(play: HistoryPlay): string {
  return (
    play.ratingKey ||
    [play.seasonNumber, play.episodeNumber, play.title].join('|')
  )
}

// What a play's stream stood out for. Direct play is the usual, so it's left
// out, and a binge shows the most work any of its plays took.
function getDecision(plays: HistoryPlay[]) {
  const kinds = plays.map((play) => getDecisionKind(play.transcodeDecision))

  return (['transcode', 'directStream'] as const).find((kind) =>
    kinds.includes(kind),
  )
}

// The show leads, and an episode goes by its numbers above it, which say more
// at a glance than its title. A track leads with its artist above it.
// Episodes or tracks played in a row are one card, under the show or artist,
// which opens a list of them.
export default function HistoryItem({
  play,
  binge,
  item,
  mediaServer,
  settings,
  isAnonymous,
  isUserShown,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { mediaType, seasonNumber, episodeNumber } = play
  const plays = binge ?? [play]
  const entries = mergeResumed(plays)
  // One episode played in two sittings is just that episode
  const isBinge = entries.length > 1
  const ratingKey = getRatingKey(play, item)
  // A deleted title opens its request instead
  const requestUrl =
    item && getRequestUrl(item, TYPES[mediaType], getSeerrUrl(settings))
  const isTrack = mediaType === 'track' && !isBinge
  const name = isTrack
    ? play.title
    : play.showTitle || play.artistName || play.title
  const episode =
    seasonNumber !== null && episodeNumber !== null
      ? t('History.episodeNumber', {
          season: seasonNumber,
          episode: episodeNumber,
        })
      : null
  // An episode's title only stands in for numbers the source doesn't have.
  // A binge's tracks are in its list.
  const detail = isBinge
    ? mediaType === 'episode'
      ? getEpisodeRange(plays, t)
      : null
    : mediaType === 'episode'
      ? (episode ?? play.title)
      : isTrack && play.artistName !== play.title
        ? play.artistName
        : null
  // The full title, the episode's included, on hover
  const fullTitle = isBinge
    ? [name, detail].filter(Boolean).join(' · ')
    : isTrack
      ? [detail, name].filter(Boolean).join(' · ')
      : [name, episode, name !== play.title && play.title]
          .filter(Boolean)
          .join(' · ')
  const progress = isBinge ? null : play.percentComplete
  const decisionKind = getDecision(plays)
  const decision = decisionKind && DECISION_ICONS[decisionKind]
  const card = {
    type: TYPES[mediaType],
    mediaType,
    item,
    name,
    detail,
    fullTitle,
    posters: [play.thumb && getImageProxyUrl(play.thumb)],
    progress,
    user: isUserShown
      ? {
          name: isAnonymous
            ? t('History.anonymous')
            : play.userName || t('History.unknownUser'),
          avatar: play.avatar,
          isAnonymous,
        }
      : null,
    stats: (
      <>
        <li className={STAT_PILL}>
          <STAT_ICONS.duration />
          {secondsToTime(sumBy(plays, 'durationMs') / 1000, t)}
        </li>
        {/* A binge's plays each have their own, so it has none. Phones have
            it under the poster. */}
        {progress !== null && (
          <li className={clsx(STAT_PILL, 'gap-1.5 max-sm:hidden')}>
            <ProgressBar value={progress / 100} className='w-8' />
            {formatPercent(progress, locale)}
          </li>
        )}
        {decision && (
          <li className={STAT_PILL}>
            <decision.Icon className={decision.className} />
            {t(`Activity.decision.${decisionKind}`)}
          </li>
        )}
      </>
    ),
    seerrAction: requestUrl &&
      settings.general.activeExternalLinks.includes('seerrStatus') && (
        <SeerrButton
          href={requestUrl}
          label={t('MediaItem.requestLabel', { title: name })}
        >
          {t('MediaItem.request')}
        </SeerrButton>
      ),
    deeplink:
      mediaServer && ratingKey
        ? { mediaServer, ratingKey }
        : requestUrl
          ? { requestUrl }
          : null,
    // A binge's newest play, which is where it's in the history
    aside: <HistoryTime time={new Date(play.startedAt)} />,
    settings,
  }

  if (!isBinge) {
    return <MediaCard {...card} />
  }

  // The card's range has the season, so the rows only need it when it changes
  const isOneSeason = new Set(plays.map((item) => item.seasonNumber)).size === 1

  return (
    <HistoryBingeCard
      {...card}
      count={entries.length}
      countLabel={t(
        mediaType === 'episode' ? 'History.episodeCount' : 'History.trackCount',
        { count: entries.length },
      )}
      plays={
        // In the order they were played, like a season's, each with when it
        // started where the card has its time. Phones leave out how long.
        <ol className='flex flex-col gap-2'>
          {[...entries].reverse().map((entry) => {
            const { seasonNumber: season, episodeNumber: number } = entry.play

            return (
              <li
                key={entry.play.id}
                className='flex items-baseline gap-3 tabular-nums'
              >
                {season !== null && number !== null && (
                  <span className='shrink-0 text-neutral-400'>
                    {isOneSeason
                      ? t('History.episodeOnly', { episode: number })
                      : t('History.episodeNumber', { season, episode: number })}
                  </span>
                )}
                <span className='min-w-0 flex-1 truncate'>
                  {entry.play.title}
                </span>
                <span className='shrink-0 text-neutral-400 max-sm:hidden'>
                  {secondsToTime(entry.durationMs / 1000, t)}
                </span>
                <span className='shrink-0 text-neutral-400'>
                  <HistoryTime time={new Date(entry.startedAt)} />
                </span>
              </li>
            )
          })}
        </ol>
      }
    />
  )
}
