import CardWrapper from '@/app/_components/CardWrapper'
import PageTitle from '@/app/_components/PageTitle'
import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { getActiveUsers } from '@/utils/statsSource'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReactNode, Suspense } from 'react'
import UserSelect from './_components/UserSelect'

type Props = {
  children: ReactNode
}

// Lets the stories reach under the notch and the home bar on phones
export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default async function RewindLayout({ children }: Props) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'rewind', getViewer(session))) {
    return notFound()
  }

  const t = await getTranslations('Rewind')
  const userSelect = session?.user.isAdmin && (
    <Suspense>
      <AdminUserSelect defaultUserId={session.user.id} />
    </Suspense>
  )

  return (
    <div className='page-width flex flex-1 flex-col sm:flex-none'>
      {/* On phones the stories fill the screen in place of these */}
      <div className='max-sm:hidden'>
        <PageTitle title={t('title')} />
        {userSelect && (
          <div className='mb-4 flex min-h-10 items-center justify-end'>
            {userSelect}
          </div>
        )}
      </div>
      <CardWrapper className='rewind-player sm:min-h-[80vh]'>
        {/* The page header's place on phones, clear of the progress bar's tap
            areas, which reach above it. It stays above the touch intro, so
            the way out does too. */}
        <div className='relative z-40 mb-6 flex min-h-10 items-center gap-3 sm:hidden'>
          <h1 className='sr-only'>{t('title')}</h1>
          {userSelect}
          <Link
            href='/'
            className='icon-button icon-button--glass ml-auto'
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

async function AdminUserSelect({ defaultUserId }: { defaultUserId: string }) {
  const users = await getActiveUsers()

  return (
    <UserSelect
      users={users.map(({ user_id, friendly_name, thumb, user_thumb }) => ({
        user_id,
        friendly_name,
        thumb,
        user_thumb,
      }))}
      defaultUserId={defaultUserId}
    />
  )
}
