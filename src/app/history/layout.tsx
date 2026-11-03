import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ReactNode } from 'react'
import PageTitle from '../_components/PageTitle'

type Props = {
  children: ReactNode
}

export default async function HistoryLayout({ children }: Props) {
  const t = await getTranslations('History')
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'history', getViewer(session))) {
    return notFound()
  }

  return (
    <div className='page-width mb-auto'>
      <PageTitle title={t('title')} />
      {children}
    </div>
  )
}
