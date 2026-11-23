import CardWrapper from '@/app/_components/CardWrapper'
import { MediaIcon, STAT_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import SkeletonSized from '@/components/SkeletonSized'
import StatusMessage from '@/components/StatusMessage'
import Totals, { Total } from '@/components/Totals'
import { PublicSettings } from '@/types/settings'
import { ItemRow, MediaServer } from '@/types/statsSource'
import { secondsToTime } from '@/utils/formatting'
import { MoonIcon } from '@heroicons/react/24/outline'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ReactNode, Suspense } from 'react'
import { DashboardListSkeleton, getTotalLabel } from './DashboardLoader'
import ShowMore from './ShowMore'

type Props = {
  items?: ItemRow[] | null
  // In seconds
  totalDuration?: number
  totalRequests?: number
  totalSize?: string | number
  type: 'movie' | 'show' | 'artist' | 'users'
  mediaServer?: MediaServer | null
  count?: string
  settings: PublicSettings
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
  nextLimit,
  status,
}: Props) {
  const t = await getTranslations()
  const format = await getFormatter()
  const totals: Total[] = []

  if (totalDuration !== undefined) {
    totals.push({
      key: 'duration',
      icon: <STAT_ICONS.duration />,
      label: getTotalLabel('duration', type, t),
      value: secondsToTime(totalDuration, t),
      shortValue: secondsToTime(totalDuration, t, true),
    })
  }

  if (totalRequests !== undefined) {
    totals.push({
      key: 'requests',
      icon: <STAT_ICONS.requests />,
      label: getTotalLabel('requests', type, t),
      value: format.number(totalRequests),
    })
  }

  if (count && type !== 'users') {
    totals.push({
      key: 'count',
      icon: <MediaIcon type={type} />,
      label: getTotalLabel('count', type, t),
      value: count,
    })
  }

  if (totalSize) {
    totals.push(
      type === 'users'
        ? {
            key: 'users',
            icon: <STAT_ICONS.users />,
            label: getTotalLabel('users', type, t),
            value: format.number(Number(totalSize)),
          }
        : {
            key: 'size',
            icon: <STAT_ICONS.size />,
            label: getTotalLabel('size', type, t),
            value: totalSize,
          },
    )
  }

  return (
    <>
      <Totals totals={totals} />

      <CardWrapper>
        {!status && items?.length ? (
          <>
            <MediaItems
              items={items}
              type={type}
              mediaServer={mediaServer}
              settings={settings}
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
