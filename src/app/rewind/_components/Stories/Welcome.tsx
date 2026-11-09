import Avatar from '@/components/Avatar'
import { RewindStory, UserRewind } from '@/types/rewind'
import { formatMonthYear } from '@/utils/formatting'
import { getRewindPeriodType } from '@/utils/rewindPeriod'
import { useLocale, useTranslations } from 'next-intl'
import RewindStat from '../RewindStat'

// Named after the server only when the admin gave it a name, not after Plex
// or Jellyfin
export default function StoryWelcome({
  userRewind,
  settings,
}: RewindStory<Pick<UserRewind, 'user' | 'period'>>) {
  const { since, year } = userRewind.period
  const isPastYear = getRewindPeriodType(settings) === 'pastYear'
  const t = useTranslations('Rewind.Welcome')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const formattedStartDate = formatMonthYear(since, locale)
  // Only an edition ends, so the other periods' ranges end today
  const formattedEndDate = formatMonthYear(
    new Date().toISOString().split('T')[0],
    locale,
  )

  return (
    <>
      <RewindStat noScale isAnimated={false}>
        <div className='relative mb-8 size-24 overflow-hidden rounded-full'>
          <Avatar
            src={userRewind.user.image}
            name={userRewind.user.name}
            alt={tCommon('profilePictureAlt', { name: userRewind.user.name })}
            sizes='10rem'
            preload
          />
        </div>
        <p>
          {year === null
            ? t.rich('welcome', {
                serverName: settings.general.serverName,
                hasServerName: String(!!settings.general.serverName),
                userValue: userRewind.user.name,
                rewind: (chunks) => chunks,
                user: (chunks) => <span className='rewind-cat'>{chunks}</span>,
              })
            : t.rich('welcomeEdition', {
                serverName: settings.general.serverName,
                hasServerName: String(!!settings.general.serverName),
                year: String(year),
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
                yearValue: String(year),
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
