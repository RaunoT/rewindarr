import rewindarrSvg from '@/assets/rewindarr.svg'
import clsx from 'clsx'
import Image from 'next/image'

type Props = {
  className?: string
  preload?: boolean
}

// Beside the app's or server's name, which says what it is
export default function AppIcon({ className, preload }: Props) {
  return (
    <Image
      src={rewindarrSvg}
      alt=''
      className={clsx('shrink-0 drop-shadow-lg', className)}
      preload={preload}
    />
  )
}
