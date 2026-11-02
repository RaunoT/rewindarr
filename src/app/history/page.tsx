import AutoRefresh from '@/components/AutoRefresh'
import HistoryReading from '@/components/HistoryReading'
import { STAT_ICONS } from '@/components/icons'
import SkeletonLine from '@/components/SkeletonLine'
import SkeletonSized from '@/components/SkeletonSized'
import SourceUnreachable from '@/components/SourceUnreachable'
import StatusMessage from '@/components/StatusMessage'
import { authOptions } from '@/lib/auth'
import { DashboardSearchParams } from '@/types/dashboard'
import { HistoryKind, HistoryTotals } from '@/types/history'
import { Settings } from '@/types/settings'
import { HISTORY_PAGE_SIZE_COOKIE_NAME } from '@/utils/constants'
import { secondsToTime } from '@/utils/formatting'
import {
  getHistoryPage,
  groupByDay,
  HistoryFilter,
  parsePage,
  parsePageSize,
} from '@/utils/getHistory'
import getPeriod from '@/utils/getPeriod'
import getSettings from '@/utils/getSettings'
import {
  canViewFeature,
  getViewer,
  sortByActiveLibraries,
} from '@/utils/helpers'
import { isSeerrActive } from '@/utils/historyRequests'
import { LIBRARY_PLAY_TYPES } from '@/utils/playStats'
import { toPublicSettings } from '@/utils/publicSettings'
import {
  getActiveUsers,
  getMediaServer,
  getReachableLibraries,
} from '@/utils/statsSource'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MoonIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { kebabCase, sortBy } from 'lodash'
import { Metadata } from 'next'
import { getServerSession, Session } from 'next-auth'
import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import CardWrapper from '../_components/CardWrapper'
import HistoryFilters, { FilterOption } from './_components/HistoryFilters'
import HistoryItem from './_components/HistoryItem'
import HistoryPagination from './_components/HistoryPagination'
import HistoryRequestItem from './_components/HistoryRequestItem'
import HistorySkeleton from './_components/HistorySkeleton'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('History')

  return {
    title: t('title'),
  }
}

type SearchParams = {
  period?: DashboardSearchParams['period']
  library?: string
  user?: string
  kind?: string
  q?: string
  page?: string
  rows?: string
}

const KINDS: HistoryKind[] = ['play', 'request']

// The users the history can be narrowed down to. Picking another user would
// give them away when the server is anonymized, so then only your own.
async function getUserOptions(
  settings: Settings,
  session: Session | null,
): Promise<FilterOption[]> {
  const t = await getTranslations('History')

  if (settings.general.isAnonymized) {
    return session ? [{ value: session.user.id, label: t('onlyMine') }] : []
  }

  const users = await getActiveUsers(settings)

  return sortBy(
    users.map((user) => ({
      value: String(user.user_id),
      label: user.friendly_name || user.username,
    })),
    (option) => option.label.toLowerCase(),
  )
}

type TotalsProps = {
  totals: HistoryTotals
  filter: HistoryFilter
  hasRequests: boolean
}

// What the period adds up to with the filters, like the dashboard's
async function Totals({ totals, filter, hasRequests }: TotalsProps) {
  const t = await getTranslations()

  return (
    <ul className='icon-stats-container mb-4 gap-x-3 text-neutral-300'>
      {filter.kind !== 'request' && (
        <>
          <li className='icon-stat-wrapper icon-stat-wrapper--clean'>
            <STAT_ICONS.duration />
            {t('Dashboard.durationPlayed', {
              duration: secondsToTime(totals.watchTime, t),
            })}
          </li>
          <li className='icon-stat-wrapper icon-stat-wrapper--clean'>
            <PlayIcon />
            {t('History.playCount', { count: totals.plays })}
          </li>
        </>
      )}
      {hasRequests && filter.kind !== 'play' && (
        <li className='icon-stat-wrapper icon-stat-wrapper--clean'>
          <STAT_ICONS.requests />
          {t('Dashboard.requests', { count: totals.requests })}
        </li>
      )}
      {/* Says nothing when it's one user's history */}
      {!filter.userId && (
        <li className='icon-stat-wrapper icon-stat-wrapper--clean'>
          <STAT_ICONS.users />
          {t('Dashboard.users', { count: totals.users })}
        </li>
      )}
    </ul>
  )
}

// As tall as the totals, so the card doesn't move once they load
function TotalsSkeleton() {
  return (
    <div className='icon-stats-container mb-4 gap-x-3'>
      <SkeletonLine width='w-28' />
      <SkeletonLine width='w-16' />
      <SkeletonLine width='w-20' />
    </div>
  )
}

function HistoryLoader({ rows }: { rows: number }) {
  return (
    <>
      <TotalsSkeleton />
      <CardWrapper>
        <HistorySkeleton rows={rows} />
      </CardWrapper>
    </>
  )
}

type ContentProps = {
  filter: HistoryFilter
  page: number
  pageSize: number
  // The URL's search parameters without the page
  params: URLSearchParams
  settings: Settings
  session: Session | null
  hasRequests: boolean
}

async function HistoryContent({
  filter,
  page: pageParam,
  pageSize,
  params,
  settings,
  session,
  hasRequests,
}: ContentProps) {
  const t = await getTranslations('History')
  const locale = await getLocale()
  const [
    { entries, page, pageCount, totals, progress, hasRequestsFailed },
    mediaServer,
  ] = await Promise.all([
    getHistoryPage(filter, pageParam, pageSize),
    getMediaServer(),
  ])
  // Without Seerr, the plays are all there is, which isn't a filter
  const isFiltered = !!(
    filter.userId ||
    filter.search ||
    (hasRequests && filter.kind)
  )
  const totalsList = (
    <Totals totals={totals} filter={filter} hasRequests={hasRequests} />
  )
  const requestsNotice = hasRequestsFailed && (
    <p className='mb-3 flex items-center gap-2 text-sm text-red-300'>
      <ExclamationTriangleIcon className='size-4 shrink-0' />
      {t('requestsFailed')}
    </p>
  )

  if (!entries.length) {
    return (
      <>
        {totalsList}
        <CardWrapper>
          {requestsNotice}
          <SkeletonSized skeleton={<HistorySkeleton rows={pageSize} />}>
            {progress ? (
              <HistoryReading progress={progress} isInCard />
            ) : (
              <StatusMessage
                icon={MoonIcon}
                description={isFiltered ? t('noMatches') : t('noPlays')}
                isInCard
              />
            )}
          </SkeletonSized>
        </CardWrapper>
      </>
    )
  }

  const userId = session?.user.id
  const { isAnonymized } = settings.general
  const now = new Date()
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const dayWithYearFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function getHref(page: number) {
    const pageParams = new URLSearchParams(params)

    if (page > 1) {
      pageParams.set('page', String(page))
    }

    return pageParams.size ? `/history?${pageParams.toString()}` : '/history'
  }

  return (
    <>
      {totalsList}
      <CardWrapper>
        {requestsNotice}
        {progress && (
          <>
            <p className='mb-3 flex items-center gap-2 text-sm text-neutral-400'>
              <ArrowPathIcon className='size-4 shrink-0 motion-safe:animate-spin' />
              {t('syncingShort')}
            </p>
            <AutoRefresh />
          </>
        )}
        <div className='flex flex-col gap-4'>
          {groupByDay(entries, now.getTime()).map((day) => (
            <section key={day.date.getTime()}>
              <h2 className='mb-1 text-xs font-semibold text-neutral-400'>
                {day.daysAgo === 0
                  ? t('today')
                  : day.daysAgo === 1
                    ? t('yesterday')
                    : (day.date.getFullYear() === now.getFullYear()
                        ? dayFormat
                        : dayWithYearFormat
                      ).format(day.date)}
              </h2>
              <ul className='divide-y divide-white/10'>
                {day.entries.map((entry) => {
                  const entryUserId =
                    entry.kind === 'play'
                      ? entry.play.userId
                      : entry.request.userId
                  const isOwn = !!userId && entryUserId === userId
                  const isAnonymous = isAnonymized && !isOwn

                  return entry.kind === 'play' ? (
                    <HistoryItem
                      key={`play-${entry.play.id}`}
                      play={entry.play}
                      mediaServer={mediaServer}
                      isOwn={isOwn}
                      isAnonymous={isAnonymous}
                    />
                  ) : (
                    <HistoryRequestItem
                      key={`request-${entry.request.id}`}
                      request={entry.request}
                      seerrUrl={settings.connection.seerrUrl ?? ''}
                      isOwn={isOwn}
                      isAnonymous={isAnonymous}
                    />
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        <HistoryPagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          getHref={getHref}
        />
      </CardWrapper>
    </>
  )
}

type Props = {
  searchParams: Promise<SearchParams>
}

export default async function HistoryPage({ searchParams }: Props) {
  const {
    period: periodParam,
    library: libraryParam,
    user,
    kind: kindParam,
    q,
    page,
    rows,
  } = await searchParams
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'history', getViewer(session))) {
    return notFound()
  }

  const pageSize = parsePageSize(
    rows,
    (await cookies()).get(HISTORY_PAGE_SIZE_COOKIE_NAME)?.value,
  )
  const hasRequests = isSeerrActive(settings)
  const [reachableLibraries, users] = await Promise.all([
    getReachableLibraries(),
    getUserOptions(settings, session),
  ])
  const filters = (libraries: FilterOption[] = []) => (
    <Suspense>
      <HistoryFilters
        settings={toPublicSettings(settings)}
        libraries={libraries}
        users={users}
        hasRequests={hasRequests}
      />
    </Suspense>
  )

  if (reachableLibraries === null) {
    return (
      <>
        {filters()}
        <CardWrapper>
          <SkeletonSized skeleton={<HistorySkeleton rows={pageSize} />}>
            <SourceUnreachable
              source={settings.connection.statisticsSource}
              isAdmin={!!session?.user.isAdmin}
              isInCard
            />
          </SkeletonSized>
        </CardWrapper>
      </>
    )
  }

  // Libraries such as photos have no plays
  const libraries = sortByActiveLibraries(reachableLibraries, settings).filter(
    (library) => library.section_type in LIBRARY_PLAY_TYPES,
  )
  const library = libraries.find(
    (library) => kebabCase(library.section_name) === libraryParam,
  )
  // Only the users the filter offers, so the URL can't pick an excluded one
  const userId = users.find((option) => option.value === user)?.value
  const kind = hasRequests ? KINDS.find((value) => value === kindParam) : 'play'
  const search = q?.trim() || undefined
  const period = getPeriod(periodParam, settings)
  // The filters the URL asked for that apply, which the page links keep
  const params = new URLSearchParams({
    ...(periodParam && { period: periodParam }),
    ...(library && { library: kebabCase(library.section_name) }),
    ...(userId && { user: userId }),
    ...(hasRequests && kind && { kind }),
    ...(search && { q: search }),
    ...(rows && { rows: String(pageSize) }),
  })

  return (
    <>
      {filters(
        libraries.map((library) => ({
          value: kebabCase(library.section_name),
          label: library.section_name,
        })),
      )}
      <Suspense
        fallback={<HistoryLoader rows={pageSize} />}
        // Without the page, so the list stays up while the next one loads
        key={params.toString()}
      >
        <HistoryContent
          filter={{
            since: period.date,
            libraries: library ? [library] : libraries,
            userId,
            search,
            kind,
          }}
          page={parsePage(page)}
          pageSize={pageSize}
          params={params}
          settings={settings}
          session={session}
          hasRequests={hasRequests}
        />
      </Suspense>
    </>
  )
}
