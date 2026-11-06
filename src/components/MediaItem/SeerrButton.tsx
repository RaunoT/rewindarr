import { ReactNode } from 'react'
import SeerrLogo from './SeerrLogo'

type Props = {
  // The title's page in Seerr
  href: string
  label: string
  // Next to the logo, what Seerr says about the title, such as a request's
  // status
  children?: ReactNode
}

// A link to the title in Seerr
export default function SeerrButton({ href, label, children }: Props) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='button-card'
      aria-label={label}
    >
      <SeerrLogo />
      {children}
    </a>
  )
}
