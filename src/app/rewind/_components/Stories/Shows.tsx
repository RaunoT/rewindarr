import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { getServerName } from '@/utils/mediaServerName'
import { useTranslations } from 'next-intl'
import CountUp from '../CountUp'
import { isFavorite } from '../favorite'
import PlaytimeShare from '../PlaytimeShare'
import PreviousFavorite from '../PreviousFavorite'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

export default function StoryShows({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Shows')
  const top = userRewind.shows.top[0]
  const isOnly = userRewind.shows.top.length === 1
  // Without a rewatch, it's only the one with the most watch time
  const isTopFavorite = isFavorite(top)

  return (
    <>
      {userRewind.shows.duration ? (
        <>
          <RewindStat>
            <p>
              {t.rich('duration', {
                library: (chunks) => (
                  <RewindCat icon={<MEDIA_ICONS.show />}>{chunks}</RewindCat>
                ),
                duration: (chunks) => (
                  <span className='rewind-stat'>{chunks}</span>
                ),
                durationValue: userRewind.shows.duration,
                serverName: getServerName(settings),
              })}
            </p>
          </RewindStat>

          <PlaytimeShare percentage={userRewind.shows.percentage} step={1} />

          {/* The watch time can be from plays that don't count */}
          {userRewind.shows.count > 0 && (
            <RewindStat step={2}>
              <p>
                {t.rich('count', {
                  countValue: userRewind.shows.count,
                  count: (chunks) => (
                    <span className='rewind-stat'>
                      <CountUp value={userRewind.shows.count}>{chunks}</CountUp>
                    </span>
                  ),
                  episodes: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                })}
              </p>
            </RewindStat>
          )}

          <RewindStat step={3} noScale>
            <p className='mb-2'>
              {t(isOnly ? 'only' : isTopFavorite ? 'favorite' : 'mostTime')}{' '}
              <span className='rewind-cat'>{top.title}</span>
            </p>

            <div className='text-base leading-normal font-normal tracking-normal'>
              <MediaItems
                type='show'
                items={[top]}
                mediaServer={userRewind.media_server}
                rows
                settings={settings}
              />
            </div>
          </RewindStat>

          {/* Last time's favourite would follow on from this one */}
          {isTopFavorite && (
            <PreviousFavorite
              yearOverYear={userRewind.yearOverYear}
              type='shows'
              step={4}
            />
          )}
        </>
      ) : (
        <RewindStat noScale>
          <p>
            {t.rich('noData', {
              shows: (chunks) => (
                <RewindCat icon={<MEDIA_ICONS.show />}>{chunks}</RewindCat>
              ),
              serverName: getServerName(settings),
              emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
