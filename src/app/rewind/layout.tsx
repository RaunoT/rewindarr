import CardWrapper from '@/app/_components/CardWrapper'
import PageTitle from '@/app/_components/PageTitle'
import { authOptions } from '@/lib/auth'
import { TIME_ZONE_COOKIE_NAME } from '@/utils/constants'
import getRewindEditions from '@/utils/getRewindEditions'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { getLatestEditionYear, getRewindPeriodType } from '@/utils/rewindPeriod'
import { getActiveUsers } from '@/utils/statsSource'
import { toTimeZone } from '@/utils/timeZone'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache, ReactNode, Suspense } from 'react'
import UserSelect from './_components/UserSelect'
import YearSelect from './_components/YearSelect'

type Props = {
  children: ReactNode
}

// Lets the stories reach under the notch and the home bar on phones
export const viewport: Viewport = {
  viewportFit: 'cover',
}

// The pickers show twice, for phones and for wider screens
const getEditions = cache(getRewindEditions)

export default async function RewindLayout({ children }: Props) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'rewind', getViewer(session))) {
    return notFound()
  }

  const t = await getTranslations('Rewind')
  const isAdmin = !!session?.user.isAdmin
  const hasEditions = getRewindPeriodType(settings) === 'calendarYear'
  const selects = session && (isAdmin || hasEditions) && (
    <Suspense>
      <RewindSelects
        userId={session.user.id}
        isAdmin={isAdmin}
        hasEditions={hasEditions}
      />
    </Suspense>
  )

  return (
    <div className='page-width flex flex-1 flex-col sm:flex-none'>
      {/* On phones the stories fill the screen in place of these */}
      <div className='max-sm:hidden'>
        <PageTitle title={t('title')} />
        {selects && (
          <div className='mb-4 flex min-h-10 items-center justify-end gap-3'>
            {selects}
          </div>
        )}
      </div>
      <CardWrapper className='rewind-player sm:min-h-[80vh]'>
        {/* The page header's place on phones, clear of the progress bar's tap
            areas, which reach above it. It stays above the touch intro, so
            the way out does too. */}
        <div className='relative z-40 mb-6 flex min-h-10 items-center gap-3 sm:hidden'>
          <h1 className='sr-only'>{t('title')}</h1>
          {selects}
          <Link
            href='/'
            className='icon-button icon-button--glass ml-auto shrink-0'
            aria-label={t('close')}
          >
            <XMarkIcon />
          </Link>
        </div>
        {children}
      </CardWrapper>
    </div>
  )
}

type SelectsProps = {
  userId: string
  isAdmin: boolean
  hasEditions: boolean
}

// Admins pick whose Rewind it is, and with calendar-year editions, everyone
// picks the year
async function RewindSelects({ userId, isAdmin, hasEditions }: SelectsProps) {
  const timeZone = toTimeZone(
    (await cookies()).get(TIME_ZONE_COOKIE_NAME)?.value,
  )
  const [users, yearsByUser] = await Promise.all([
    isAdmin ? getActiveUsers() : null,
    hasEditions ? getEditions(userId, isAdmin, timeZone) : null,
  ])

  return (
    <>
      {users && (
        <UserSelect
          users={users.map(({ user_id, friendly_name, thumb, user_thumb }) => ({
            user_id,
            friendly_name,
            thumb,
            user_thumb,
          }))}
          defaultUserId={userId}
        />
      )}
      {yearsByUser && (
        <YearSelect
          yearsByUser={yearsByUser}
          latestYear={getLatestEditionYear(getSettings(), timeZone)}
          defaultUserId={userId}
          userIds={users?.map((user) => String(user.user_id)) ?? []}
        />
      )}
    </>
  )
}
