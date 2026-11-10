import { STAT_ICONS } from '@/components/icons'
import { RewindStory } from '@/types/rewind'
import { getRequestsBreakdown } from '@/utils/helpers'
import { useFormatter, useTranslations } from 'next-intl'
import { getAverageMessage } from '../averageMessage'
import RewindBreakdown from '../RewindBreakdown'
import RewindCat from '../RewindCat'
import RewindStat from '../RewindStat'

export default function StoryRequests({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Requests')
  const format = useFormatter()
  const average = userRewind.requests?.average
  const averageMessage = average && getAverageMessage(average.difference)
  const breakdown = userRewind.requests
    ? getRequestsBreakdown(userRewind.requests).map(({ count, ...item }) => ({
        ...item,
        value: format.number(count),
      }))
    : []
  // A single type would only repeat the count
  const hasBreakdown = breakdown.length > 1
  const watched = userRewind.requests?.watched
  const watchedKey =
    watched &&
    (watched.watched === 0
      ? 'watchedNone'
      : watched.watched === watched.added
        ? 'watchedAll'
        : 'watchedSome')
  // Also stands in for the comparison when there's nobody to compare with
  const totalStat = userRewind.requests && (
    <RewindStat step={1}>
      <p>
        {t.rich('countTotal', {
          countValue: userRewind.requests.total,
          count: (chunks) => (
            <RewindCat icon={<STAT_ICONS.requests />}>{chunks}</RewindCat>
          ),
        })}
      </p>
    </RewindStat>
  )

  return (
    userRewind.requests && (
      <>
        {userRewind.requests.total == 0 ? (
          <RewindStat noScale>
            <p>
              {t.rich('noData', {
                requests: (chunks) => (
                  <RewindCat icon={<STAT_ICONS.requests />}>{chunks}</RewindCat>
                ),
                emoji: (chunks) => <span className='not-italic'>{chunks}</span>,
              })}
            </p>
          </RewindStat>
        ) : (
          <>
            {userRewind.requests.user.total == 0 ? (
              <>
                <RewindStat>
                  <p>
                    {t.rich('noUserData', {
                      requests: (chunks) => (
                        <RewindCat icon={<STAT_ICONS.requests />}>
                          {chunks}
                        </RewindCat>
                      ),
                      requestLink: (chunks) => (
                        <a
                          className='link relative z-10'
                          href={settings.connection.seerrUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {chunks}
                        </a>
                      ),
                      requestLinkValue:
                        settings.connection.seerrUrl.split('//').pop() ?? '',
                    })}
                  </p>
                </RewindStat>

                {totalStat}

                {hasBreakdown && (
                  <RewindStat step={2} noScale>
                    <p>{t('breakdown')}</p>
                    <RewindBreakdown items={breakdown} />
                  </RewindStat>
                )}
              </>
            ) : (
              <>
                <RewindStat>
                  <p>
                    {t.rich('count', {
                      countValue: userRewind.requests.user.total,
                      count: (chunks) => (
                        <span className='rewind-cat'>{chunks}</span>
                      ),
                      requests: (chunks) => (
                        <RewindCat icon={<STAT_ICONS.requests />}>
                          {chunks}
                        </RewindCat>
                      ),
                    })}
                  </p>
                </RewindStat>

                {average && averageMessage ? (
                  <RewindStat step={1}>
                    <p>
                      {t.rich(averageMessage.key, {
                        ...averageMessage.values,
                        countValue: average.count,
                        difference: (chunks) => (
                          <RewindCat icon={<averageMessage.Icon />}>
                            {chunks}
                          </RewindCat>
                        ),
                        count: (chunks) => (
                          <span className='rewind-stat'>{chunks}</span>
                        ),
                      })}
                    </p>
                  </RewindStat>
                ) : (
                  totalStat
                )}

                {watched && watchedKey && (
                  <RewindStat step={2}>
                    <p>
                      {t.rich(watchedKey, {
                        watchedValue: watched.watched,
                        addedValue: watched.added,
                        count: (chunks) => (
                          <span className='rewind-stat'>{chunks}</span>
                        ),
                        emoji: (chunks) => (
                          <span className='not-italic'>{chunks}</span>
                        ),
                      })}
                    </p>
                  </RewindStat>
                )}

                {hasBreakdown && (
                  <RewindStat step={3} noScale>
                    <p>{t('userBreakdown')}</p>
                    <RewindBreakdown items={breakdown} />
                  </RewindStat>
                )}
              </>
            )}
          </>
        )}
      </>
    )
  )
}
