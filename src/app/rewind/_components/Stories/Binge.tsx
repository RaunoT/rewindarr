import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { secondsToTime } from '@/utils/formatting'
import { ForwardIcon } from '@heroicons/react/24/outline'
import { useFormatter, useTranslations } from 'next-intl'
import { DAY_FORMAT, formatMomentDate } from '../momentDate'
import RewindCat from '../RewindCat'
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
            binge: (chunks) => (
              <RewindCat icon={<ForwardIcon />}>{chunks}</RewindCat>
            ),
            dateValue: formatMomentDate(format, binge.date, DAY_FORMAT),
            date: (chunks) => <span className='rewind-cat'>{chunks}</span>,
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
              <RewindCat icon={<MEDIA_ICONS.show />}>{chunks}</RewindCat>
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
              activeStats={settings.general.activeItemStatistics}
            />
          </div>
        )}
      </RewindStat>
    </>
  )
}
