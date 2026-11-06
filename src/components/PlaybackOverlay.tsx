import { TautulliSession } from '@/types/tautulli'
import { ArrowPathIcon, PauseIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'

type Props = {
  state: TautulliSession['state']
  // Sets the icon's size
  className: string
}

// Over a stream's poster, which sets the size and shape, while it's paused or
// buffering. Only Tautulli reports buffering, and anything unexpected reads as
// paused.
export default function PlaybackOverlay({ state, className }: Props) {
  const t = useTranslations('Activity')

  if (state === 'playing') {
    return null
  }

  const isBuffering = state === 'buffering'
  const Icon = isBuffering ? ArrowPathIcon : PauseIcon

  return (
    <span
      role='img'
      aria-label={isBuffering ? t('buffering') : t('paused')}
      className='poster-overlay'
    >
      <Icon
        className={clsx(
          'drop-shadow',
          isBuffering && 'motion-safe:animate-spin',
          className,
        )}
      />
    </span>
  )
}
