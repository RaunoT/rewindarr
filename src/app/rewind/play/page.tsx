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
    // A calendar year's edition, the latest without one
    year?: string
  }>
}

// Always the viewer's own Rewind, even an admin's,
// so the same link can be sent to everyone
export default async function RewindPlayPage({ searchParams }: Props) {
  const { year } = await searchParams

  return (
    <Suspense fallback={<Loading />} key={year}>
      <RewindContent year={year} />
    </Suspense>
  )
}
