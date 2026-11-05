import clsx from 'clsx'

type Props = {
  count: number
  className?: string
}

// A card's buttons for the title's pages elsewhere, each one site's logo
export default function SkeletonLinks({ count, className }: Props) {
  return (
    <div className={clsx('flex shrink-0 gap-x-1.5', className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className='skeleton h-6 w-11 rounded-md' />
      ))}
    </div>
  )
}
