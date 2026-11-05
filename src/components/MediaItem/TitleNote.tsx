import clsx from 'clsx'
import { ReactNode } from 'react'

type Props = {
  // For screen readers, where the note alone doesn't say what it is
  label?: string
  className?: string
  children: ReactNode
}

// Quieter than the title it follows, such as its year, and apart from the
// ratings and stats under it
export default function TitleNote({ label, className, children }: Props) {
  // A space before it, so it doesn't run into the title for screen readers
  return (
    <>
      {' '}
      <span
        className={clsx(
          'ml-1 text-sm font-normal text-neutral-400 tabular-nums sm:text-base',
          className,
        )}
      >
        {label && <span className='sr-only'>{`${label} `}</span>}
        {children}
      </span>
    </>
  )
}
