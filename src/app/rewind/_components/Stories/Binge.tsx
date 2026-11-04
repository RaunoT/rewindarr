import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { RATING_STATISTICS } from '@/utils/constants'
import { secondsToTime } from '@/utils/formatting'
import { CalendarIcon } from '@heroicons/react/24/outline'
import { useFormatter, useTranslations } from 'next-intl'
import { DAY_FORMAT, formatMomentDate } from '../momentDate'
import RewindStat from '../RewindStat'

export default function StoryBinge({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Moments')
  const tRoot = useTranslations()
  const format = useFormatter()
  const { binge } = userRewind.moments

  if (!binge) {
    return null
  }

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('binge', {
            dateValue: formatMomentDate(format, binge.date, DAY_FORMAT),
            date: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <CalendarIcon />
              </span>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          {t.rich('bingeEpisodes', {
            countValue: binge.episodes,
            durationValue: secondsToTime(binge.duration, tRoot),
            count: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={2} noScale>
        <p className={binge.item ? 'mb-2' : undefined}>
          {t.rich('bingeShow', {
            showValue: binge.title,
            show: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <MEDIA_ICONS.show />
              </span>
            ),
          })}
        </p>

        {binge.item && (
          <div className='text-base leading-normal font-normal tracking-normal'>
            <MediaItems
              type='show'
              items={[binge.item]}
              mediaServer={userRewind.media_server}
              rows
              settings={settings}
              isRanked={false}
              // The card is looked up from a single play, so its watch time
              // and plays would only count that one
              activeStats={settings.general.activeItemStatistics.filter(
                (stat) =>
                  stat === 'year' ||
                  (RATING_STATISTICS as readonly string[]).includes(stat),
              )}
            />
          </div>
        )}
      </RewindStat>
    </>
  )
}
