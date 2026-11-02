import { STAT_ICONS } from '@/components/icons'
import { HistoryRequest } from '@/types/history'
import { PublicSettings } from '@/types/settings'
import { TautulliItemRow } from '@/types/tautulli'
import { useTranslations } from 'next-intl'
import HistoryCard, { STAT_PILL } from './HistoryCard'

type Props = {
  request: HistoryRequest
  // The title's year, ratings and IDs
  item: TautulliItemRow | null | undefined
  settings: PublicSettings
  isOwn: boolean
  isAnonymous: boolean
}

// Built like a play's card, with Seerr's request icon and the request's
// status where the play's watch time and stream go
export default function HistoryRequestItem({
  request,
  item,
  settings,
  isOwn,
  isAnonymous,
}: Props) {
  const t = useTranslations()
  const { mediaType, seasons } = request
  const title = request.title || t('History.unknownTitle')
  const detail =
    mediaType === 'tv' && seasons.length
      ? seasons.length === 1
        ? t('History.season', { season: seasons[0] })
        : t('History.seasonCount', { count: seasons.length })
      : null

  return (
    <HistoryCard
      type={mediaType === 'tv' ? 'show' : 'movie'}
      mediaType={mediaType === 'tv' ? 'show' : 'movie'}
      item={item}
      name={title}
      detail={detail}
      fullTitle={detail ? `${title} · ${detail}` : title}
      href={`${settings.connection.seerrUrl}/${mediaType}/${request.tmdbId}`}
      posters={[request.poster]}
      user={{
        name: isAnonymous
          ? t('History.anonymous')
          : request.userName || t('History.unknownUser'),
        avatar: request.avatar,
        isOwn,
        isAnonymous,
      }}
      stats={
        <li className={STAT_PILL}>
          <STAT_ICONS.requests />
          <span className='sr-only'>{`${t('History.request')}: `}</span>
          {t(`History.requestStatus.${request.status}`)}
        </li>
      }
      time={new Date(request.createdAt)}
      settings={settings}
    />
  )
}
