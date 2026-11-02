import Avatar from '@/components/Avatar'
import { MediaIcon, STAT_ICONS } from '@/components/icons'
import ImageFallback from '@/components/ImageFallback'
import { HistoryRequest, RequestStatus } from '@/types/history'
import { UserIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import HistoryPoster, { ITEM_LINK_CLASS_NAME } from './HistoryPoster'

type Props = {
  request: HistoryRequest
  // Seerr's address, for the link to the title there
  seerrUrl: string
  isOwn: boolean
  isAnonymous: boolean
}

// Green once it's there, red when it won't be, and Plex gold while it's still
// on its way
const STATUS_CLASS_NAMES: Record<RequestStatus, string> = {
  pending: 'text-plex',
  approved: 'text-sky-300',
  partiallyAvailable: 'text-sky-300',
  available: 'text-success',
  declined: 'text-red-300',
  failed: 'text-red-300',
}

// Built like a play's row, with Seerr's request icon in place of the stream's
export default function HistoryRequestItem({
  request,
  seerrUrl,
  isOwn,
  isAnonymous,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { mediaType, seasons } = request
  const title = request.title || t('History.unknownTitle')
  const detail =
    mediaType === 'tv' && seasons.length
      ? seasons.length === 1
        ? t('History.season', { season: seasons[0] })
        : t('History.seasonCount', { count: seasons.length })
      : request.year && String(request.year)
  const userName = isAnonymous
    ? t('History.anonymous')
    : request.userName || t('History.unknownUser')
  const createdAt = new Date(request.createdAt)
  const href = `${seerrUrl}/${mediaType}/${request.tmdbId}`
  const type = mediaType === 'tv' ? 'show' : 'movie'

  return (
    <li className='group/item flex items-center gap-3 py-2 last:pb-0'>
      <HistoryPoster
        srcs={[request.poster]}
        type={type}
        alt={t('History.poster', { title })}
        href={href}
      />

      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm' title={title}>
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className={ITEM_LINK_CLASS_NAME}
            data-item-link
          >
            <MediaIcon
              type={type}
              className='mr-1.5 inline size-3.5 -translate-y-px text-neutral-400'
              aria-hidden='true'
            />
            <span className='sr-only'>{`${t(`History.mediaType.${type}`)}: `}</span>
            <span className='font-medium'>{title}</span>
            {detail && (
              <span className='text-neutral-400'>{` · ${detail}`}</span>
            )}
          </a>
        </p>
        <div className='flex min-w-0 items-center gap-1.5 text-xs text-neutral-400'>
          <div className='relative size-3.5 shrink-0 overflow-hidden rounded-full'>
            {isAnonymous ? (
              <ImageFallback alt={t('Activity.anonymousAvatar')}>
                <UserIcon className='size-[60cqw]' />
              </ImageFallback>
            ) : (
              <Avatar
                src={request.avatar}
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
          <span className='shrink-0'>
            {'· '}
            <span className={STATUS_CLASS_NAMES[request.status]}>
              {t(`History.requestStatus.${request.status}`)}
            </span>
          </span>
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-1.5 text-xs text-neutral-400 tabular-nums'>
        <span className='flex' title={t('History.request')}>
          <STAT_ICONS.requests className='size-4' aria-hidden='true' />
          <span className='sr-only'>{t('History.request')}</span>
        </span>
        <time dateTime={createdAt.toISOString()}>
          {new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            minute: '2-digit',
          }).format(createdAt)}
        </time>
      </div>
    </li>
  )
}
