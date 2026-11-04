import MediaServerLink from '@/components/MediaItem/MediaServerLink'
import SiteLogo from '@/components/MediaItem/SiteLogo'
import TitleDetails, {
  TitleDetailsData,
} from '@/components/MediaItem/TitleDetails'
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
  // An episode's numbers, a track's title or a show's requested seasons
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
  // Two lines on the right, such as a play's date over its time
  aside: ReactNode
  // On phones, in place of the aside next to the title, for a card that shows
  // the aside in its children there
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
  phoneAside,
  settings,
  children,
  footer,
}: Props) {
  const t = useTranslations()
  const isVideo = type === 'movie' || type === 'show'
  // Only the title's own details, as the counts are the dashboard's
  const titleStats = settings.general.activeItemStatistics.filter(
    (stat) =>
      stat === 'year' ||
      (RATING_STATISTICS as readonly string[]).includes(stat),
  )
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
  const asideBlock = (className: string) => (
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
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                {/* On phones the name can take two lines, and the detail goes
                    small above it, as in the home tiles, so it never splits */}
                <h3
                  className='truncate leading-snug font-medium max-sm:flex max-sm:flex-col max-sm:whitespace-normal sm:text-lg'
                  title={fullTitle}
                >
                  {deeplink ? (
                    <MediaServerLink
                      title={name}
                      mediaServer={deeplink.mediaServer}
                      ratingKey={deeplink.ratingKey}
                      className='media-link-title max-sm:line-clamp-2'
                    >
                      {name}
                    </MediaServerLink>
                  ) : (
                    <span className='max-sm:line-clamp-2'>{name}</span>
                  )}
                  {detail && (
                    <span className='font-normal text-neutral-400 max-sm:order-first max-sm:truncate max-sm:text-xs'>
                      <span className='max-sm:hidden'>{' · '}</span>
                      {detail}
                    </span>
                  )}
                </h3>
              </div>
              {asideBlock('max-sm:hidden @md:hidden')}
              <div className='shrink-0 sm:hidden'>
                {phoneAside ?? asideBlock('')}
              </div>
            </div>
            {isVideo &&
              (isItemLoading ? (
                <SkeletonLine
                  className='mt-1.5 text-xs sm:text-sm'
                  width='w-24'
                />
              ) : (
                item && (
                  <TitleDetails
                    data={item}
                    activeStats={titleStats}
                    links={ratingLinks}
                    className='mt-1.5'
                  />
                )
              ))}
            <ul className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
              {user && (
                <li className={STAT_PILL}>
                  <UserBadge user={user} />
                </li>
              )}
              {stats}
              {/* Phones end the stats with the links, so nothing floats next
                  to the title */}
              {hasLinks && <li className='sm:hidden'>{linksBlock('')}</li>}
            </ul>
          </div>
          {/* Wide cards have a column for the links with the date under
              them. Phones have them among the stats. */}
          <div className='flex shrink-0 flex-col gap-2 max-sm:hidden @md:items-end'>
            {hasLinks && linksBlock('@md:mt-0.5 @md:max-w-56 @md:justify-end')}
            {asideBlock('hidden @md:block')}
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
