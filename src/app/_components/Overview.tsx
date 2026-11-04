import AutoRefresh from '@/components/AutoRefresh'
import { MediaIcon } from '@/components/icons'
import PosterImage from '@/components/PosterImage'
import SkeletonLine from '@/components/SkeletonLine'
import SourceUnreachable from '@/components/SourceUnreachable'
import StatusMessage from '@/components/StatusMessage'
import { DashboardSearchParams } from '@/types/dashboard'
import { Settings } from '@/types/settings'
import { TautulliItemRow, TautulliLibrary } from '@/types/tautulli'
import {
  DASHBOARD_PERIOD_COOKIE_NAME,
  getSiteUrl,
  SETTINGS_HREF,
} from '@/utils/constants'
import { getItems } from '@/utils/getDashboard'
import getPeriod, { parseCustomPeriod } from '@/utils/getPeriod'
import { getHomeTiles, getViewer } from '@/utils/helpers'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { toPublicSettings } from '@/utils/publicSettings'
import { getNewEditionYear } from '@/utils/rewindPeriod'
import { getHistoryProgress } from '@/utils/statsSource'
import {
  BackwardIcon,
  ChevronRightIcon,
  InboxIcon,
} from '@heroicons/react/24/outline'
import { kebabCase } from 'lodash'
import { Session } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'
import ActivityTile from './ActivityTile'
import HeaderControls from './HeaderControls'
import HistoryTile, { HistoryTileSkeleton } from './HistoryTile'
import LoginButton from './LoginButton'
import TileGlow from './TileGlow'
import { TILE_ITEM_COUNT } from './TileItem'

type Props = {
  settings: Settings
  session: Session | null
  // Null when the source can't be reached
  libraries: TautulliLibrary[] | null
}

export default async function Overview({
  settings,
  session,
  libraries,
}: Props) {
  const t = await getTranslations()
  const isAdmin = !!session?.user.isAdmin
  const tiles = getHomeTiles(
    settings,
    getViewer(session),
    libraries?.length ?? 0,
  )
  const period = getDashboardPeriod(
    (await cookies()).get(DASHBOARD_PERIOD_COOKIE_NAME)?.value,
  )
  const customPeriod = parseCustomPeriod(settings.dashboard.customPeriod)
  const periodLabel =
    period === '7days'
      ? t('PeriodSelectContent.7days')
      : period === 'pastYear'
        ? t('PeriodSelectContent.pastYear')
        : period === 'allTime'
          ? t('PeriodSelectContent.allTime')
          : t('PeriodSelectContent.days', { count: customPeriod })

  return (
    <div className='page-width-wide'>
      <OverviewHeader settings={settings} session={session} />

      {libraries === null ? (
        <SourceUnreachable
          source={settings.connection.statisticsSource}
          isAdmin={isAdmin}
        />
      ) : !tiles.rewind &&
        !tiles.activity &&
        !tiles.history &&
        !tiles.libraries ? (
        <StatusMessage
          icon={InboxIcon}
          title={t('Home.emptyTitle')}
          description={
            isAdmin
              ? t('Home.emptyAdminDescription')
              : t('Home.emptyDescription')
          }
          action={
            isAdmin && (
              <Link href={SETTINGS_HREF} className='button w-full'>
                {t('Home.openSettings')}
              </Link>
            )
          }
        />
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {tiles.rewind && <RewindTile settings={settings} />}
          {tiles.activity && (
            <ActivityTile settings={toPublicSettings(settings)} />
          )}
          {tiles.history && (
            <Suspense fallback={<HistoryTileSkeleton />}>
              <HistoryTile
                settings={settings}
                session={session}
                libraries={libraries}
                period={period}
              />
            </Suspense>
          )}
          {tiles.libraries &&
            libraries.map((library) => (
              <Suspense
                key={library.section_id}
                fallback={<LibraryTileSkeleton library={library} />}
              >
                <LibraryTile
                  library={library}
                  settings={settings}
                  period={period}
                  periodLabel={periodLabel}
                />
              </Suspense>
            ))}
        </div>
      )}
    </div>
  )
}

type OverviewSkeletonProps = {
  settings: Settings
  session: Session | null
}

// The page while the libraries load, built like it with the tiles' own
// skeletons, so they don't change once it arrives. The libraries' names
// aren't known yet, so their tiles go by the settings.
export function OverviewSkeleton({ settings, session }: OverviewSkeletonProps) {
  const tiles = getHomeTiles(
    settings,
    getViewer(session),
    settings.general.activeLibraries.length,
  )

  return (
    <div className='page-width-wide'>
      <OverviewHeader settings={settings} session={session} />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {tiles.rewind && <RewindTile settings={settings} />}
        {tiles.activity && (
          <ActivityTile settings={toPublicSettings(settings)} />
        )}
        {tiles.history && <HistoryTileSkeleton />}
        {tiles.libraries &&
          settings.general.activeLibraries.map((library) => (
            <LibraryTileSkeleton key={library} />
          ))}
      </div>
    </div>
  )
}

async function OverviewHeader({ settings, session }: OverviewSkeletonProps) {
  const t = await getTranslations('Home')
  const firstName = session?.user.name?.split(' ')[0]

  return (
    <header
      data-page-header
      className='mb-4 flex min-h-10 items-center justify-between gap-3'
    >
      <h1 className='truncate text-2xl font-bold tracking-tight sm:text-3xl'>
        {firstName
          ? t('greeting', { name: firstName })
          : settings.general.serverName || t('title')}
      </h1>
      <div className='flex items-center gap-3'>
        {!session && (
          <Suspense>
            <LoginButton
              siteUrl={getSiteUrl()}
              mediaServerType={settings.connection.mediaServerType}
            />
          </Suspense>
        )}
        <HeaderControls className='lg:group-data-[sidebar]/app:hidden' />
      </div>
    </header>
  )
}

async function RewindTile({ settings }: { settings: Settings }) {
  const t = await getTranslations()
  const newYear = getNewEditionYear(settings)

  return (
    <div className='glass-sheet flex flex-col justify-between gap-4'>
      {/* Plex gold glowing up from a corner */}
      <div
        aria-hidden='true'
        className='from-plex/25 pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-radial-[at_100%_100%] to-transparent to-70%'
      />
      <div>
        <h2 className='flex items-center gap-2 font-semibold'>
          <BackwardIcon className='size-5 text-neutral-400' />
          {t('Rewind.title')}
        </h2>
        <p className='mt-4 max-w-md text-xl font-semibold tracking-tight sm:text-2xl'>
          {newYear === null
            ? t('Home.rewindDescription')
            : t('Home.rewindEdition', { year: newYear })}
        </p>
      </div>
      <Link href='/rewind' className='button'>
        {t('Home.rewind')}
      </Link>
    </div>
  )
}

type LibraryTileProps = {
  library: TautulliLibrary
  settings: Settings
  period: DashboardSearchParams['period']
  periodLabel: string
}

function getDashboardPeriod(value?: string): DashboardSearchParams['period'] {
  return value === '7days' || value === 'pastYear' || value === 'allTime'
    ? value
    : undefined
}

// The library's most watched titles over the period chosen on the dashboard.
// The top one leads with its poster, the next ones follow quietly.
async function LibraryTile({
  library,
  settings,
  period,
  periodLabel,
}: LibraryTileProps) {
  const t = await getTranslations()
  const { daysAgo, string: since } = getPeriod(period, settings)
  const progress = await getHistoryProgress(since, [library])
  const items = progress
    ? []
    : (
        await getItems(library, {
          period: daysAgo,
          sortBy: 'plays',
          count: TILE_ITEM_COUNT,
        })
      ).items
  const [top, ...rest] = items.slice(0, TILE_ITEM_COUNT)
  const topPosters = top ? [getPoster(top), top.tmdb_poster] : []
  const topLabel =
    library.section_type === 'artist'
      ? t('Home.mostListened')
      : t('Home.mostWatched')

  return (
    <Link
      href={`/dashboard/${kebabCase(library.section_name)}${period ? `?period=${period}` : ''}`}
      className='glass-sheet group focus-visible:focus-ring flex flex-col gap-4 transition-colors hover:bg-white/5'
    >
      <TileHeading name={library.section_name} type={library.section_type} />
      {top ? (
        <div className='flex flex-col gap-3'>
          <TileGlow srcs={topPosters} />
          <div className='flex items-center gap-3'>
            <div className='poster w-12'>
              <PosterImage
                srcs={topPosters}
                type={library.section_type}
                sizes='6rem'
              />
            </div>
            <div className='min-w-0'>
              <p className='truncate text-xs text-neutral-400'>
                {`${topLabel} · ${periodLabel}`}
              </p>
              <p className='truncate font-medium'>{top.title}</p>
              <ul className='icon-stats-container mt-1.5'>
                <li className='icon-stat-wrapper text-xs'>
                  <MediaIcon type={library.section_type} />
                  {t('MediaItem.statPlays', { count: top.total_plays })}
                </li>
              </ul>
            </div>
          </div>
          {rest.length > 0 && (
            <ol className='space-y-1 text-sm'>
              {rest.map((item, i) => (
                <li key={i} className='flex min-w-0 items-baseline gap-3'>
                  <span className='flex-1 truncate text-neutral-300'>
                    {item.title}
                  </span>
                  <span className='shrink-0 text-xs text-neutral-500 tabular-nums'>
                    {t('MediaItem.statPlays', { count: item.total_plays })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : progress ? (
        <p className='text-sm text-neutral-400'>
          {t('History.syncingShort')}
          <AutoRefresh />
        </p>
      ) : (
        // Big and at the bottom, like the activity tile's
        <p className='mt-auto text-2xl font-semibold tracking-tight text-neutral-400'>
          {t('Dashboard.noActivity')}
        </p>
      )}
    </Link>
  )
}

// Built like a loaded tile, so nothing moves once the data arrives. Without
// the library, its name is a skeleton too.
function LibraryTileSkeleton({ library }: { library?: TautulliLibrary }) {
  return (
    <div className='glass-sheet flex flex-col gap-4'>
      <TileHeading name={library?.section_name} type={library?.section_type} />
      <div className='flex flex-col gap-3'>
        <div className='flex items-center gap-3'>
          <div className='skeleton poster w-12' />
          <div className='min-w-0 flex-1'>
            <SkeletonLine className='text-xs' width='w-28' />
            <SkeletonLine width='w-2/3' />
            <div className='skeleton mt-1.5 h-5 w-20' />
          </div>
        </div>
        <div className='space-y-1 text-sm'>
          {[...Array(TILE_ITEM_COUNT - 1)].map((_, i) => (
            <div key={i} className='flex items-center gap-3'>
              <SkeletonLine className='flex-1' width={i ? 'w-1/3' : 'w-1/2'} />
              <SkeletonLine className='text-xs' width='w-12' />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getPoster(item: TautulliItemRow) {
  if (!item.thumb) {
    return undefined
  }

  return item.thumb.startsWith('https://image.tmdb.org')
    ? item.thumb
    : getImageProxyUrl(item.thumb)
}

function TileHeading({ name, type }: { name?: string; type?: string }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <h2 className='flex min-w-0 items-center gap-2 font-semibold'>
        {name ? (
          <>
            {type && (
              <MediaIcon
                type={type}
                className='size-5 shrink-0 text-neutral-400'
              />
            )}
            <span className='truncate'>{name}</span>
          </>
        ) : (
          <>
            <span className='skeleton size-5 shrink-0' />
            <SkeletonLine width='w-24' />
          </>
        )}
      </h2>
      <ChevronRightIcon className='size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5' />
    </div>
  )
}
