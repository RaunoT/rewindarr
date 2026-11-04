import CardWrapper from '@/app/_components/CardWrapper'
import PageTitle from '@/app/_components/PageTitle'
import { authOptions } from '@/lib/auth'
import getRewindEditions from '@/utils/getRewindEditions'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { getLatestEditionYear, getRewindPeriodType } from '@/utils/rewindPeriod'
import { getActiveUsers } from '@/utils/statsSource'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ReactNode, Suspense } from 'react'
import UserSelect from './_components/UserSelect'
import YearSelect from './_components/YearSelect'

type Props = {
  children: ReactNode
}

export default async function RewindLayout({ children }: Props) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'rewind', getViewer(session))) {
    return notFound()
  }

  const t = await getTranslations('Rewind')
  const hasEditions = getRewindPeriodType(settings) === 'calendarYear'

  return (
    <div className='page-width flex flex-1 flex-col sm:flex-none'>
      <PageTitle title={t('title')} />
      {session?.user.isAdmin ? (
        <div className='mb-4 flex min-h-10 items-center justify-end gap-2'>
          <Suspense>
            <AdminSelects
              defaultUserId={session.user.id}
              hasEditions={hasEditions}
            />
          </Suspense>
        </div>
      ) : (
        hasEditions &&
        session && (
          <Suspense>
            <ViewerYearSelect userId={session.user.id} />
          </Suspense>
        )
      )}
      <CardWrapper className='sm:min-h-[80vh]'>{children}</CardWrapper>
    </div>
  )
}

async function AdminSelects({
  defaultUserId,
  hasEditions,
}: {
  defaultUserId: string
  hasEditions: boolean
}) {
  const [users, yearsByUser] = await Promise.all([
    getActiveUsers(),
    hasEditions ? getRewindEditions(defaultUserId, true) : null,
  ])

  return (
    <>
      {yearsByUser && (
        <YearSelect
          yearsByUser={yearsByUser}
          latestYear={getLatestEditionYear()}
          defaultUserId={defaultUserId}
          userIds={users.map((user) => String(user.user_id))}
        />
      )}
      <UserSelect
        users={users.map(({ user_id, friendly_name, thumb, user_thumb }) => ({
          user_id,
          friendly_name,
          thumb,
          user_thumb,
        }))}
        defaultUserId={defaultUserId}
      />
    </>
  )
}

// Only once there's a past edition to pick, so other viewers don't get an
// empty bar
async function ViewerYearSelect({ userId }: { userId: string }) {
  const yearsByUser = await getRewindEditions(userId, false)

  if (!yearsByUser[userId]?.length) {
    return null
  }

  return (
    <div className='mb-4 flex min-h-10 items-center justify-end'>
      <YearSelect
        yearsByUser={yearsByUser}
        latestYear={getLatestEditionYear()}
        defaultUserId={userId}
        userIds={[]}
      />
    </div>
  )
}
