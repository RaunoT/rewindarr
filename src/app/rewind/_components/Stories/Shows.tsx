import { MEDIA_ICONS } from '@/components/icons'
import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { getMediaServerName } from '@/utils/mediaServerName'
import { useTranslations } from 'next-intl'
import CountUp from '../CountUp'
import PlaytimeShare from '../PlaytimeShare'
import PreviousFavorite from '../PreviousFavorite'
import RewindStat from '../RewindStat'

export default function StoryShows({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Shows')

  return (
    <>
      {userRewind.shows.duration ? (
        <>
          <RewindStat>
            <p>
              {t.rich('duration', {
                library: (chunks) => (
                  <span className='rewind-cat'>
                    {chunks}
                    <MEDIA_ICONS.show />
                  </span>
                ),
                duration: (chunks) => (
                  <span className='rewind-stat'>{chunks}</span>
                ),
                durationValue: userRewind.shows.duration,
                serverName:
                  settings.general.serverName ||
                  getMediaServerName(settings.connection.mediaServerType),
                plex: (chunks) => chunks,
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
              {t(userRewind.shows.top.length > 1 ? 'favorite' : 'only')}{' '}
              <span className='rewind-cat'>
                {userRewind.shows.top[0].title}
              </span>
            </p>

            <div className='text-base leading-normal font-normal tracking-normal'>
              <MediaItems
                type='show'
                items={Array(userRewind.shows.top[0])}
                mediaServer={userRewind.media_server}
                rows
                settings={settings}
              />
            </div>
          </RewindStat>

          <PreviousFavorite
            yearOverYear={userRewind.yearOverYear}
            type='shows'
            step={4}
          />
        </>
      ) : (
        <RewindStat noScale>
          <p>
            {t.rich('noData', {
              shows: (chunks) => (
                <span className='rewind-cat'>
                  {chunks}
                  <MEDIA_ICONS.show />
                </span>
              ),
              serverName:
                settings.general.serverName ||
                getMediaServerName(settings.connection.mediaServerType),
              plex: (chunks) => chunks,
              emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
