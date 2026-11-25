import StatusMessage from '@/components/StatusMessage'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound')

  return { title: t('title') }
}

export default async function NotFound() {
  const t = await getTranslations('NotFound')

  return (
    <StatusMessage
      icon={MagnifyingGlassIcon}
      title={t('title')}
      as='h1'
      action={
        <Link href='/' className='button w-full'>
          {t('cta')}
        </Link>
      }
    />
  )
}
