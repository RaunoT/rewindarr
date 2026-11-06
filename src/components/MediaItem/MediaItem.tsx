'use client'

import Avatar from '@/components/Avatar'
import { MEDIA_ICONS, MediaIcon, STAT_ICONS } from '@/components/icons'
import ImageFallback from '@/components/ImageFallback'
import PosterImage from '@/components/PosterImage'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { DASHBOARD_PAGE_SIZE, EXTERNAL_LINK_NAMES } from '@/utils/constants'
import { getRequestUrl, getRowDeeplink, getSeerrUrl } from '@/utils/deeplink'
import { getExternalLinks } from '@/utils/externalLinks'
import { secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { countdownRow, slideDown } from '@/utils/motion'
import { TrashIcon, UserIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import MediaItemTitle from './MediaItemTitle'
import MediaLink, { MediaLinkIcon } from './MediaLink'
import MediaServerLogo from './MediaServerLogo'
import Rank from './Rank'
import RequestButton from './RequestButton'
import SiteLogo from './SiteLogo'
import TitleDetails from './TitleDetails'
import TitleNote from './TitleNote'

// A viewing stat: a pill from sm up, plain text on phones
const STAT_PILL =
  'icon-stat-wrapper max-sm:bg-transparent max-sm:p-0 max-sm:ring-0'

type Props = {
  data: TautulliItemRow
  i: number
  type: 'movie' | 'show' | 'artist' | 'users'
  mediaServer: MediaServer | null
  activeStats: string[]
  settings: PublicSettings
  loggedInUserId?: string
  // Without a place in a ranking, there's no number before the poster
  isRanked?: boolean
  // In a countdown, a place reached comes in at the top and pushes the others
  // down. A place not reached yet is an unseen placeholder below them, which
  // keeps its room so the story doesn't move as the list grows.
  countdown?: 'reached' | 'placeholder'
}

export default function MediaItem({
  data,
  i,
  type,
  mediaServer,
  activeStats,
  settings,
  loggedInUserId,
  isRanked = true,
  countdown,
}: Props) {
  const translations = useTranslations()
  const t = useTranslations('MediaItem')
  const isUsers = type === 'users'
  const posterSrc = !data.thumb
    ? null
    : data.thumb.startsWith('https://image.tmdb.org')
      ? data.thumb
      : getImageProxyUrl(data.thumb)
  const isAnonymized = !!data.is_anonymous
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const dataKey = `${data.rating_key || data.user_id || i}-${type}`
  const rank = data.rank || i
  const isVideo = type === 'movie' || type === 'show'
  const firstPlayedAt = isUsers ? data.first_played_at : null
  const year = isVideo && activeStats.includes('year') ? data.year : null
  // Next to the title, apart from the ratings and stats
  const note = year ? (
    <TitleNote label={translations('Common.year')}>{year}</TitleNote>
  ) : firstPlayedAt ? (
    <TitleNote>
      {/* The year is enough next to the name. As text, so it isn't
          formatted like a count, with a thousands separator. */}
      {t('statSince', {
        date: String(new Date(firstPlayedAt).getUTCFullYear()),
      })}
    </TitleNote>
  ) : null
  const { activeExternalLinks } = settings.general
  const links = isVideo ? getExternalLinks(data, type, activeExternalLinks) : []
  const ratingLinks = Object.fromEntries(links.map((link) => [link.site, link]))
  const seerrUrl = getSeerrUrl(settings)
  // The poster opens it in the media server, or once it's gone, its request
  const posterLink = isUsers
    ? null
    : getRowDeeplink(data, type, mediaServer, seerrUrl)
  // The same as buttons, when they're chosen
  const serverLink =
    posterLink &&
    'mediaServer' in posterLink &&
    activeExternalLinks.includes('mediaServer')
      ? posterLink
      : null
  const requestUrl = activeExternalLinks.includes('seerr')
    ? getRequestUrl(data, type, seerrUrl)
    : null
  const poster = (
    <div className='poster max-sm:w-12'>
      {!isUsers ? (
        <PosterImage
          srcs={[posterSrc, data.tmdb_poster]}
          type={type}
          sizes='10rem'
          priority
        />
      ) : isAnonymized ? (
        <ImageFallback>
          <UserIcon className='size-[40cqw]' />
        </ImageFallback>
      ) : (
        <Avatar
          src={data.user_thumb}
          name={data.friendly_name}
          sizes='10rem'
          priority
        />
      )}
      {posterLink && <MediaLinkIcon link={posterLink} />}
    </div>
  )

  return (
    <motion.li
      key={dataKey}
      // Motion animates with inline styles, which important utilities override
      // for visitors who prefer reduced motion, including during hydration.
      className={clsx(
        'flex items-center gap-3 py-2.5 not-first:border-t not-first:border-white/10 first:pt-0 last:pb-0 motion-reduce:transform-none! motion-reduce:opacity-100! max-sm:flex-wrap sm:gap-4',
        countdown === 'placeholder' && 'invisible',
      )}
      variants={countdown === 'reached' ? countdownRow : slideDown}
      initial={countdown === 'placeholder' ? false : 'hidden'}
      animate='show'
      exit={countdown === 'reached' ? 'exit' : undefined}
      layout={countdown === 'reached' ? 'position' : undefined}
      // Rows added by "Show more" stagger from the first of them, and a
      // countdown's rows show on their own
      transition={{
        delay: countdown ? 0 : (i % DASHBOARD_PAGE_SIZE) * 0.075,
      }}
    >
      {/* The rank stays level with the poster, however tall the details get.
          On phones it's a badge on the poster's corner, and the poster is
          smaller, so a line of ratings or stats fits the width. The poster
          moves in by the badge's overhang, which the list would clip, and the
          badge's outline is a border, which stays inside it. */}
      <div
        className={clsx(
          'relative flex shrink-0 items-center gap-3 sm:gap-4',
          isRanked && 'max-sm:pt-1 max-sm:pl-1',
        )}
      >
        {isRanked && <Rank rank={rank} />}
        {posterLink ? (
          <MediaLink title={data.title} link={posterLink} className='shrink-0'>
            {poster}
          </MediaLink>
        ) : (
          poster
        )}
      </div>
      {/* Wide rows put the links level with the title, narrow ones under the
          stats. On phones these wrappers step aside, so the links wrap onto a
          row of their own, as wide as the poster and details together. */}
      <div className='@container min-w-0 flex-1 max-sm:contents'>
        <div className='flex flex-col gap-2 max-sm:contents @md:flex-row @md:items-start @md:gap-4'>
          <div
            className='min-w-0 flex-1 overflow-hidden'
            ref={titleContainerRef}
          >
            <MediaItemTitle
              data={data}
              type={type}
              parentRef={titleContainerRef}
              loggedInUserId={loggedInUserId}
              note={note}
            />
            {/* Details about the title, kept apart from the viewing stats */}
            <TitleDetails
              data={data}
              activeStats={isVideo ? activeStats : []}
              links={ratingLinks}
              className='mb-2'
            />
            {/* Pills from sm up. Phones show them as plain text like the
                details above, which reads lighter in the narrow column. */}
            <ul className='icon-stats-container max-sm:gap-x-2.5'>
              {/* Duration */}
              {activeStats.includes('duration') && (
                <li className={STAT_PILL}>
                  <STAT_ICONS.duration />
                  {secondsToTime(data.total_duration, translations)}
                </li>
              )}
              {/* Plays */}
              {activeStats.includes('plays') &&
                (isUsers ? (
                  <>
                    {data.shows_plays_count > 0 && (
                      <li className={STAT_PILL}>
                        <MEDIA_ICONS.show />
                        <span className='sr-only'>{t('labelShows')}</span>{' '}
                        {t('statPlays', { count: data.shows_plays_count })}
                      </li>
                    )}
                    {data.movies_plays_count > 0 && (
                      <li className={STAT_PILL}>
                        <MEDIA_ICONS.movie />
                        <span className='sr-only'>{t('labelMovies')}</span>{' '}
                        {t('statPlays', { count: data.movies_plays_count })}
                      </li>
                    )}
                    {data.audio_plays_count > 0 && (
                      <li className={STAT_PILL}>
                        <MEDIA_ICONS.artist />
                        <span className='sr-only'>{t('labelAudio')}</span>{' '}
                        {t('statPlays', { count: data.audio_plays_count })}
                      </li>
                    )}
                  </>
                ) : (
                  data.total_plays > 0 && (
                    <li className={STAT_PILL}>
                      <MediaIcon type={type} />
                      <span>{t('statPlays', { count: data.total_plays })}</span>
                    </li>
                  )
                ))}
              {/* Users watched */}
              {activeStats.includes('users') && !!data.users_watched && (
                <li className={STAT_PILL}>
                  <STAT_ICONS.users />
                  {t('statUsers', { count: data.users_watched })}
                </li>
              )}
              {/* Requests */}
              {activeStats.includes('requests') &&
                isUsers &&
                data.requests > 0 && (
                  <li className={STAT_PILL}>
                    <STAT_ICONS.requests />
                    {t('statRequests', { count: data.requests })}
                  </li>
                )}
            </ul>
          </div>
          {/* The media server's link, a deleted title's request or label and
              the sites' links share a row, split evenly on phones.
              Wrapped rows are far enough apart that a tag's tap area never
              covers the tag above it. */}
          {(type === 'movie' || type === 'show' || type === 'artist') && (
            <div className='relative z-10 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-2.5 empty:hidden max-sm:basis-full max-sm:*:flex-1 max-sm:*:justify-center @md:mt-0.5 @md:max-w-56 @md:justify-end'>
              {serverLink && (
                <MediaLink
                  title={data.title}
                  link={serverLink}
                  className='button-card'
                >
                  {/* Just the logo, the label carries the name */}
                  <MediaServerLogo type={serverLink.mediaServer.type} />
                </MediaLink>
              )}
              {data.is_deleted ? (
                requestUrl ? (
                  <RequestButton title={data.title} href={requestUrl} />
                ) : (
                  <div className='button-card text-neutral-300'>
                    <TrashIcon className='text-danger' />
                    {t('deleted')}
                  </div>
                )
              ) : null}
              {links.map(({ site, href, isSearch }) => (
                <a
                  key={site}
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='button-card'
                  aria-label={t(
                    isSearch ? 'externalSearchLabel' : 'externalLinkLabel',
                    { title: data.title, site: EXTERNAL_LINK_NAMES[site] },
                  )}
                >
                  {/* Just the logo, the label carries the name */}
                  <SiteLogo site={site} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  )
}
