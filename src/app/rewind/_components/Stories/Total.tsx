import { RewindStory, RewindTotals } from '@/types/rewind'
import { getRewindBreakdown, hasRewindPlays } from '@/utils/helpers'
import { getServerName } from '@/utils/mediaServerName'
import { ClockIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { getAverageMessage } from '../averageMessage'
import RewindBreakdown from '../RewindBreakdown'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

export default function StoryTotal({
  userRewind,
  settings,
}: RewindStory<RewindTotals>) {
  const t = useTranslations('Rewind.Total')
  const { average, topPercent } = userRewind.duration
  const averageMessage = average && getAverageMessage(average.difference)
  // A single type would only repeat the total
  const breakdown = getRewindBreakdown(userRewind)
  const hasBreakdown = breakdown.length > 1

  return (
    <>
      {hasRewindPlays(userRewind) ? (
        <>
          <RewindStat>
            <p>
              {t.rich('duration', {
                durationValue: userRewind.duration.user,
                serverName: getServerName(settings),
                total: (chunks) => (
                  <RewindCat icon={<ClockIcon />}>{chunks}</RewindCat>
                ),
                duration: (chunks) => (
                  <span className='rewind-stat'>{chunks}</span>
                ),
              })}
            </p>
          </RewindStat>

          {average && averageMessage && (
            <RewindStat step={1}>
              <p>
                {t.rich(averageMessage.key, {
                  ...averageMessage.values,
                  durationValue: average.duration,
                  difference: (chunks) => (
                    <RewindCat icon={<averageMessage.Icon />}>
                      {chunks}
                    </RewindCat>
                  ),
                  duration: (chunks) => (
                    <span className='rewind-stat'>{chunks}</span>
                  ),
                })}
              </p>
            </RewindStat>
          )}

          {topPercent !== null && (
            <RewindStat step={2}>
              <p>
                {t.rich('topPercent', {
                  percent: topPercent / 100,
                  serverName: getServerName(settings),
                  top: (chunks) => (
                    <RewindCat icon={<TrophyIcon />}>{chunks}</RewindCat>
                  ),
                })}
              </p>
            </RewindStat>
          )}

          {hasBreakdown && (
            <RewindStat step={3} noScale>
              <p>{t('breakdown')}</p>
              <RewindBreakdown items={breakdown} />
            </RewindStat>
          )}
        </>
      ) : (
        <RewindStat noScale>
          <p>
            {t.rich('noData', {
              serverName: getServerName(settings),
              emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
            })}
          </p>
        </RewindStat>
      )}
    </>
  )
}
