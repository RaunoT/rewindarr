import { useTranslations } from 'next-intl'
import SeerrLogo from './SeerrLogo'

type Props = {
  title: string
  // Seerr's page for the title
  href: string
}

// For a title that's been deleted, when Seerr's links are chosen
export default function RequestButton({ title, href }: Props) {
  const t = useTranslations('MediaItem')

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='button-card'
      aria-label={t('requestLabel', { title })}
    >
      <SeerrLogo />
      {t('request')}
    </a>
  )
}
