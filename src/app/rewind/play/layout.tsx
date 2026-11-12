import CardWrapper from '@/app/_components/CardWrapper'
import { getTranslations } from 'next-intl/server'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

// The stories alone, filling the window,
// for a link that opens straight into the viewer's Rewind.
// The parent layout has already checked the viewer can see Rewind,
// and the proxy sends a logged-out visitor to log in first.
export default async function RewindPlayLayout({ children }: Props) {
  const t = await getTranslations('Rewind')

  return (
    <CardWrapper className='rewind-player rewind-player-page'>
      <h1 className='sr-only'>{t('title')}</h1>
      {children}
    </CardWrapper>
  )
}
