import clsx from 'clsx'

type Props = {
  // From 0 to 1
  value: number
  // Without one, the bar is only for the eye and the text beside it says
  // the same
  label?: string
  // For progress that isn't moving, such as a read that stopped
  isMuted?: boolean
  // Sets the width, which is otherwise the container's
  className?: string
}

// Drawn like the playback progress on the activity page
export default function ProgressBar({
  value,
  label,
  isMuted,
  className,
}: Props) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100)

  return (
    <div
      {...(label
        ? {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': percent,
          }
        : { 'aria-hidden': true })}
      className={clsx(
        'h-1.5 shrink-0 overflow-hidden rounded-full bg-white/10',
        className || 'w-full',
      )}
    >
      <div
        className={clsx(
          'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500',
          isMuted ? 'bg-neutral-500' : 'bg-white',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
