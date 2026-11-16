import RewindContent from '@/app/rewind/_components/RewindContent'
import Loading from '@/app/rewind/_components/RewindLoading'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Rewind')

  return {
    title: t('title'),
  }
}

type Props = {
  searchParams: Promise<{
    userId?: string
    // A calendar year's edition, the latest without one
    year?: string
  }>
}

export default async function RewindPage({ searchParams }: Props) {
  const { userId, year } = await searchParams

  return (
    <Suspense fallback={<Loading />} key={`${userId}|${year}`}>
      <RewindContent userId={userId} year={year} />
    </Suspense>
  )
}
