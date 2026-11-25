import { STAT_ICONS } from '@/components/icons'
import MediaCard, { STAT_PILL } from '@/components/MediaCard'
import SeerrButton from '@/components/MediaItem/SeerrButton'
import { HistoryRequest } from '@/types/history'
import { PublicSettings } from '@/types/settings'
import { ItemRow, MediaServer } from '@/types/statsSource'
import { useTranslations } from 'next-intl'
import HistoryTime from './HistoryTime'

type Props = {
  request: HistoryRequest
  // The title's year, ratings and IDs
  item: ItemRow | null | undefined
  mediaServer: MediaServer | null
  settings: PublicSettings
  isAnonymous: boolean
  // Left out of one user's history, where it's the same on every card
  isUserShown: boolean
  timeZone?: string
}

// Built like a play's card, labelled as a request among the stats, with its
// status in Seerr among the links when Seerr's statuses are chosen. The poster
// opens the request, or once some of it is there, the item in the media server.
export default function HistoryRequestItem({
  request,
  item,
  mediaServer,
  settings,
  isAnonymous,
  isUserShown,
  timeZone,
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
      user={
        isUserShown
          ? {
              name: isAnonymous
                ? t('History.anonymous')
                : request.userName || t('History.unknownUser'),
              avatar: isAnonymous ? '' : request.avatar,
              isAnonymous,
            }
          : null
      }
      // Where a play has its watch time, so it reads as a request whether or
      // not its status is shown
      stats={
        <li className={STAT_PILL}>
          <STAT_ICONS.requests />
          {t('History.requested')}
        </li>
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
      deeplink={serverLink ?? { requestUrl, isRequested: true }}
      aside={
        <HistoryTime time={new Date(request.createdAt)} timeZone={timeZone} />
      }
      settings={settings}
    />
  )
}
