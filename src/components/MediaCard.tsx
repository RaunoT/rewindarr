import MediaServerLink from '@/components/MediaItem/MediaServerLink'
import SiteLogo from '@/components/MediaItem/SiteLogo'
import TitleDetails, {
  TitleDetailsData,
} from '@/components/MediaItem/TitleDetails'
import TitleNote from '@/components/MediaItem/TitleNote'
import SkeletonLine from '@/components/SkeletonLine'
import UserBadge, { BadgeUser } from '@/components/UserBadge'
import { PublicSettings } from '@/types/settings'
import { EXTERNAL_LINK_NAMES, RATING_STATISTICS } from '@/utils/constants'
import { Deeplink } from '@/utils/deeplink'
import {
  getExternalLinks,
  getRatedSites,
  LinkedItem,
} from '@/utils/externalLinks'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'
import MediaCardPoster from './MediaCardPoster'

// A stat like the dashboard's: a pill from sm up, plain text on phones
export const STAT_PILL =
  'icon-stat-wrapper max-sm:bg-transparent max-sm:p-0 max-sm:ring-0'

export type MediaCardItem = TitleDetailsData &
  LinkedItem & { tmdb_poster?: string | null }

type Props = {
  // The dashboard's kind of item, for the links
  type: 'movie' | 'show' | 'artist'
  // A movie, an episode, a show or a track, for the poster's stand-in
  mediaType: string
  // The title's year, ratings and IDs, like a dashboard item's
  item: MediaCardItem | null | undefined
  isItemLoading?: boolean
  name: string
  // Small above the name, such as an episode's numbers, a track's artist or a
  // show's requested seasons
  detail: string | null
  // On hover, with whatever the card leaves out
  fullTitle: string
  posters: (string | null | undefined)[]
  isPosterLoading?: boolean
  // Over the poster, such as a stream's pause
  posterOverlay?: ReactNode
  // For the items in view as the page loads
  isPriority?: boolean
  // How far a play got, from 0 to 100, under the poster on phones. Wider cards
  // have it in the stats, which the caller adds.
  progress?: number | null
  // Left out when it's the same on every card, as in one user's history
  user?: BadgeUser | null
  // After the user's, such as the watch time and how it played
  stats?: ReactNode
  // First among the links, such as a request's status in Seerr
  action?: ReactNode
  // The item in the media server, which the title and poster open
  deeplink?: Deeplink | null
  // On the right, such as a play's date or when a stream ends
  aside?: ReactNode
  // Phones start the line above the name with the aside, unless the card
  // shows it elsewhere there
  isAsideHiddenOnPhones?: boolean
  // The top right on phones, such as a button that opens more
  phoneAside?: ReactNode
  settings: PublicSettings
  // Under the title and stats, such as a stream's progress
  children?: ReactNode
  // The card's full width under everything else, such as a stream's details
  footer?: ReactNode
}

// A play, a request or a stream, built like the dashboard's items: the poster,
// the title with its year and ratings, the stats, and the links to the title
// elsewhere.
export default function MediaCard({
  type,
  mediaType,
  item,
  isItemLoading,
  name,
  detail,
  fullTitle,
  posters,
  isPosterLoading,
  posterOverlay,
  isPriority,
  progress,
  user,
  stats,
  action,
  deeplink,
  aside,
  isAsideHiddenOnPhones,
  phoneAside,
  settings,
  children,
  footer,
}: Props) {
  const t = useTranslations()
  const isVideo = type === 'movie' || type === 'show'
  const { activeItemStatistics } = settings.general
  // Only the title's own details, as the counts are the dashboard's
  const titleStats = activeItemStatistics.filter((stat) =>
    (RATING_STATISTICS as readonly string[]).includes(stat),
  )
  const year =
    isVideo && activeItemStatistics.includes('year') ? item?.year : null
  const links =
    item && isVideo
      ? getExternalLinks(item, type, settings.general.activeExternalLinks)
      : []
  // A site whose rating is shown opens from the rating, so it gets no button
  const ratedSites = item ? getRatedSites(item, titleStats) : []
  const externalLinks = links.filter(({ site }) => !ratedSites.includes(site))
  const ratingLinks = Object.fromEntries(links.map((link) => [link.site, link]))
  const hasLinks = !!action || externalLinks.length > 0
  const linksBlock = (className: string) => (
    <div
      className={clsx(
        'relative z-10 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-2.5',
        className,
      )}
    >
      {action}
      {externalLinks.map(({ site, href, isSearch }) => (
        <a
          key={site}
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='button-card'
          aria-label={t(
            isSearch
              ? 'MediaItem.externalSearchLabel'
              : 'MediaItem.externalLinkLabel',
            { title: name, site: EXTERNAL_LINK_NAMES[site] },
          )}
        >
          {/* Just the logo, the label carries the name */}
          <SiteLogo site={site} />
        </a>
      ))}
    </div>
  )
  const poster = (
    <MediaCardPoster
      srcs={
        isVideo && settings.general.isPostersTmdbOnly
          ? [item?.tmdb_poster, ...posters]
          : [...posters, item?.tmdb_poster]
      }
      type={mediaType}
      alt={t('History.poster', { title: name })}
      isLoading={isPosterLoading}
      priority={isPriority}
      progress={progress}
    >
      {posterOverlay}
    </MediaCardPoster>
  )
  const asideBlock = (className: string) =>
    aside && (
      <div
        className={clsx(
          'shrink-0 text-right text-xs leading-snug text-neutral-400 tabular-nums sm:text-sm',
          className,
        )}
      >
        {aside}
      </div>
    )

  return (
    // With more under it, the poster stays level with the title, and always on
    // phones, where the title and stats wrap to different heights
    <li
      className={clsx(
        'flex flex-wrap gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 sm:gap-4',
        children ? 'items-start' : 'items-start sm:items-center',
        deeplink && 'media-link-group',
      )}
    >
      {deeplink ? (
        <MediaServerLink
          title={name}
          mediaServer={deeplink.mediaServer}
          ratingKey={deeplink.ratingKey}
          isDuplicate
          className='shrink-0'
        >
          {poster}
        </MediaServerLink>
      ) : (
        poster
      )}
      {/* Wide cards put the links level with the title, narrow ones under the
          stats and phones at the end of the stats. On phones these wrappers step
          aside, so the children get the card's width under the poster. */}
      <div className='@container min-w-0 flex-1 max-sm:contents'>
        <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
          <div className='min-w-0 flex-1'>
            {/* The detail goes small above the name, as in the home tiles,
                so the name gets the full width under it. Phones start the line
                with the aside, like a timeline, and keep its end for
                phoneAside. Mid-width cards end it with the aside, and wide
                cards without a detail leave it out. */}
            <div
              className={clsx(
                'flex items-center justify-between gap-3',
                !detail && '@md:hidden',
              )}
            >
              <span className='min-w-0 truncate text-xs leading-snug text-neutral-400 tabular-nums sm:text-sm'>
                {aside && !isAsideHiddenOnPhones && (
                  <span className='sm:hidden'>
                    {aside}
                    {detail && ' · '}
                  </span>
                )}
                {/* The heading reads it after the name */}
                <span aria-hidden='true'>{detail}</span>
              </span>
              {asideBlock('max-sm:hidden @md:hidden')}
              {phoneAside && (
                <div className='shrink-0 sm:hidden'>{phoneAside}</div>
              )}
            </div>
            {/* A long name is cut short, so the year stays next to it */}
            <h3
              className='leading-snug font-medium sm:text-lg'
              title={fullTitle}
            >
              {/* The gap and the note's own margin make the space a line of
                  text would have */}
              <span className='flex min-w-0 items-baseline gap-1'>
                <span className='min-w-0 truncate'>
                  {deeplink ? (
                    <MediaServerLink
                      title={name}
                      mediaServer={deeplink.mediaServer}
                      ratingKey={deeplink.ratingKey}
                      className='media-link-title'
                    >
                      {name}
                    </MediaServerLink>
                  ) : (
                    name
                  )}
                </span>
                {year && <TitleNote label={t('Common.year')}>{year}</TitleNote>}
              </span>
              {detail && <span className='sr-only'>{` · ${detail}`}</span>}
            </h3>
            {/* The ratings, or their place while they load when any are
                chosen */}
            {isVideo &&
              (isItemLoading
                ? titleStats.length > 0 && (
                    <SkeletonLine
                      className='mt-1.5 text-xs sm:text-sm'
                      width='w-24'
                    />
                  )
                : item && (
                    <TitleDetails
                      data={item}
                      activeStats={titleStats}
                      links={ratingLinks}
                      className='mt-1.5'
                    />
                  ))}
            <ul className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
              {user && (
                <li className={STAT_PILL}>
                  <UserBadge user={user} />
                </li>
              )}
              {stats}
            </ul>
          </div>
          {/* Wide cards have a column for the date with the links under it,
              level with the detail line over the title. Phones put the links
              in a row of their own at the bottom, split evenly, as on the
              dashboard. */}
          <div
            className={clsx(
              'flex shrink-0 flex-col gap-2 @md:items-end',
              hasLinks
                ? 'max-sm:order-last max-sm:basis-full'
                : 'max-sm:hidden',
            )}
          >
            {asideBlock('hidden @md:block')}
            {hasLinks &&
              linksBlock(
                'max-sm:*:flex-1 max-sm:*:justify-center @md:max-w-56 @md:justify-end',
              )}
          </div>
        </div>
        {children && (
          <div className='max-sm:basis-full sm:mt-3'>{children}</div>
        )}
      </div>
      {/* Without a minimum width, a truncated line would stretch it to its
          full length */}
      {footer && <div className='order-last min-w-0 basis-full'>{footer}</div>}
    </li>
  )
}
