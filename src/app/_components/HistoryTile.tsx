import AutoRefresh from '@/components/AutoRefresh'
import { MediaIcon } from '@/components/icons'
import SkeletonLine from '@/components/SkeletonLine'
import { DashboardSearchParams } from '@/types/dashboard'
import { Settings } from '@/types/settings'
import { TautulliLibrary } from '@/types/tautulli'
import { getRecentPlays } from '@/utils/getHistory'
import { ChevronRightIcon, ClockIcon } from '@heroicons/react/24/outline'
import { Session } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

const PLAY_COUNT = 3

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
  const { plays, progress } = await getRecentPlays(PLAY_COUNT, libraries)

  return (
    <Link
      href={`/history${period ? `?period=${period}` : ''}`}
      className='glass-sheet group focus-visible:focus-ring flex flex-col gap-4 transition-colors hover:bg-white/5'
    >
      <HistoryTileHeading />
      {plays.length ? (
        <ul className='space-y-1 text-sm'>
          {plays.slice(0, PLAY_COUNT).map((play) => {
            const isOwn = !!session && play.userId === session.user.id

            return (
              <li key={play.id} className='flex min-w-0 items-center gap-2'>
                <MediaIcon
                  type={play.mediaType}
                  className='size-4 shrink-0 text-neutral-400'
                />
                <span className='truncate'>
                  {play.showTitle || play.artistName || play.title}
                </span>
                <span className='max-w-1/2 shrink-0 truncate text-neutral-400'>
                  {settings.general.isAnonymized && !isOwn
                    ? t('History.anonymous')
                    : play.userName || t('History.unknownUser')}
                </span>
              </li>
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
    </Link>
  )
}

// Built like a loaded tile, so nothing moves once the data arrives
export function HistoryTileSkeleton() {
  return (
    <div className='glass-sheet flex flex-col gap-4'>
      <HistoryTileHeading />
      <div className='space-y-1 text-sm'>
        {[...Array(PLAY_COUNT)].map((_, i) => (
          <SkeletonLine key={i} width={i % 2 ? 'w-1/2' : 'w-2/3'} />
        ))}
      </div>
    </div>
  )
}

async function HistoryTileHeading() {
  const t = await getTranslations('History')

  return (
    <div className='flex items-center justify-between gap-3'>
      <h2 className='flex items-center gap-2 font-semibold'>
        <ClockIcon className='size-5 text-neutral-400' />
        {t('title')}
      </h2>
      <ChevronRightIcon className='size-4 text-neutral-500 transition-transform group-hover:translate-x-0.5' />
    </div>
  )
}
