import MediaServerDeeplink from '@/components/MediaItem/MediaServerDeeplink'
import SiteLogo from '@/components/MediaItem/SiteLogo'
import TitleDetails from '@/components/MediaItem/TitleDetails'
import UserBadge, { BadgeUser } from '@/components/UserBadge'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { EXTERNAL_LINK_NAMES, RATING_STATISTICS } from '@/utils/constants'
import { getExternalLinks, getRatedSites } from '@/utils/externalLinks'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { ReactNode } from 'react'
import HistoryPoster, { ITEM_LINK_CLASS_NAME } from './HistoryPoster'

// A stat like the dashboard's: a pill from sm up, plain text on phones
export const STAT_PILL =
  'icon-stat-wrapper max-sm:bg-transparent max-sm:p-0 max-sm:ring-0'

export type HistoryCardUser = BadgeUser

type Props = {
  // The dashboard's kind of item, for the links
  type: 'movie' | 'show' | 'artist'
  // A movie, an episode, a show or a track, for the poster's stand-in
  mediaType: string
  // The title's year, ratings and IDs, like a dashboard item's
  item: TautulliItemRow | null | undefined
  name: string
  // An episode's numbers, a track's title or a show's requested seasons
  detail: string | null
  // On hover, with whatever the card leaves out
  fullTitle: string
  // Where the poster and the title lead
  href: string | null
  posters: (string | null | undefined)[]
  user: HistoryCardUser
  // After the user's, such as the watch time and how it played
  stats: ReactNode
  // The item in the media server, as a button among the links
  deeplink?: { mediaServer: MediaServer; ratingKey: number | string } | null
  time: Date
  settings: PublicSettings
}

// A play or a request, built like the dashboard's items: the poster, the title
// with its year and ratings, the stats, and the links to the title elsewhere.
// Dates and times are in the Rewindarr server's timezone.
export default function HistoryCard({
  type,
  mediaType,
  item,
  name,
  detail,
  fullTitle,
  href,
  posters,
  user,
  stats,
  deeplink,
  time,
  settings,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
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
  // The full date over the time, in its own block
  const dateTime = (className: string) => (
    <time
      dateTime={time.toISOString()}
      className={clsx(
        'shrink-0 text-right text-xs leading-snug text-neutral-400 tabular-nums sm:text-sm',
        className,
      )}
    >
      <span className='block'>
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(time)}
      </span>
      <span className='block text-neutral-200'>
        {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(time)}
      </span>
    </time>
  )
  const title = (
    <>
      {name}
      {detail && (
        <span className='font-normal text-neutral-400'>{` · ${detail}`}</span>
      )}
    </>
  )

  return (
    <li className='group/item flex items-center gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 max-sm:flex-wrap sm:gap-4'>
      <HistoryPoster
        srcs={
          isVideo && settings.general.isPostersTmdbOnly
            ? [item?.tmdb_poster, ...posters]
            : [...posters, item?.tmdb_poster]
        }
        type={mediaType}
        alt={t('History.poster', { title: name })}
        href={href}
      />
      {/* Wide cards put the links level with the title, narrow ones under the
          stats. On phones these wrappers step aside, so the links wrap onto a
          row of their own, like the dashboard's. */}
      <div className='@container min-w-0 flex-1 max-sm:contents'>
        <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <h3
                  className='truncate leading-snug font-medium sm:text-lg'
                  title={fullTitle}
                >
                  {href ? (
                    <a
                      href={href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={ITEM_LINK_CLASS_NAME}
                      data-item-link
                    >
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </h3>
              </div>
              {dateTime('@md:hidden')}
            </div>
            {item && isVideo && (
              <TitleDetails
                data={item}
                activeStats={titleStats}
                links={ratingLinks}
                className='mt-1.5'
              />
            )}
            <ul className='icon-stats-container mt-2 max-sm:gap-x-2.5'>
              <li className={STAT_PILL}>
                <UserBadge user={user} />
              </li>
              {stats}
            </ul>
          </div>
          {/* Wide cards have a column for the links with the date under
              them. On phones it steps aside too, so the links get their row. */}
          <div className='flex shrink-0 flex-col gap-2 max-sm:contents @md:items-end'>
            {(deeplink || externalLinks.length > 0) && (
              <div className='relative z-10 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-2.5 max-sm:basis-full max-sm:*:flex-1 max-sm:*:justify-center @md:mt-0.5 @md:max-w-56 @md:justify-end'>
                {deeplink && (
                  <MediaServerDeeplink
                    title={name}
                    mediaServer={deeplink.mediaServer}
                    ratingKey={deeplink.ratingKey}
                  />
                )}
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
            )}
            {dateTime('hidden @md:block')}
          </div>
        </div>
      </div>
    </li>
  )
}
