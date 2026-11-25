import HistoryReading from '@/components/HistoryReading'
import { authOptions } from '@/lib/auth'
import { DashboardSearchParams } from '@/types/dashboard'
import {
  getItems,
  getItemsLimit,
  getNextItemsLimit,
  getTotalCount,
  getTotalDuration,
  getTotalRequests,
  getTotalSize,
} from '@/utils/getDashboard'
import getPeriod from '@/utils/getPeriod'
import getSettings from '@/utils/getSettings'
import {
  canViewFeature,
  getDashboardFilterAccess,
  getDashboardSort,
  getLibrarySlug,
  getOwnOnlyUserId,
  getViewer,
} from '@/utils/helpers'
import { toPublicSettings } from '@/utils/publicSettings'
import {
  getHistoryProgress,
  getLibraries,
  getMediaServer,
} from '@/utils/statsSource'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Dashboard from '../_components/Dashboard'
import DashboardLoader from '../_components/DashboardLoader'
import DashboardToolbar from '../_components/DashboardToolbar'

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}): Promise<Metadata> {
  const { slug } = await params
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'dashboard', getViewer(session))) {
    return {}
  }

  const libraries = await getLibraries()
  const library = libraries.find((library) => getLibrarySlug(library) === slug)

  if (!library || !library.is_active) {
    return {}
  }

  return {
    title: library.section_name,
  }
}

async function DashboardContent({
  slug,
  periodSp,
  personalSp,
  sortBySp,
  limit,
}: {
  slug: string
  periodSp: DashboardSearchParams['period']
  personalSp: DashboardSearchParams['personal']
  sortBySp: DashboardSearchParams['sortBy']
  limit: number
}) {
  const libraries = await getLibraries()
  const library = libraries.find((library) => getLibrarySlug(library) === slug)
  const settings = getSettings()

  if (!library || !library.is_active) {
    return notFound()
  }

  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'dashboard', getViewer(session))) {
    return notFound()
  }

  const loggedInUserId = session?.user.id
  const period = getPeriod(periodSp, settings)
  const progress = await getHistoryProgress(period.string, [library])

  if (progress) {
    return (
      <Dashboard
        type={library.section_type}
        settings={toPublicSettings(settings)}
        status={<HistoryReading progress={progress} isInCard />}
      />
    )
  }

  const personalUserId =
    getOwnOnlyUserId(settings, 'dashboard', session) ??
    (personalSp === 'true' ? loggedInUserId : undefined)
  // Plays rank by default; the sort filter can switch to watch time or users,
  // which says nothing when they're all one user's
  const sort = getDashboardSort(sortBySp)
  const sortBy =
    (personalUserId && sort === 'users' ? undefined : sort) ?? 'plays'
  const [
    { items, hasMore },
    totalDuration,
    totalRequests,
    totalSize,
    count,
    mediaServer,
  ] = await Promise.all([
    getItems(library, {
      since: period.string,
      userId: personalUserId,
      sortBy,
      count: limit,
    }),
    getTotalDuration(library, period.string, settings, personalUserId),
    getTotalRequests(period.string, settings, library, personalUserId),
    getTotalSize(library, settings, personalUserId),
    getTotalCount(library, period.string, settings, personalUserId),
    getMediaServer(),
  ])

  return (
    <Dashboard
      items={items}
      totalDuration={totalDuration}
      totalRequests={totalRequests}
      totalSize={totalSize}
      type={library.section_type}
      mediaServer={mediaServer}
      count={count}
      isPersonal={!!personalUserId}
      settings={toPublicSettings(settings)}
      nextLimit={getNextItemsLimit(limit, hasMore)}
    />
  )
}

type Props = {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<DashboardSearchParams>
}

export default async function DashboardPage({ searchParams, params }: Props) {
  const { period, personal, sortBy, limit } = await searchParams
  const { slug } = await params
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'dashboard', getViewer(session))) {
    return notFound()
  }

  // Already fetched by the layout, so this doesn't hold up the loader
  const library = (await getLibraries()).find(
    (library) => getLibrarySlug(library) === slug,
  )

  if (!library || !library.is_active) {
    return notFound()
  }

  const itemsLimit = getItemsLimit(limit)
  const publicSettings = toPublicSettings(settings)
  const { personalFilter, isOwnOnly } = getDashboardFilterAccess(
    settings,
    session,
  )
  // As the content works it out, so the loader shows the same totals
  const isPersonal = isOwnOnly || (personalFilter && personal === 'true')

  return (
    <>
      <DashboardToolbar
        settings={publicSettings}
        personalFilter={personalFilter}
        isOwnOnly={isOwnOnly}
      />
      <Suspense
        fallback={
          <DashboardLoader
            type={library.section_type}
            settings={publicSettings}
            rows={itemsLimit}
            isPersonal={isPersonal}
          />
        }
        // Without the limit, so "Show more" keeps the list up while it loads
        key={`period-${period}-personal-${personal}-sortBy-${sortBy}`}
      >
        <DashboardContent
          slug={slug}
          periodSp={period}
          personalSp={personal}
          sortBySp={sortBy}
          limit={itemsLimit}
        />
      </Suspense>
    </>
  )
}
