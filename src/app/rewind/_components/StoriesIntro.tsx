'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { RefObject, useId } from 'react'

type Props = {
  buttonRef: RefObject<HTMLButtonElement | null>
  onDismiss: () => void
}

type TapProps = {
  // So the two sides take turns
  isDelayed?: boolean
}

// A finger tapping, with a ripple from its tip. Still for those who prefer
// reduced motion.
function Tap({ isDelayed }: TapProps) {
  const delay = isDelayed && 'animation-delay-1200'

  return (
    <span className='intro-tap' aria-hidden='true'>
      <span className={clsx('intro-tap-ripple', delay)} />
      <svg
        viewBox='0 0 24 24'
        fill='currentColor'
        className={clsx('intro-tap-hand', delay)}
      >
        <path d='M8 14.5V4.5a1.5 1.5 0 0 1 3 0v6a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-1.2a5.5 5.5 0 0 1-4.6-2.5l-3.6-3.6a1.4 1.4 0 0 1 2.2-1.7Z' />
      </svg>
    </span>
  )
}

// Shown once on touch screens, over the whole player. The sides match the
// story's tap areas: the left third goes back, the rest goes forward.
export default function StoriesIntro({ buttonRef, onDismiss }: Props) {
  const t = useTranslations('Rewind.Stories')
  const titleId = useId()

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      // Padded like the player, so the sides line up with the story's
      className='animate-fade-in absolute inset-0 z-30 flex flex-col rounded-[inherit] bg-black/60 p-[inherit]'
      onKeyDown={(e) => {
        // "Got it" is its only control, so focus stays on it
        if (e.key === 'Tab') {
          e.preventDefault()
        }
      }}
    >
      <div className='relative flex flex-1 text-center'>
        <div className='flex w-1/3 flex-col items-center justify-center gap-4 px-2'>
          <Tap />
          <p className='text-xl font-semibold text-white'>{t('introBack')}</p>
        </div>
        <div
          className='absolute inset-y-0 left-1/3 w-px bg-linear-to-b from-transparent via-white/25 to-transparent'
          aria-hidden='true'
        />
        <div className='flex flex-1 flex-col items-center justify-center gap-4 px-2'>
          <Tap isDelayed />
          <p className='text-xl font-semibold text-white'>
            {t('introForward')}
          </p>
        </div>
      </div>
      {/* Where the story's buttons are, in reach of a thumb */}
      <div className='flex flex-col items-center gap-5 pt-6 text-center'>
        <h2
          id={titleId}
          className='text-2xl font-semibold text-balance text-white'
        >
          {t('introTitle')}
        </h2>
        <button
          ref={buttonRef}
          type='button'
          className='button w-full max-w-sm py-3'
          onClick={onDismiss}
        >
          {t('introDismiss')}
        </button>
      </div>
    </div>
  )
}
