import { STAT_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { useTranslations } from 'next-intl'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'
import { TITLE_STEPS } from '../storyMusic'

export default function StoryRequestsReach({
  userRewind,
  settings,
}: RewindStory) {
  const t = useTranslations('Rewind.RequestsReach')
  const reach = userRewind.social.requestsReach

  if (!reach) {
    return null
  }

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('users', {
            usersValue: reach.users,
            count: (chunks) => <span className='rewind-stat'>{chunks}</span>,
            requests: (chunks) => (
              <RewindCat icon={<STAT_ICONS.requests />}>{chunks}</RewindCat>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          {t.rich('duration', {
            usersValue: reach.users,
            requestsValue: reach.requests,
            durationValue: reach.duration,
            duration: (chunks) => <span className='rewind-stat'>{chunks}</span>,
          })}
        </p>
      </RewindStat>

      <RewindStat step={TITLE_STEPS.requestsReach} noScale>
        <p className='mb-2'>
          {t.rich('top', {
            requestsValue: reach.requests,
            titleValue: reach.item.data.title,
            title: (chunks) => <span className='rewind-cat'>{chunks}</span>,
          })}
        </p>

        <div className='text-base leading-normal font-normal tracking-normal'>
          <MediaItems
            type={reach.item.type}
            items={[reach.item.data]}
            mediaServer={userRewind.media_server}
            rows
            settings={settings}
            // Its people, plays and time are the other people's, like the
            // time the story has just told
            isRanked={false}
          />
        </div>
      </RewindStat>

      {!reach.isItemWatched && (
        <RewindStat step={3}>
          <p>
            {t.rich('unwatched', {
              still: (chunks) => <span className='rewind-stat'>{chunks}</span>,
              emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
