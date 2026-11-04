import { RewindStory } from '@/types/rewind'
import { HeartIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'
import TitleMomentCard from '../TitleMomentCard'

export default function StoryComfortWatch({
  userRewind,
  settings,
}: RewindStory) {
  const t = useTranslations('Rewind.ComfortWatch')
  const { comfortWatch } = userRewind.titleMoments

  if (!comfortWatch) {
    return null
  }

  const isEpisode = comfortWatch.episode !== null

  return (
    <>
      <RewindStat>
        <p>
          {t.rich(isEpisode ? 'episode' : 'movie', {
            titleValue: comfortWatch.episode ?? comfortWatch.item.title,
            title: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <HeartIcon />
              </span>
            ),
            showValue: comfortWatch.item.title,
            show: (chunks) => <span className='rewind-cat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale>
        <p className='mb-2'>
          {t.rich(isEpisode ? 'episodePlays' : 'moviePlays', {
            countValue: comfortWatch.watches,
            count: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>

        <TitleMomentCard
          card={comfortWatch}
          mediaServer={userRewind.media_server}
          settings={settings}
        />
      </RewindStat>
    </>
  )
}
