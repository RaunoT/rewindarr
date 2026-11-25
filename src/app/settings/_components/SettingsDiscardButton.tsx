'use client'

import { useTranslations } from 'next-intl'
import { useFormStatus } from 'react-dom'

type Props = {
  onPress: () => void
  isDiscarding: boolean
}

export default function SettingsDiscardButton({
  onPress,
  isDiscarding,
}: Props) {
  // A save on its way would still be written, so it can't be discarded
  const { pending } = useFormStatus()
  const t = useTranslations('Settings')

  return (
    <button
      className='button button--glass shrink-0 max-sm:flex-1 max-sm:px-4'
      type='button'
      onClick={onPress}
      disabled={pending || isDiscarding}
    >
      {t('discardChanges')}
    </button>
  )
}
