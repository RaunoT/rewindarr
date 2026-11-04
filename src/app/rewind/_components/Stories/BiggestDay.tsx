import PosterImage from '@/components/PosterImage'
import { RewindStory } from '@/types/rewind'
import { TautulliItemRow } from '@/types/tautulli'
import { secondsToTime } from '@/utils/formatting'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { CalendarIcon, FireIcon } from '@heroicons/react/24/outline'
import { useFormatter, useTranslations } from 'next-intl'
import { DAY_FORMAT, formatMomentDate, SHORT_DAY_FORMAT } from '../momentDate'
import RewindStat from '../RewindStat'

function getPoster(item: TautulliItemRow) {
  if (!item.thumb) {
    return undefined
  }

  return item.thumb.startsWith('https://image.tmdb.org')
    ? item.thumb
    : getImageProxyUrl(item.thumb)
}

export default function StoryBiggestDay({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Moments')
  const tRoot = useTranslations()
  const format = useFormatter()
  const { biggestDay, streak } = userRewind.moments

  if (!biggestDay) {
    return null
  }

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('day', {
            dateValue: formatMomentDate(format, biggestDay.date, DAY_FORMAT),
            durationValue: secondsToTime(biggestDay.duration, tRoot),
            date: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <CalendarIcon />
              </span>
            ),
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p className='mb-4'>{t('dayTitles')}</p>

        {/* The posters name the titles, and wrap to fit the width */}
        <ul className='grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3'>
          {biggestDay.titles.map(({ title, mediaType, item }) => (
            <li
              key={`${mediaType}|${title}`}
              className='poster w-full sm:w-full'
            >
              <PosterImage
                srcs={item ? [getPoster(item), item.tmdb_poster] : []}
                type={mediaType}
                alt={title}
                sizes='(min-width: 640px) 7rem, 25vw'
              />
            </li>
          ))}
          {biggestDay.moreTitles > 0 && (
            <li className='poster flex w-full items-center justify-center bg-white/5 px-1 text-center text-sm font-medium text-neutral-300 sm:w-full sm:text-base'>
              {t('moreTitles', { count: biggestDay.moreTitles })}
            </li>
          )}
        </ul>
      </RewindStat>

      {streak && (
        <RewindStat step={2}>
          <p>
            {t.rich('streak', {
              count: streak.days,
              startValue: formatMomentDate(
                format,
                streak.start,
                SHORT_DAY_FORMAT,
              ),
              endValue: formatMomentDate(format, streak.end, SHORT_DAY_FORMAT),
              days: (chunks) => (
                <span className='rewind-cat'>
                  {chunks}
                  <FireIcon />
                </span>
              ),
              start: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              end: (chunks) => <span className='rewind-cat'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
