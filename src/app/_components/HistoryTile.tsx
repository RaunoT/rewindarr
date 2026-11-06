import AutoRefresh from '@/components/AutoRefresh'
import SkeletonLine from '@/components/SkeletonLine'
import { UserAvatar } from '@/components/UserBadge'
import { DashboardSearchParams } from '@/types/dashboard'
import { Settings } from '@/types/settings'
import { TautulliLibrary } from '@/types/tautulli'
import { getRecentPlays } from '@/utils/getHistory'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { ChevronRightIcon, ClockIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Session } from 'next-auth'
import { getLocale, getNow, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import TileItem, { TILE_ITEM_COUNT, TileItemsSkeleton } from './TileItem'

type Props = {
  settings: Settings
  session: Session | null
  libraries: TautulliLibrary[]
  // The dashboard's, which the history shares
  period: DashboardSearchParams['period']
}

// The newest plays, like the activity tile's streams
export default async function HistoryTile({
  settings,
  session,
  libraries,
  period,
}: Props) {
  const t = await getTranslations()
  const { plays, progress } = await getRecentPlays(TILE_ITEM_COUNT, libraries)
  const locale = await getLocale()
  const now = await getNow()

  return (
    <div className='glass-sheet tile'>
      <HistoryTileHeading
        href={`/history${period ? `?period=${period}` : ''}`}
      />
      {plays.length ? (
        <ul className='space-y-2 text-sm'>
          {plays.slice(0, TILE_ITEM_COUNT).map((play, index) => {
            const isOwn = !!session && play.userId === session.user.id
            const isAnonymous = settings.general.isAnonymized && !isOwn
            const user = {
              name: isAnonymous
                ? t('History.anonymous')
                : play.userName || t('History.unknownUser'),
              avatar: play.avatar,
              isAnonymous,
            }

            return (
              <TileItem
                key={play.id}
                posters={[play.thumb && getImageProxyUrl(play.thumb)]}
                type={play.mediaType}
                title={play.showTitle || play.artistName || play.title}
                detail={
                  play.seasonNumber !== null && play.episodeNumber !== null
                    ? t('History.episodeNumber', {
                        season: play.seasonNumber,
                        episode: play.episodeNumber,
                      })
                    : play.mediaType === 'track' && play.artistName
                      ? play.title
                      : null
                }
                lead={
                  <TimelineMark
                    time={new Date(play.startedAt)}
                    now={now}
                    locale={locale}
                    isNewest={index === 0}
                  />
                }
                aside={<UserAvatar user={user} className='size-6' />}
                hasGlow={index === 0}
              />
            )
          })}
        </ul>
      ) : progress ? (
        <p className='text-sm text-neutral-400'>
          {t('History.syncingShort')}
          <AutoRefresh />
        </p>
      ) : (
        <p className='text-sm text-neutral-400'>{t('History.noPlays')}</p>
      )}
    </div>
  )
}

// Built like a loaded tile, so nothing moves once the data arrives
export function HistoryTileSkeleton() {
  return (
    <div className='glass-sheet flex flex-col gap-4'>
      <HistoryTileHeading />
      <TileItemsSkeleton
        lead={
          <>
            <SkeletonLine
              className='w-14 shrink-0 justify-end text-xs'
              width='w-10'
            />
            <span className='flex w-2 shrink-0 justify-center'>
              <span className='skeleton size-2' />
            </span>
          </>
        }
      />
    </div>
  )
}

// Opens the history once the tile has loaded
async function HistoryTileHeading({ href }: { href?: string }) {
  const t = await getTranslations('History')
  const heading = (
    <>
      <ClockIcon className='size-5 text-neutral-400' />
      {t('title')}
    </>
  )

  return (
    <div className='flex items-center justify-between gap-3'>
      <h2 className='font-semibold'>
        {href ? (
          <Link href={href} className='tile-link flex items-center gap-2'>
            {heading}
          </Link>
        ) : (
          <span className='flex items-center gap-2'>{heading}</span>
        )}
      </h2>
      <ChevronRightIcon className='tile-chevron' />
    </div>
  )
}

type TimelineMarkProps = {
  time: Date
  now: Date
  locale: string
  // The newest play's dot lights up
  isNewest: boolean
}

// When the play started, on a line through the plays: today's by the clock,
// older ones by the date. In the server's timezone, like the history page.
function TimelineMark({ time, now, locale, isNewest }: TimelineMarkProps) {
  const isToday = time.toDateString() === now.toDateString()

  return (
    <>
      <time
        dateTime={time.toISOString()}
        title={new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(time)}
        className='w-14 shrink-0 text-right text-xs whitespace-nowrap text-neutral-400 tabular-nums'
      >
        {new Intl.DateTimeFormat(
          locale,
          isToday
            ? { hour: 'numeric', minute: '2-digit' }
            : { day: 'numeric', month: 'short' },
        ).format(time)}
      </time>
      <span
        aria-hidden='true'
        className='relative flex w-2 shrink-0 justify-center self-stretch'
      >
        {/* Through the gap to the next row, from the first dot to the last */}
        <span className='absolute top-0 -bottom-2 w-px bg-white/15 group-first/tile-item:top-1/2 group-last/tile-item:bottom-1/2' />
        <span
          className={clsx(
            'relative size-2 self-center rounded-full',
            isNewest
              ? 'bg-white shadow-[0_0_8px_rgb(255_255_255/60%)]'
              : 'bg-neutral-500',
          )}
        />
      </span>
    </>
  )
}
