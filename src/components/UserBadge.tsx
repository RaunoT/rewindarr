import Avatar from '@/components/Avatar'
import ImageFallback from '@/components/ImageFallback'
import { UserIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'

export type BadgeUser = {
  name: string
  avatar: string
  // Who it is stays hidden, with an icon for the avatar
  isAnonymous: boolean
}

type Props = {
  user: BadgeUser
  preload?: boolean
}

// A user's avatar and name, for inside a stat pill, the same in the history
// and the activity
export default function UserBadge({ user, preload }: Props) {
  return (
    <>
      <UserAvatar user={user} preload={preload} className='size-4' />
      <span className='max-w-40 truncate'>{user.name}</span>
    </>
  )
}

type UserAvatarProps = Props & {
  // Sets the size
  className: string
}

export function UserAvatar({ user, preload, className }: UserAvatarProps) {
  const t = useTranslations()

  return (
    <span
      className={clsx(
        'relative shrink-0 overflow-hidden rounded-full',
        className,
      )}
    >
      {user.isAnonymous ? (
        <ImageFallback alt={t('Activity.anonymousAvatar')}>
          <UserIcon className='size-[60cqw]' />
        </ImageFallback>
      ) : (
        <Avatar
          src={user.avatar}
          name={user.name}
          alt={t('Common.profilePictureAlt', { name: user.name })}
          sizes='2rem'
          preload={preload}
        />
      )}
    </span>
  )
}
