import { STAT_ICONS } from '@/components/icons'
import MediaCard from '@/components/MediaCard'
import SeerrLogo from '@/components/MediaItem/SeerrLogo'
import { HistoryRequest } from '@/types/history'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { useTranslations } from 'next-intl'
import HistoryTime from './HistoryTime'

type Props = {
  request: HistoryRequest
  // The title's year, ratings and IDs
  item: TautulliItemRow | null | undefined
  mediaServer: MediaServer | null
  settings: PublicSettings
  isOwn: boolean
  isAnonymous: boolean
}

// Built like a play's card, with the request's status in Seerr where a play
// has its media server's button. Once it's all there, it gets that button too.
export default function HistoryRequestItem({
  request,
  item,
  mediaServer,
  settings,
  isOwn,
  isAnonymous,
}: Props) {
  const t = useTranslations()
  const { mediaType, seasons } = request
  const title = request.title || t('History.unknownTitle')
  const status = t(`History.requestStatus.${request.status}`)
  const detail =
    mediaType === 'tv' && seasons.length
      ? seasons.length === 1
        ? t('History.season', { season: seasons[0] })
        : t('History.seasonCount', { count: seasons.length })
      : null
  const deeplink =
    request.status === 'available' && mediaServer && request.ratingKey
      ? { mediaServer, ratingKey: request.ratingKey }
      : null

  return (
    <MediaCard
      type={mediaType === 'tv' ? 'show' : 'movie'}
      mediaType={mediaType === 'tv' ? 'show' : 'movie'}
      item={item}
      name={title}
      detail={detail}
      fullTitle={detail ? `${title} · ${detail}` : title}
      posters={[request.poster]}
      // Tells it apart from the plays, like a stream's pause on the activity
      posterOverlay={
        <span
          role='img'
          aria-label={t('History.request')}
          className='absolute inset-0 flex items-center justify-center bg-black/60'
        >
          <STAT_ICONS.requests className='size-7 drop-shadow' />
        </span>
      }
      user={{
        name: isAnonymous
          ? t('History.anonymous')
          : request.userName || t('History.unknownUser'),
        avatar: request.avatar,
        isOwn,
        isAnonymous,
      }}
      action={
        !deeplink && (
          <a
            href={`${settings.connection.seerrUrl}/${mediaType}/${request.tmdbId}`}
            target='_blank'
            rel='noopener noreferrer'
            className='button-card'
            aria-label={t('History.requestStatusLabel', { status, title })}
          >
            <SeerrLogo />
            {status}
          </a>
        )
      }
      deeplink={deeplink}
      aside={<HistoryTime time={new Date(request.createdAt)} />}
      settings={settings}
    />
  )
}
