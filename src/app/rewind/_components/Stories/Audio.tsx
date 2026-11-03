import MediaItems from '@/components/MediaItem/MediaItems'
import { RewindStory } from '@/types/rewind'
import { getMediaServerName } from '@/utils/mediaServerName'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import PlaytimeShare from '../PlaytimeShare'
import RewindStat from '../RewindStat'

export default function StoryAudio({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Audio')
  const { topTrack } = userRewind.audio

  return (
    <>
      {userRewind.audio.duration ? (
        <>
          <RewindStat>
            <p>
              {t.rich('duration', {
                durationValue: userRewind.audio.duration,
                duration: (chunks) => (
                  <span className='rewind-stat'>{chunks}</span>
                ),
                audio: (chunks) => (
                  <span className='rewind-cat'>
                    {chunks}
                    <MusicalNoteIcon />
                  </span>
                ),
              })}
            </p>
          </RewindStat>

          <PlaytimeShare percentage={userRewind.audio.percentage} step={1} />

          {/* The watch time can be from plays that don't count */}
          {userRewind.audio.count > 0 && (
            <RewindStat step={2}>
              <p>
                {t.rich('count', {
                  countValue: userRewind.audio.count,
                  count: (chunks) => (
                    <span className='rewind-stat'>{chunks}</span>
                  ),
                  tracks: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                })}
              </p>
            </RewindStat>
          )}

          {topTrack ? (
            <>
              <RewindStat step={3}>
                <p>
                  {t.rich(
                    topTrack.artist ? 'topTrack' : 'topTrackWithoutArtist',
                    {
                      title: topTrack.title,
                      artist: topTrack.artist ?? '',
                      track: (chunks) => (
                        <span className='rewind-cat'>{chunks}</span>
                      ),
                      by: (chunks) => (
                        <span className='rewind-cat'>{chunks}</span>
                      ),
                    },
                  )}
                </p>
              </RewindStat>

              <RewindStat step={4}>
                <p>
                  {t.rich('topTrackPlays', {
                    countValue: topTrack.plays,
                    count: (chunks) => (
                      <span className='rewind-stat'>{chunks}</span>
                    ),
                  })}
                </p>
              </RewindStat>
            </>
          ) : (
            <RewindStat step={3} noScale>
              <p className='mb-2'>
                {t(userRewind.audio.top.length > 1 ? 'favorite' : 'only')}&nbsp;
                <span className='rewind-cat'>
                  {userRewind.audio.top[0].title}
                </span>
              </p>

              <div className='text-base leading-normal font-normal tracking-normal'>
                <MediaItems
                  type='artist'
                  items={Array(userRewind.audio.top[0])}
                  mediaServer={userRewind.media_server}
                  rows
                  settings={settings}
                />
              </div>
            </RewindStat>
          )}
        </>
      ) : (
        <RewindStat noScale>
          <p>
            {t.rich('noData', {
              audio: (chunks) => (
                <span className='rewind-cat'>
                  {chunks}
                  <MusicalNoteIcon />
                </span>
              ),
              serverName:
                settings.general.serverName ||
                getMediaServerName(settings.connection.mediaServerType),
              from: (chunks) => (
                <span className='whitespace-nowrap'>
                  {chunks}
                  {/* eslint-disable-next-line react/jsx-no-literals */}
                  <span className='not-italic'>🥴</span>
                </span>
              ),
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
