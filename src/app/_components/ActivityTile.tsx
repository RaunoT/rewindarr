'use client'

import getActivity from '@/app/activity/_actions/getActivity'
import PlaybackOverlay from '@/components/PlaybackOverlay'
import SkeletonLine from '@/components/SkeletonLine'
import { UserAvatar } from '@/components/UserBadge'
import { useMediaDetails } from '@/hooks/useMediaDetails'
import { PublicSettings } from '@/types/settings'
import { TautulliSession } from '@/types/tautulli'
import { STATS_SOURCE_NAMES } from '@/utils/constants'
import { toIndex } from '@/utils/formatting'
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import TileItem, { TILE_ITEM_COUNT } from './TileItem'

type Props = {
  settings: PublicSettings
}

// Shares its query with the activity page, so both stay in sync
export default function ActivityTile({ settings }: Props) {
  const t = useTranslations()
  const { data: session } = useSession()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  // Null when the server got nothing from the source
  const isUnavailable = isError || data === null

  return (
    <Link
      href='/activity'
      className='glass-sheet group focus-visible:focus-ring flex flex-col gap-4 transition-colors hover:bg-white/5'
    >
      <div className='flex items-center justify-between gap-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <SignalIcon className='size-5 text-neutral-400' />
          {t('Activity.title')}
        </h2>
        <div className='flex shrink-0 items-center gap-1 text-xs text-neutral-400'>
          {isLoading ? (
            <SkeletonLine width='w-16' />
          ) : (
            !isUnavailable &&
            !!data?.stream_count && (
              <span className='flex items-center gap-1.5'>
                <LiveDot />
                {t('Home.streams', { count: data.stream_count })}
              </span>
            )
          )}
          <ChevronRightIcon className='size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5' />
        </div>
      </div>
      {isUnavailable ? (
        <p className='flex items-center gap-2 text-sm text-red-300'>
          <ExclamationTriangleIcon className='size-5 shrink-0' />
          {isError
            ? t('Activity.loadError')
            : t('Error.sourceUnreachable', {
                source:
                  STATS_SOURCE_NAMES[settings.connection.statisticsSource],
              })}
        </p>
      ) : (
        !isLoading &&
        !data?.stream_count && (
          // Big and at the bottom, so the empty tile doesn't look unfinished
          <p className='mt-auto text-2xl font-semibold tracking-tight'>
            {t('Home.streams', { count: 0 })}
          </p>
        )
      )}
      {!isUnavailable && !!data?.sessions.length && (
        <ul className='space-y-2 text-sm'>
          {data.sessions.slice(0, TILE_ITEM_COUNT).map((item, index) => (
            <ActivityTileItem
              key={item.session_key}
              session={item}
              index={index}
              settings={settings}
              userId={session?.user.id}
            />
          ))}
        </ul>
      )}
    </Link>
  )
}

type ItemProps = {
  session: TautulliSession
  index: number
  settings: PublicSettings
  // The signed-in user's
  userId?: string
}

// The poster is found like the activity page's, which shares the query
function ActivityTileItem({ session, index, settings, userId }: ItemProps) {
  const t = useTranslations()
  const { posterUrl, isPosterLoading, details } = useMediaDetails(
    session,
    settings,
  )
  const isOwn = String(session.user_id) === userId
  const isAnonymous = settings.general.isAnonymized && !isOwn
  const user = {
    name: isAnonymous
      ? t('Activity.anonymous', { number: index + 1 })
      : session.friendly_name,
    avatar: session.user_thumb,
    isOwn,
    isAnonymous,
  }
  const season = toIndex(session.parent_media_index)
  const episode = toIndex(session.media_index)

  return (
    <TileItem
      posters={[posterUrl, details?.poster]}
      type={session.media_type}
      isPosterLoading={isPosterLoading}
      title={session.grandparent_title || session.title}
      detail={
        session.media_type === 'episode' && season !== null && episode !== null
          ? t('History.episodeNumber', { season, episode })
          : session.media_type === 'track' && session.grandparent_title
            ? session.title
            : null
      }
      aside={<UserAvatar user={user} className='size-6' isOwnMarked />}
      posterOverlay={
        <PlaybackOverlay state={session.state} className='size-3.5' />
      }
      hasGlow={index === 0}
    />
  )
}

// Pulses while something plays
function LiveDot() {
  return (
    <span className='relative flex size-2' aria-hidden='true'>
      <span className='bg-success absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping' />
      <span className='bg-success relative inline-flex size-2 rounded-full' />
    </span>
  )
}
