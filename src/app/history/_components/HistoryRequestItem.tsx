import { STAT_ICONS } from '@/components/icons'
import MediaCard from '@/components/MediaCard'
import SeerrButton from '@/components/MediaItem/SeerrButton'
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
  isAnonymous: boolean
  // Left out of one user's history, where it's the same on every card
  isUserShown: boolean
}

// Built like a play's card, with the request's status in Seerr among its
// links when Seerr's statuses are chosen. The poster opens the request, or once some of
// it is there, the item in the media server.
export default function HistoryRequestItem({
  request,
  item,
  mediaServer,
  settings,
  isAnonymous,
  isUserShown,
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
  const requestUrl = `${settings.connection.seerrUrl}/${mediaType}/${request.tmdbId}`
  // What's there opens in the media server. Only a partly available one still
  // needs its status, as the rest is yet to come.
  const serverLink =
    (request.status === 'available' ||
      request.status === 'partiallyAvailable') &&
    mediaServer &&
    request.ratingKey
      ? { mediaServer, ratingKey: request.ratingKey }
      : null
  const isStatusShown =
    settings.general.activeExternalLinks.includes('seerrStatus') &&
    (request.status !== 'available' || !serverLink)

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
          className='poster-overlay'
        >
          <STAT_ICONS.requests className='size-7 drop-shadow' />
        </span>
      }
      user={
        isUserShown
          ? {
              name: isAnonymous
                ? t('History.anonymous')
                : request.userName || t('History.unknownUser'),
              avatar: request.avatar,
              isAnonymous,
            }
          : null
      }
      seerrAction={
        isStatusShown && (
          <SeerrButton
            href={requestUrl}
            label={t('History.requestStatusLabel', { status, title })}
          >
            {status}
          </SeerrButton>
        )
      }
      deeplink={serverLink ?? { requestUrl }}
      aside={<HistoryTime time={new Date(request.createdAt)} />}
      settings={settings}
    />
  )
}
