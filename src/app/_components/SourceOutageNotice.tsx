'use client'

import { StatisticsSource } from '@/types/settings'
import { STATS_SOURCE_NAMES } from '@/utils/constants'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import getSourceOutage from '../_actions/getSourceOutage'

type Props = {
  source: StatisticsSource
}

const POLL_INTERVAL = 60 * 1000

// While the source can't be reached, the stats come from what was saved, so
// they may be out of date. Asked for in the browser, so it's current on every
// page, not only the first one loaded.
export default function SourceOutageNotice({ source }: Props) {
  const t = useTranslations('Error')
  const format = useFormatter()
  const now = useNow({ updateInterval: POLL_INTERVAL })
  // As wide as the page's content
  const isWide = usePathname() === '/'
  const { data: outage } = useQuery({
    queryKey: ['sourceOutage'],
    queryFn: () => getSourceOutage(),
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
  })

  if (!outage) {
    return null
  }

  const name = STATS_SOURCE_NAMES[source]

  return (
    <div
      role='status'
      className={clsx(
        'glass animate-fade-in mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-neutral-200',
        isWide ? 'page-width-wide' : 'page-width',
      )}
    >
      <ExclamationTriangleIcon
        className='text-warning size-5 shrink-0'
        aria-hidden='true'
      />
      <p>
        {outage.updatedAt
          ? t('sourceOutage', {
              source: name,
              time: format.relativeTime(outage.updatedAt, now),
            })
          : t('sourceOutageNoTime', { source: name })}
      </p>
    </div>
  )
}
