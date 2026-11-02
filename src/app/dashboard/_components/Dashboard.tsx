import CardWrapper from '@/app/_components/CardWrapper'
import { MediaIcon, STAT_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import SkeletonSized from '@/components/SkeletonSized'
import StatusMessage from '@/components/StatusMessage'
import Totals, { Total } from '@/components/Totals'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { MoonIcon } from '@heroicons/react/24/outline'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ReactNode, Suspense } from 'react'
import { DashboardListSkeleton } from './DashboardLoader'
import ShowMore from './ShowMore'

type Props = {
  items?: TautulliItemRow[] | null
  totalDuration?: string
  totalRequests?: number
  totalSize?: string | number
  type: 'movie' | 'show' | 'artist' | 'users'
  mediaServer?: MediaServer | null
  count?: string
  settings: PublicSettings
  loggedInUserId?: string
  toolbar: ReactNode
  // The limit "Show more" leads to, left out when there's nothing more
  nextLimit?: number
  // Shown in the card instead of the items, such as while they can't be read yet
  status?: ReactNode
}

export default async function Dashboard({
  items,
  totalDuration,
  totalRequests,
  totalSize,
  type,
  mediaServer = null,
  count,
  settings,
  loggedInUserId,
  toolbar,
  nextLimit,
  status,
}: Props) {
  const t = await getTranslations()
  const format = await getFormatter()
  const totals: Total[] = []

  if (totalDuration) {
    totals.push({
      key: 'duration',
      icon: <STAT_ICONS.duration />,
      // Users count music too, so neither watched nor listened
      label:
        type === 'users'
          ? t('Totals.playTime')
          : type === 'artist'
            ? t('Totals.listenTime')
            : t('Common.duration'),
      value: totalDuration,
    })
  }

  if (totalRequests !== undefined) {
    totals.push({
      key: 'requests',
      icon: <STAT_ICONS.requests />,
      label: t('Common.requests'),
      value: format.number(totalRequests),
    })
  }

  if (count && type !== 'users') {
    totals.push({
      key: 'count',
      icon: <MediaIcon type={type} />,
      label:
        type === 'movie'
          ? t('Totals.movies')
          : type === 'show'
            ? t('Totals.episodes')
            : t('Totals.tracks'),
      value: count,
    })
  }

  if (totalSize) {
    totals.push(
      type === 'users'
        ? {
            key: 'users',
            icon: <STAT_ICONS.users />,
            label: t('Common.users'),
            value: format.number(Number(totalSize)),
          }
        : {
            key: 'size',
            icon: <STAT_ICONS.size />,
            label: t('Common.size'),
            value: totalSize,
          },
    )
  }

  return (
    <>
      {toolbar}
      <Totals totals={totals} />

      <CardWrapper>
        {!status && items?.length ? (
          <>
            <MediaItems
              items={items}
              type={type}
              mediaServer={mediaServer}
              settings={settings}
              loggedInUserId={loggedInUserId}
            />
            {/* Into the card's padding, so the button has as much room below as above */}
            {nextLimit && (
              <div className='mt-2.5 -mb-2.5 flex justify-center border-t border-white/10 pt-2.5'>
                <Suspense>
                  <ShowMore limit={nextLimit} />
                </Suspense>
              </div>
            )}
          </>
        ) : (
          <SkeletonSized
            skeleton={<DashboardListSkeleton type={type} settings={settings} />}
          >
            {status ?? (
              <StatusMessage
                icon={MoonIcon}
                description={t('Dashboard.noActivity')}
                isInCard
              />
            )}
          </SkeletonSized>
        )}
      </CardWrapper>
    </>
  )
}
