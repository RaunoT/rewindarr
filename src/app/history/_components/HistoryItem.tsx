import Avatar from '@/components/Avatar'
import { MediaIcon } from '@/components/icons'
import ImageFallback from '@/components/ImageFallback'
import { DECISION_ICONS, getDecisionKind } from '@/components/StreamDecision'
import { HistoryPlay, MediaServer } from '@/types/statsSource'
import { generateDeeplinkUrl } from '@/utils/deeplink'
import { formatPercent, secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { UserIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import HistoryPoster, { ITEM_LINK_CLASS_NAME } from './HistoryPoster'

type Props = {
  play: HistoryPlay
  mediaServer: MediaServer | null
  // Whether the signed-in user played it
  isOwn: boolean
  // Who played it stays hidden, as on the activity page
  isAnonymous: boolean
}

// Two lines: what was played, then who played it and for how long. The show
// or artist leads, and an episode goes by its numbers, which say more at a
// glance than its title. The time is in the Rewindarr server's timezone, like
// the days.
export default function HistoryItem({
  play,
  mediaServer,
  isOwn,
  isAnonymous,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { mediaType, ratingKey, percentComplete, seasonNumber, episodeNumber } =
    play
  const name = play.showTitle || play.artistName || play.title
  const episode =
    seasonNumber !== null && episodeNumber !== null
      ? t('History.episodeNumber', {
          season: seasonNumber,
          episode: episodeNumber,
        })
      : null
  // An episode's title only stands in for numbers the source doesn't have
  const detail =
    mediaType === 'episode'
      ? (episode ?? play.title)
      : name !== play.title
        ? play.title
        : play.year && String(play.year)
  // The full title, episode's included, on hover
  const fullTitle = [
    name,
    episode,
    name !== play.title ? play.title : play.year,
  ]
    .filter(Boolean)
    .join(' · ')
  const userName = isAnonymous
    ? t('History.anonymous')
    : play.userName || t('History.unknownUser')
  const watched = [
    secondsToTime(play.durationMs / 1000, t),
    percentComplete !== null && formatPercent(percentComplete, locale),
  ]
    .filter(Boolean)
    .join(' · ')
  const decisionKind = getDecisionKind(play.transcodeDecision)
  const decision = decisionKind && DECISION_ICONS[decisionKind]
  const startedAt = new Date(play.startedAt)
  const href =
    mediaServer && ratingKey
      ? generateDeeplinkUrl(ratingKey, mediaServer, false)
      : null
  const title = (
    <>
      <MediaIcon
        type={mediaType}
        className='mr-1.5 inline size-3.5 -translate-y-px text-neutral-400'
        aria-hidden='true'
      />
      <span className='sr-only'>{`${t(`History.mediaType.${mediaType}`)}: `}</span>
      <span className='font-medium'>{name}</span>
      {detail && <span className='text-neutral-400'>{` · ${detail}`}</span>}
    </>
  )

  return (
    <li className='group/item flex items-center gap-3 py-2 last:pb-0'>
      <HistoryPoster
        srcs={[play.thumb && getImageProxyUrl(play.thumb, 100)]}
        type={mediaType}
        alt={t('History.poster', { title: name })}
        href={href}
      />

      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm' title={fullTitle}>
          {href ? (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className={ITEM_LINK_CLASS_NAME}
              data-item-link
            >
              {title}
            </a>
          ) : (
            title
          )}
        </p>
        <div className='flex min-w-0 items-center gap-1.5 text-xs text-neutral-400'>
          <div className='relative size-3.5 shrink-0 overflow-hidden rounded-full'>
            {isAnonymous ? (
              <ImageFallback alt={t('Activity.anonymousAvatar')}>
                <UserIcon className='size-[60cqw]' />
              </ImageFallback>
            ) : (
              <Avatar
                src={play.avatar}
                name={userName}
                alt={t('Common.profilePictureAlt', { name: userName })}
                sizes='1rem'
              />
            )}
          </div>
          <span
            className={clsx(
              'min-w-0 shrink truncate',
              isOwn ? 'text-plex font-medium' : 'text-neutral-300',
            )}
          >
            {userName}
          </span>
          <span className='shrink-0 tabular-nums'>{`· ${watched}`}</span>
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-1.5 text-xs text-neutral-400 tabular-nums'>
        {decision && (
          <span className='flex' title={t(`Activity.decision.${decisionKind}`)}>
            <decision.Icon
              className={clsx('size-4', decision.className)}
              aria-hidden='true'
            />
            <span className='sr-only'>
              {t(`Activity.decision.${decisionKind}`)}
            </span>
          </span>
        )}
        <time dateTime={startedAt.toISOString()}>
          {new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            minute: '2-digit',
          }).format(startedAt)}
        </time>
      </div>
    </li>
  )
}
