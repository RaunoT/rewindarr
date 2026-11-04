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

  // The titles left out have no poster, so they're only counted
  const titles = biggestDay.titles.map(({ title }) => title)

  if (biggestDay.moreTitles) {
    titles.push(t('moreTitles', { count: biggestDay.moreTitles }))
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
        <p className='mb-4'>
          {t.rich('dayTitles', {
            titlesValue: format.list(titles),
            titles: (chunks) => <span className='rewind-cat'>{chunks}</span>,
          })}
        </p>

        <ul className='flex gap-3'>
          {biggestDay.titles.map(({ title, mediaType, item }) => (
            <li key={`${mediaType}|${title}`} className='poster w-20 sm:w-24'>
              <PosterImage
                srcs={item ? [getPoster(item), item.tmdb_poster] : []}
                type={mediaType}
                alt={title}
                sizes='6rem'
              />
            </li>
          ))}
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
