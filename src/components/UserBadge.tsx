import Avatar from '@/components/Avatar'
import ImageFallback from '@/components/ImageFallback'
import { UserIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'

export type BadgeUser = {
  name: string
  avatar: string
  // The signed-in user, in Plex gold
  isOwn: boolean
  // Who it is stays hidden, with an icon for the avatar
  isAnonymous: boolean
}

type Props = {
  user: BadgeUser
  priority?: boolean
}

// A user's avatar and name, for inside a stat pill, the same in the history
// and the activity
export default function UserBadge({ user, priority }: Props) {
  return (
    <>
      <UserAvatar user={user} priority={priority} className='size-4' />
      <span
        className={clsx(
          'max-w-40 truncate',
          user.isOwn && 'text-plex font-medium',
        )}
      >
        {user.name}
      </span>
    </>
  )
}

type UserAvatarProps = Props & {
  // Sets the size
  className: string
  // Without the name beside it, the signed-in user's gets a gold ring
  isOwnMarked?: boolean
}

export function UserAvatar({
  user,
  priority,
  className,
  isOwnMarked,
}: UserAvatarProps) {
  const t = useTranslations()

  return (
    <span
      className={clsx(
        'relative shrink-0 overflow-hidden rounded-full',
        isOwnMarked && user.isOwn && 'ring-plex ring-2',
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
          priority={priority}
        />
      )}
    </span>
  )
}
