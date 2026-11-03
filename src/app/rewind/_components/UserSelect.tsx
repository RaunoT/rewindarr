'use client'

import UserPicker from '@/components/filters/UserPicker'
import { TautulliUser } from '@/types/tautulli'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'

type Props = {
  users: Pick<
    TautulliUser,
    'user_id' | 'friendly_name' | 'thumb' | 'user_thumb'
  >[]
  defaultUserId: string
}

// Rendered by the layout, so it stays on screen while another user's rewind
// loads. The page shows the admin's own rewind for an unknown user ID.
export default function UserSelect({ users, defaultUserId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('UserSelect')
  const userIdParam = searchParams.get('userId')
  const currentUserId = users.some(
    (user) => String(user.user_id) === userIdParam,
  )
    ? userIdParam
    : defaultUserId

  function handleChange([userId]: string[]) {
    const newParams = new URLSearchParams(searchParams.toString())

    newParams.set('userId', userId)
    router.push(`/rewind?${newParams.toString()}`)
  }

  return (
    <UserPicker
      label={t('label')}
      options={users.map((user) => ({
        value: String(user.user_id),
        label: user.friendly_name,
        avatar: user.user_thumb || user.thumb,
      }))}
      value={[String(currentUserId)]}
      onChange={handleChange}
      className='max-w-56'
    />
  )
}
