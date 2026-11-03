import { STAT_ICONS } from '@/components/icons'
import MediaCard, { STAT_PILL } from '@/components/MediaCard'
import ProgressBar from '@/components/ProgressBar'
import { DECISION_ICONS, getDecisionKind } from '@/components/StreamDecision'
import { PublicSettings } from '@/types/settings'
import { HistoryPlay, MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { formatPercent, secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import HistoryTime from './HistoryTime'

type Props = {
  play: HistoryPlay
  // The title's year, ratings and IDs
  item: TautulliItemRow | null | undefined
  mediaServer: MediaServer | null
  settings: PublicSettings
  // Whether the signed-in user played it
  isOwn: boolean
  // Who played it stays hidden, as on the activity page
  isAnonymous: boolean
}

const TYPES = { movie: 'movie', episode: 'show', track: 'artist' } as const

// The show or artist leads, and an episode goes by its numbers, which say
// more at a glance than its title
export default function HistoryItem({
  play,
  item,
  mediaServer,
  settings,
  isOwn,
  isAnonymous,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { mediaType, percentComplete, seasonNumber, episodeNumber } = play
  // A deleted item has nothing left to open in the media server
  const ratingKey = item?.is_deleted ? null : play.ratingKey
  const name = play.showTitle || play.artistName || play.title
  const episode =
    seasonNumber !== null && episodeNumber !== null
      ? t('History.episodeNumber', {
          season: seasonNumber,
          episode: episodeNumber,
        })
      : null
  // An episode's title only stands in for numbers the source doesn't have.
  // A movie's year is among its details.
  const detail =
    mediaType === 'episode'
      ? (episode ?? play.title)
      : name !== play.title
        ? play.title
        : null
  // The full title, the episode's included, on hover
  const fullTitle = [name, episode, name !== play.title && play.title]
    .filter(Boolean)
    .join(' · ')
  const decisionKind = getDecisionKind(play.transcodeDecision)
  const decision = decisionKind && DECISION_ICONS[decisionKind]

  return (
    <MediaCard
      type={TYPES[mediaType]}
      mediaType={mediaType}
      item={item}
      name={name}
      detail={detail}
      fullTitle={fullTitle}
      posters={[play.thumb && getImageProxyUrl(play.thumb)]}
      user={{
        name: isAnonymous
          ? t('History.anonymous')
          : play.userName || t('History.unknownUser'),
        avatar: play.avatar,
        isOwn,
        isAnonymous,
      }}
      stats={
        <>
          <li className={STAT_PILL}>
            <STAT_ICONS.duration />
            {secondsToTime(play.durationMs / 1000, t)}
          </li>
          {percentComplete !== null && (
            <li className={clsx(STAT_PILL, 'gap-1.5')}>
              <ProgressBar value={percentComplete / 100} className='w-8' />
              {formatPercent(percentComplete, locale)}
            </li>
          )}
          {decision && (
            <li className={STAT_PILL}>
              <decision.Icon className={clsx(decision.className)} />
              {t(`Activity.decision.${decisionKind}`)}
            </li>
          )}
        </>
      }
      deeplink={mediaServer && ratingKey ? { mediaServer, ratingKey } : null}
      aside={<HistoryTime time={new Date(play.startedAt)} />}
      settings={settings}
    />
  )
}
