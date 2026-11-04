import { RewindStory } from '@/types/rewind'
import { ClockIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import TitleMomentCard from '../TitleMomentCard'

export default function StoryTimeTravel({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.TimeTravel')
  const { timeTravel } = userRewind.titleMoments

  if (!timeTravel) {
    return null
  }

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('decade', {
            shareValue: timeTravel.share,
            share: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            decadeValue: timeTravel.decade,
            decade: (chunks) => (
              <RewindCat icon={<ClockIcon />}>{chunks}</RewindCat>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale>
        <p className='mb-2'>
          {t.rich('oldest', {
            yearValue: timeTravel.oldest.year,
            year: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            titleValue: timeTravel.oldest.item.title,
            title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
          })}
        </p>

        {/* A show's own year is when it started, not the episode's above */}
        <TitleMomentCard
          card={timeTravel.oldest}
          mediaServer={userRewind.media_server}
          settings={settings}
          isYearShown={false}
        />
      </RewindStat>
    </>
  )
}
