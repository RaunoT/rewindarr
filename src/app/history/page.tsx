import AutoRefresh from '@/components/AutoRefresh'
import HistoryReading from '@/components/HistoryReading'
import { STAT_ICONS } from '@/components/icons'
import SkeletonSized from '@/components/SkeletonSized'
import SourceUnreachable from '@/components/SourceUnreachable'
import StatusMessage from '@/components/StatusMessage'
import Totals, { Total, TotalsSkeleton } from '@/components/Totals'
import { authOptions } from '@/lib/auth'
import { DashboardSearchParams } from '@/types/dashboard'
import { HistoryEntry, HistoryKind, HistoryTotals } from '@/types/history'
import { Settings } from '@/types/settings'
import { HISTORY_PAGE_SIZE_COOKIE_NAME } from '@/utils/constants'
import { secondsToTime } from '@/utils/formatting'
import {
  getHistoryPage,
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
import { kebabCase, sortBy, upperFirst } from 'lodash'
import { Metadata } from 'next'
import { getServerSession, Session } from 'next-auth'
import {
  getFormatter,
  getLocale,
  getNow,
  getTranslations,
} from 'next-intl/server'
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
  // Repeated for each library and user picked
  library?: string | string[]
  user?: string | string[]
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
      // The picture itself, as Tracearr's thumb is already proxied
      avatar: user.user_thumb || user.thumb,
    })),
    (option) => option.label.toLowerCase(),
  )
}

type HistoryDay = {
  key: string
  date: Date
  entries: HistoryEntry[]
}

// The entries under a heading for each day, in the server's timezone like
// their times. A day split between pages gets one on each.
function groupByDay(entries: HistoryEntry[]): HistoryDay[] {
  const days: HistoryDay[] = []

  for (const entry of entries) {
    const date = new Date(entry.time)
    const key = date.toDateString()
    const day = days.at(-1)

    if (day?.key === key) {
      day.entries.push(entry)
    } else {
      days.push({ key, date, entries: [entry] })
    }
  }

  return days
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Today and yesterday by name, other days by their date, with the year when
// it isn't this one's
function getDayLabel(date: Date, now: Date, locale: string): string {
  const daysAgo = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000),
  )

  if (daysAgo === 0 || daysAgo === 1) {
    return upperFirst(
      new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        -daysAgo,
        'day',
      ),
    )
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

type TotalsProps = {
  totals: HistoryTotals
  filter: HistoryFilter
  hasRequests: boolean
}

// The totals that say something with the filters
function getTotalKeys(filter: HistoryFilter, hasRequests: boolean) {
  return [
    ...(filter.kind !== 'request' ? (['watchTime', 'plays'] as const) : []),
    ...(hasRequests && filter.kind !== 'play' ? (['requests'] as const) : []),
    // Says nothing when it's one user's history
    ...(filter.userIds?.length !== 1 ? (['users'] as const) : []),
  ]
}

// What the period adds up to with the filters, like the dashboard's
async function HistoryTotalsRow({ totals, filter, hasRequests }: TotalsProps) {
  const t = await getTranslations()
  const format = await getFormatter()
  const items: Record<ReturnType<typeof getTotalKeys>[number], Total> = {
    watchTime: {
      key: 'watchTime',
      icon: <STAT_ICONS.duration />,
      // Music counts too, so neither watched nor listened
      label: t('Totals.playTime'),
      value: secondsToTime(totals.watchTime, t),
    },
    plays: {
      key: 'plays',
      icon: <PlayIcon />,
      label: t('Common.plays'),
      value: format.number(totals.plays),
    },
    requests: {
      key: 'requests',
      icon: <STAT_ICONS.requests />,
      label: t('Common.requests'),
      value: format.number(totals.requests),
    },
    users: {
      key: 'users',
      icon: <STAT_ICONS.users />,
      label: t('Common.users'),
      value: format.number(totals.users),
    },
  }

  return (
    <Totals
      totals={getTotalKeys(filter, hasRequests).map((key) => items[key])}
    />
  )
}

function HistoryLoader({
  rows,
  totalsCount,
}: {
  rows: number
  totalsCount: number
}) {
  return (
    <>
      <TotalsSkeleton count={totalsCount} />
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
  const [
    { entries, page, pageCount, totals, progress, hasRequestsFailed },
    mediaServer,
  ] = await Promise.all([
    getHistoryPage(filter, pageParam, pageSize),
    getMediaServer(),
  ])
  // Without Seerr, the plays are all there is, which isn't a filter
  const isFiltered = !!(
    filter.userIds?.length ||
    filter.search ||
    (hasRequests && filter.kind)
  )
  const totalsList = (
    <HistoryTotalsRow
      totals={totals}
      filter={filter}
      hasRequests={hasRequests}
    />
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
  const publicSettings = toPublicSettings(settings)
  // One user's history would show them on every card
  const isUserShown = filter.userIds?.length !== 1
  const [locale, now] = await Promise.all([getLocale(), getNow()])

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
        <ol className='flex flex-col gap-5'>
          {groupByDay(entries).map((day) => (
            <li key={day.key}>
              {/* Stays at the top while its day scrolls by, until the next
                  day's pushes it out */}
              <h2 className='glass-pill sticky top-4 z-20 mb-3 w-fit bg-neutral-900/70 px-3 py-1 text-sm font-medium text-neutral-300'>
                {getDayLabel(day.date, now, locale)}
              </h2>
              <ul className='flex flex-col text-white'>
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
                      binge={entry.binge}
                      item={entry.item}
                      mediaServer={mediaServer}
                      settings={publicSettings}
                      isAnonymous={isAnonymous}
                      isUserShown={isUserShown}
                    />
                  ) : (
                    <HistoryRequestItem
                      key={`request-${entry.request.id}`}
                      request={entry.request}
                      item={entry.item}
                      mediaServer={mediaServer}
                      settings={publicSettings}
                      isAnonymous={isAnonymous}
                      isUserShown={isUserShown}
                    />
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
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
  const libraryParams = [libraryParam ?? []].flat()
  const pickedLibraries = libraries.filter((library) =>
    libraryParams.includes(kebabCase(library.section_name)),
  )
  // Only the users the filter offers, so the URL can't pick an excluded one
  const userIds = [user ?? []]
    .flat()
    .filter((userId) => users.some((option) => option.value === userId))
  const kind = hasRequests ? KINDS.find((value) => value === kindParam) : 'play'
  const search = q?.trim() || undefined
  const period = getPeriod(periodParam, settings)
  // The filters the URL asked for that apply, which the page links keep
  const filter: HistoryFilter = {
    since: period.date,
    libraries: pickedLibraries.length ? pickedLibraries : libraries,
    userIds,
    search,
    kind,
  }
  const params = new URLSearchParams([
    ...(periodParam ? [['period', periodParam]] : []),
    ...pickedLibraries.map((library) => [
      'library',
      kebabCase(library.section_name),
    ]),
    ...userIds.map((userId) => ['user', userId]),
    ...(hasRequests && kind ? [['kind', kind]] : []),
    ...(search ? [['q', search]] : []),
    ...(rows ? [['rows', String(pageSize)]] : []),
  ])

  return (
    <>
      {filters(
        libraries.map((library) => ({
          value: kebabCase(library.section_name),
          label: library.section_name,
          type: library.section_type,
        })),
      )}
      <Suspense
        fallback={
          <HistoryLoader
            rows={pageSize}
            totalsCount={getTotalKeys(filter, hasRequests).length}
          />
        }
        // Without the page, so the list stays up while the next one loads
        key={params.toString()}
      >
        <HistoryContent
          filter={filter}
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
