import Avatar from '@/components/Avatar'
import { RewindStory } from '@/types/rewind'
import { formatMonthYear } from '@/utils/formatting'
import { getMediaServerName } from '@/utils/mediaServerName'
import { getRewindPeriodType } from '@/utils/rewindPeriod'
import { useLocale, useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'

export default function StoryWelcome({ userRewind, settings }: RewindStory) {
  const { start, year } = userRewind.period
  const isPastYear = getRewindPeriodType(settings) === 'pastYear'
  const t = useTranslations('Rewind.Welcome')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const formattedStartDate = formatMonthYear(start, locale)
  // Only an edition has an end, so the other periods' ranges end today
  const formattedEndDate = formatMonthYear(
    new Date().toISOString().split('T')[0],
    locale,
  )
  const serverName =
    settings.general.serverName ||
    getMediaServerName(settings.connection.mediaServerType)

  return (
    <>
      <RewindStat noScale isAnimated={false}>
        <div className='relative mb-8 size-24 overflow-hidden rounded-full'>
          <Avatar
            src={userRewind.user.image}
            name={userRewind.user.name}
            alt={tCommon('profilePictureAlt', { name: userRewind.user.name })}
            sizes='10rem'
            priority
          />
        </div>
        <p>
          {year === null
            ? t.rich('welcome', {
                serverName,
                userValue: userRewind.user.name,
                rewind: (chunks) => chunks,
                user: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              })
            : t.rich('welcomeEdition', {
                serverName,
                year,
                userValue: userRewind.user.name,
                rewind: (chunks) => chunks,
                user: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale>
        <p>
          {t('takeYouThrough')}{' '}
          {year !== null
            ? t.rich('forYear', {
                yearValue: year,
                year: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              })
            : isPastYear
              ? t.rich('forPastYear', {
                  pastYear: (chunks) => (
                    <span className='rewind-cat'>{chunks}</span>
                  ),
                })
              : formattedStartDate === formattedEndDate
                ? t.rich('singleDate', {
                    singleDateValue: formattedStartDate,
                    singleDate: (chunks) => (
                      <span className='rewind-cat'>{chunks}</span>
                    ),
                  })
                : t.rich('dateRange', {
                    startDateValue: formattedStartDate,
                    endDateValue: formattedEndDate,
                    startDate: (chunks) => (
                      <span className='rewind-cat'>{chunks}</span>
                    ),
                    endDate: (chunks) => (
                      <span className='rewind-cat'>{chunks}</span>
                    ),
                  })}
        </p>
      </RewindStat>

      <RewindStat step={2} noScale>
        <p>{t('letsGetStarted')}</p>
      </RewindStat>
    </>
  )
}
