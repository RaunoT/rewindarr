import CardWrapper from '@/app/_components/CardWrapper'
import { TotalsSkeleton, TotalSkeleton } from '@/components/Totals'
import { authOptions } from '@/lib/auth'
import { HISTORY_PAGE_SIZE_COOKIE_NAME } from '@/utils/constants'
import { parsePageSize } from '@/utils/getHistory'
import getSettings from '@/utils/getSettings'
import { getOwnOnlyUserId } from '@/utils/helpers'
import { isSeerrActive } from '@/utils/historyRequests'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import HistorySkeleton from './_components/HistorySkeleton'

// Matches HistoryPage's toolbar, totals and list card while the history loads
export default async function Loading() {
  const settings = getSettings()
  const [session, cookieStore, t] = await Promise.all([
    getServerSession(authOptions),
    cookies(),
    getTranslations(),
  ])
  const pageSize = parsePageSize(
    undefined,
    cookieStore.get(HISTORY_PAGE_SIZE_COOKIE_NAME)?.value,
  )
  const hasRequests = isSeerrActive(settings)
  const isOwnOnly = !!getOwnOnlyUserId(settings, 'history', session)
  const hasUserFilter =
    !isOwnOnly && (!settings.general.isAnonymized || !!session)
  const hasMoreFilters =
    hasRequests || settings.general.activeLibraries.length > 1 || hasUserFilter
  const { activeExternalLinks, activeItemStatistics } = settings.general
  const totals: TotalSkeleton[] = [
    { label: t('Totals.playTime'), kind: 'duration' },
    { label: t('Common.plays'), kind: 'count' },
    ...(hasRequests
      ? [{ label: t('Common.requests'), kind: 'smallCount' as const }]
      : []),
    ...(!isOwnOnly
      ? [{ label: t('Common.users'), kind: 'smallCount' as const }]
      : []),
  ]

  return (
    <>
      <div
        className='mb-4 flex flex-wrap items-center gap-2'
        aria-hidden='true'
      >
        <div className='skeleton h-10 min-w-40 flex-1' />
        <div className='skeleton h-10 w-64 max-sm:order-last max-sm:w-full' />
        {hasMoreFilters && <div className='skeleton h-10 w-10 sm:w-24' />}
      </div>
      <TotalsSkeleton totals={totals} />
      <CardWrapper>
        <HistorySkeleton
          rows={pageSize}
          general={{ activeExternalLinks, activeItemStatistics }}
          isSeerrActive={hasRequests}
          isUserShown={!isOwnOnly}
        />
      </CardWrapper>
    </>
  )
}
